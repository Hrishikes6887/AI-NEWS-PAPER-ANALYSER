// Vercel Serverless Function for PDF/DOCX Analysis with Gemini AI
import type { VercelRequest, VercelResponse } from '@vercel/node';
import multiparty from 'multiparty';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';
// @ts-ignore
import mammoth from 'mammoth';

const CATEGORIES = [
  'polity',
  'economy',
  'international_relations',
  'science_tech',
  'environment',
  'geography',
  'culture',
  'security',
  'misc'
];

// Call Gemini AI
async function callGemini(prompt: string, apiKey: string, retries = 3): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`🤖 Calling Gemini AI (attempt ${attempt + 1})...`);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout per request
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 16384,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          apiKeyPrefix: apiKey.substring(0, 15) + '...'
        });
        
        // Check for rate limiting
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Your API key hit the free tier limit (15 requests/minute). Wait 60 seconds or upgrade to paid tier.');
        }
        if (response.status === 403) {
          throw new Error('API key invalid or quota exceeded. Your key may be disabled or out of quota. Check https://aistudio.google.com/apikey');
        }
        if (response.status === 400) {
          throw new Error(`Bad request to Gemini API: ${errorText}`);
        }
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]) {
        throw new Error('Invalid response structure from Gemini');
      }

      const text = data.candidates[0].content.parts[0].text;
      console.log(`✅ Gemini response received (${text.length} chars)`);
      return text;

    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, (error as Error).message);
      if (attempt === retries) throw error;
      
      // Exponential backoff for retries
      const delay = Math.min(5000 * Math.pow(2, attempt), 15000);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('All retries failed');
}

// Detect and extract numerical values from text
function detectNumericalData(item: any): { hasNumbers: boolean; numericHighlights: string[] } {
  const numericPatterns = [
    /₹\s*[\d,]+(\s*(crore|lakh|billion|million|thousand))?/gi,
    /\$\s*[\d,]+(\s*(billion|million|thousand))?/gi,
    /\d+%/g,
    /\d+\s*(MW|GW|km|hectares|tons|tonnes|metric tons)/gi,
    /(20[2-9]\d|203\d)/g, // Years 2020-2039
    /\d+\s*(targets?|goals?)/gi
  ];

  const allText = `${item.title} ${item.points.join(' ')}`;
  const highlights: string[] = [];
  let hasNumbers = false;

  numericPatterns.forEach(pattern => {
    const matches = allText.match(pattern);
    if (matches && matches.length > 0) {
      hasNumbers = true;
      matches.forEach(match => {
        if (!highlights.includes(match)) {
          highlights.push(match);
        }
      });
    }
  });

  return { hasNumbers, numericHighlights: highlights.slice(0, 5) }; // Max 5 highlights
}

// Calculate priority score based on confidence and numerical data
function calculatePriorityScore(item: any): number {
  let score = item.confidence || 0.5;
  
  // Boost for numerical data (up to +0.2)
  if (item.hasNumbers && item.numericHighlights && item.numericHighlights.length > 0) {
    const boost = Math.min(0.2, item.numericHighlights.length * 0.05);
    score += boost;
  }
  
  // Cap at 1.0
  return Math.min(score, 1.0);
}

// Process items to add numerical detection and priority
function processNewsItems(items: any[]): any[] {
  return items.map(item => {
    const { hasNumbers, numericHighlights } = detectNumericalData(item);
    const processedItem = {
      ...item,
      hasNumbers,
      numericHighlights,
      priorityScore: 0
    };
    processedItem.priorityScore = calculatePriorityScore(processedItem);
    return processedItem;
  });
}

// Analyze single chunk
async function analyzeSingleChunk(text: string, fileName: string, chunkNum: number, totalChunks: number, apiKey: string) {
  const truncatedText = text.substring(0, 40000); // Reduced from 50k to 40k for faster processing
  const chunkInfo = totalChunks > 1 ? ` (Chunk ${chunkNum}/${totalChunks})` : '';
  
  const prompt = `You are an expert UPSC Current Affairs Analyst. Analyze the text and extract exam-relevant news items${chunkInfo}.

CRITICAL FILTERING RULES:
1. POLITICAL NOISE FILTER:
   - EXCLUDE routine political party statements, election rhetoric, party criticism
   - INCLUDE ONLY if news involves: constitutional amendments, laws, governance policies, court rulings, institutional reforms
   - Focus on substance (what changed/decided) NOT politics (who said what)
   - Political party names acceptable only for legislative/policy context

2. NUMERICAL VALUE PRIORITY:
   - Prioritize news with concrete data: budget figures (₹ crore/lakh/billion), targets (MW, km, tons, %), timelines (2027, 2030)
   - Include numerical values EXPLICITLY in the points
   - Mark items with meaningful numbers for higher priority

3. ENHANCED REFERENCES:
   - Extract: newspaper name, date (DD-MM-YYYY), exact headline, page number, 1-2 line excerpt
   - References must be verifiable and classroom-ready

OUTPUT FORMAT:
- Return ONLY valid JSON, no markdown
- Categories: polity, economy, international_relations, science_tech, environment, geography, culture, security, misc
- Extract 8-12 news items PER CATEGORY if available
- Include items with confidence >= 0.5
- Empty array [] if no content for category

TEXT TO ANALYZE (${truncatedText.length} chars)${chunkInfo}:
${truncatedText}

Return JSON in this EXACT format:
{
  "source_file": "${fileName}",
  "categories": {
    "polity": [
      {
        "title": "Brief title (max 80 chars)",
        "points": ["Point with numbers if available: ₹500 crore allocated", "Point 2"],
        "references": [
          {
            "newspaper": "The Hindu",
            "date": "23-12-2025",
            "headline": "Exact headline as printed",
            "page": 1,
            "excerpt": "First 100 chars from article..."
          }
        ],
        "confidence": 0.85
      }
    ],
    "economy": [],
    "international_relations": [],
    "science_tech": [],
    "environment": [],
    "geography": [],
    "culture": [],
    "security": [],
    "misc": []
  }
}

Remember: Focus on exam-relevant substance with verifiable data. Filter political noise. Prioritize numerical facts.`;

  try {
    const response = await callGemini(prompt, apiKey);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON found in Gemini response');

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Ensure all categories exist and process items
    CATEGORIES.forEach(cat => {
      if (!parsed.categories[cat]) {
        parsed.categories[cat] = [];
      } else {
        // Process each item to detect numbers and calculate priority
        parsed.categories[cat] = processNewsItems(parsed.categories[cat]);
      }
    });

    return parsed;
  } catch (error) {
    const fallback: any = { source_file: fileName, categories: {} };
    CATEGORIES.forEach(cat => fallback.categories[cat] = []);
    
    fallback.categories.polity = [{
      title: 'Error: Could not analyze with Gemini AI',
      points: [
        `Error: ${(error as Error).message}`,
        'Please check your GEMINI_API_KEY environment variable in Vercel'
      ],
      references: [{ page: 1, excerpt: 'Error occurred during analysis' }],
      confidence: 0.5
    }];
    
    return fallback;
  }
}

// Merge analysis results
function mergeAnalysisResults(results: any[], fileName: string) {
  console.log(`🔗 Merging ${results.length} chunk results...`);
  
  const merged: any = { source_file: fileName, categories: {} };
  CATEGORIES.forEach(cat => merged.categories[cat] = []);
  
  results.forEach(result => {
    if (result?.categories) {
      Object.keys(result.categories).forEach(cat => {
        if (merged.categories[cat] && result.categories[cat]) {
          merged.categories[cat].push(...result.categories[cat]);
        }
      });
    }
  });
  
  // Remove duplicates and sort by priority
  Object.keys(merged.categories).forEach(cat => {
    const items = merged.categories[cat];
    const unique: any[] = [];
    const seenTitles = new Set<string>();
    
    items.forEach((item: any) => {
      const normalizedTitle = item.title.toLowerCase().substring(0, 50);
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        unique.push(item);
      }
    });
    
    // Sort by priority score (highest first)
    unique.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    
    merged.categories[cat] = unique;
  });
  
  const totalItems = Object.values(merged.categories).reduce((sum: number, items: any) => sum + items.length, 0);
  console.log(`✅ Merged result: ${totalItems} unique items`);
  
  return merged;
}

// Main analysis with chunking
async function analyzeWithGemini(text: string, fileName: string, apiKey: string) {
  console.log(`📄 Total text length: ${text.length} characters`);
  
  const maxChars = 80000; // Reduced from 100k
  const chunkSize = 40000; // Reduced from 50k
  
  if (text.length <= maxChars) {
    console.log(`✅ Processing single chunk (${text.length} chars)`);
    return await analyzeSingleChunk(text, fileName, 1, 1, apiKey);
  } else {
    console.log(`📊 Large document detected, splitting into chunks...`);
    const numChunks = Math.ceil(text.length / chunkSize);
    const chunks: string[] = [];
    
    // Limit to 2 chunks to stay within timeout (was 3)
    for (let i = 0; i < numChunks && i < 2; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.substring(start, end));
    }
    
    console.log(`🔄 Processing ${chunks.length} chunks...`);
    
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`  📑 Processing chunk ${i + 1}/${chunks.length}...`);
      const result = await analyzeSingleChunk(chunks[i], fileName, i + 1, chunks.length, apiKey);
      results.push(result);
    }
    
    return mergeAnalysisResults(results, fileName);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  return new Promise<void>((resolve) => {
    const form = new multiparty.Form();
    
    form.parse(req as any, async (err: any, fields: any, files: any) => {
      let tempFilePath: string | null = null;

      try {
        if (err) throw new Error(`File upload error: ${err.message}`);
        
        const fileArray = files.file;
        if (!fileArray || fileArray.length === 0) {
          throw new Error('No file uploaded');
        }

        const file = fileArray[0];
        tempFilePath = file.path;
        const fileName = fields.fileName?.[0] || file.originalFilename || 'document';
        const fileExtension = path.extname(fileName).toLowerCase();

        console.log(`📎 Processing: ${fileName} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        let text = '';

        if (fileExtension === '.pdf') {
          const dataBuffer = fs.readFileSync(tempFilePath);
          const pdfData = await pdfParse(dataBuffer);
          text = pdfData.text;
        } else if (fileExtension === '.docx') {
          const result = await mammoth.extractRawText({ path: tempFilePath });
          text = result.value;
        } else {
          throw new Error('Unsupported file type. Use PDF or DOCX.');
        }

        console.log(`📑 Extracted ${text.length} characters`);

        if (!text || text.trim().length < 50) {
          throw new Error('No text extracted from document');
        }

        // Get API key from environment
        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`🔑 API Key status: ${apiKey ? 'Found (length: ' + apiKey.length + ')' : 'NOT FOUND'}`);
        
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not configured. Please set it in Vercel Environment Variables.');
        }

        console.log(`🚀 Starting Gemini analysis...`);

        const analysisResult = await analyzeWithGemini(text, fileName, apiKey);
        console.log(`✅ Analysis complete!`);

        res.status(200).json({
          success: true,
          data: analysisResult
        });

      } catch (error) {
        console.error('❌ Analysis error:', (error as Error).message);
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log('🗑️  Temp file cleaned up');
        }
        resolve();
      }
    });
  });
}
