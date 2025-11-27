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
        console.error('❌ Gemini API Error:', errorText);
        
        // Check for rate limiting
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 403) {
          throw new Error('API key invalid or quota exceeded. Check your Gemini API key.');
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

// Analyze single chunk
async function analyzeSingleChunk(text: string, fileName: string, chunkNum: number, totalChunks: number, apiKey: string) {
  const truncatedText = text.substring(0, 40000); // Reduced from 50k to 40k for faster processing
  const chunkInfo = totalChunks > 1 ? ` (Chunk ${chunkNum}/${totalChunks})` : '';
  
  const prompt = `You are an expert UPSC Current Affairs Analyst. Analyze the text and extract relevant news items${chunkInfo}.

RULES:
1. Return ONLY valid JSON, no markdown
2. Categories: polity, economy, international_relations, science_tech, environment, geography, culture, security, misc
3. Extract 8-12 news items PER CATEGORY if available
4. Each item: title (max 80 chars), points (2-3 bullets), references [{page, excerpt}], confidence (0-1)
5. Include items with confidence >= 0.5
6. Empty array [] if no content for category

TEXT TO ANALYZE (${truncatedText.length} chars)${chunkInfo}:
${truncatedText}

Return JSON in this exact format:
{
  "source_file": "${fileName}",
  "categories": {
    "polity": [{"title": "Brief title", "points": ["Point 1", "Point 2"], "references": [{"page": 1, "excerpt": "First 80 chars..."}], "confidence": 0.75}],
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

Remember: Extract ALL relevant news items thoroughly. Aim for 10-15 items per category where possible.`;

  try {
    const response = await callGemini(prompt, apiKey);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON found in Gemini response');

    const parsed = JSON.parse(jsonMatch[0]);
    
    CATEGORIES.forEach(cat => {
      if (!parsed.categories[cat]) parsed.categories[cat] = [];
    });

    return parsed;
  } catch (error) {
    const fallback: any = { source_file: fileName, categories: {} };
    CATEGORIES.forEach(cat => fallback.categories[cat] = []);
    
    fallback.categories.polity = [{
      title: 'Error: Could not analyze with Gemini AI',
      points: [
        `Error: ${(error as Error).message}`,
        'Please check your VITE_GEMINI_API_KEY environment variable'
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
  
  // Remove duplicates
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

        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('VITE_GEMINI_API_KEY not configured');
        }

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
