// Vercel Serverless Function for PDF/DOCX Analysis with Gemini AI
// OPTIMIZED FOR GEMINI 2.0 FLASH (Paid Tier)
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

// 🔒 GLOBAL LOCK: Prevent concurrent processing for stability
// Ensures one analysis at a time to avoid overloading serverless function
let isProcessing = false;
let lastRequestTime = 0;

// Cooldown between requests - prevents API abuse and ensures stability
// Paid tier supports higher rates, but we enforce cooldown for reliability
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds cooldown for paid tier

// ⚠️ STRICT PRODUCTION LIMITS - Enforced for reliability and stability
// Hard limits to prevent Gemini API failures, timeouts, and rate limiting
const MAX_FILE_SIZE_MB = 10; // 10MB hard limit - no exceptions
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_PAGES = 12; // Maximum 12 pages - strictly enforced
const MIN_TEXT_LENGTH = 1000; // Minimum chars to consider PDF text-based (not scanned)

// Call Gemini AI with smart retry logic
// Paid tier has higher limits, but we still handle errors gracefully
async function callGemini(prompt: string, apiKey: string, retries = 2): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`🤖 Calling Gemini AI (attempt ${attempt + 1})...`);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout for large newspapers
      
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
            maxOutputTokens: 8192, // Gemini 2.0 Flash supports 8192 output tokens
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
        
        // 🚨 Handle rate limits and auth errors with user-friendly messages
        if (response.status === 429) {
          const error = new Error('RATE_LIMIT_HIT') as any;
          error.statusCode = 429;
          error.userMessage = 'The AI analysis service is currently at capacity. This happens during peak usage. Please wait 30-60 seconds and try again. Your file has been validated and is ready to process.';
          throw error;
        }
        
        if (response.status === 403) {
          const error = new Error('API_KEY_INVALID') as any;
          error.statusCode = 403;
          error.userMessage = 'The analysis service is temporarily experiencing issues. Please try again in 2-3 minutes. If this continues, please contact your mentor or administrator.';
          throw error;
        }
        
        if (response.status === 400) {
          const error = new Error('BAD_REQUEST') as any;
          error.statusCode = 400;
          error.userMessage = `Invalid request to Gemini API. The document may be too complex or contain unsupported content.`;
          throw error;
        }
        
        // Other errors - throw and allow retry
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]) {
        throw new Error('Invalid response structure from Gemini');
      }

      const text = data.candidates[0].content.parts[0].text;
      console.log(`✅ Gemini response received (${text.length} chars)`);
      return text;

    } catch (error: any) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
      
      // 🚨 Don't retry on rate limits, API key errors, or bad requests
      if (error.statusCode === 429 || error.statusCode === 403 || error.statusCode === 400) {
        throw error;
      }
      
      // Retry only on network/timeout errors
      if (attempt === retries) throw error;
      
      // Exponential backoff for network retries
      const delay = Math.min(3000 * Math.pow(2, attempt), 10000);
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

// FIX-1: Smart text extraction with hard cap (TEXT length, not file size)
// Extract text from PDF and cap at safe limit before sending to Gemini
async function analyzeSingleChunk(text: string, fileName: string, apiKey: string) {
  // 🎯 Gemini 2.0 Flash: 1M token context (paid tier)
  // Production limit: Cap at 60K chars for optimal performance and cost
  // This equals ~15K tokens - fast, reliable, covers typical newspapers
  const MAX_CHARS = 60000; // Safe limit: fast analysis, complete coverage
  const truncatedText = text.substring(0, MAX_CHARS);
  const wasTruncated = text.length > MAX_CHARS;
  
  console.log(`📄 Processing: ${truncatedText.length} chars${wasTruncated ? ' (truncated from ' + text.length + ')' : ''}`);
  
  const prompt = `You are an expert UPSC Current Affairs Analyst. Analyze the text and extract exam-relevant news items.

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

3. MINIMUM 5 POINTS PER NEWS ITEM (MANDATORY):
   - Each news item MUST have AT LEAST 5 bullet points
   - Points should include diverse content:
     * Numerical facts (budget allocations, targets, percentages, dates)
     * Policy implications (impact on governance, sectors, citizens)
     * Background/context (why this matters, historical significance)
     * Implementation details (timeline, responsible agencies, mechanisms)
     * UPSC exam relevance (which syllabus topics, prelims/mains linkage)
   - If direct facts are limited, infer logical context from the article
   - DO NOT restrict points to only numerical data - include analysis and context

4. MAXIMUM EXTRACTION - NO CAPS:
   - Extract ALL exam-relevant news items per category
   - Do NOT limit yourself to 8-12 items - extract everything useful
   - Let the mentors and students decide what to use
   - Only exclude items that are clearly irrelevant to UPSC preparation

5. ENHANCED REFERENCES:
   - Extract: newspaper name, date (DD-MM-YYYY), exact headline, page number, 1-2 line excerpt
   - References must be verifiable and classroom-ready

OUTPUT FORMAT:
- Return ONLY valid JSON, no markdown
- Categories: polity, economy, international_relations, science_tech, environment, geography, culture, security, misc
- Extract ALL news items per category (no arbitrary caps)
- Include items with confidence >= 0.5
- Empty array [] if no content for category
- EVERY item must have minimum 5 points

TEXT TO ANALYZE (${truncatedText.length} chars):
${truncatedText}

Return JSON in this EXACT format:
{
  "source_file": "${fileName}",
  "categories": {
    "polity": [
      {
        "title": "Brief title (max 80 chars)",
        "points": [
          "Point 1: Numerical fact with context (e.g., ₹500 crore allocated for scheme X covering 10 districts)",
          "Point 2: Policy implication (e.g., This strengthens rural healthcare infrastructure under National Health Mission)",
          "Point 3: Background context (e.g., Part of government's push to achieve SDG 3 targets by 2030)",
          "Point 4: Implementation detail (e.g., State governments to execute through district health committees)",
          "Point 5: UPSC relevance (e.g., Important for GS Paper 2 - Health governance and Paper 3 - Social sector schemes)"
        ],
        "references": [
          {
            "newspaper": "The Hindu",
            "date": "07-01-2026",
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

Remember: 
- MINIMUM 5 POINTS per item (mandatory)
- Extract ALL relevant news (no caps)
- Focus on exam-relevant substance with verifiable data
- Filter political noise
- Prioritize numerical facts but include context and analysis too`;

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
  } catch (error: any) {
    // Re-throw structured errors from callGemini
    if (error.statusCode) {
      throw error;
    }
    
    // Handle parsing/other errors
    const fallback: any = { source_file: fileName, categories: {} };
    CATEGORIES.forEach(cat => fallback.categories[cat] = []);
    
    fallback.categories.polity = [{
      title: 'Error: Could not analyze with Gemini AI',
      points: [
        `Error: ${error.message}`,
        'Please check your GEMINI_API_KEY environment variable in Vercel'
      ],
      references: [{ page: 1, excerpt: 'Error occurred during analysis' }],
      confidence: 0.5,
      hasNumbers: false,
      numericHighlights: [],
      priorityScore: 0.5
    }];
    
    return fallback;
  }
}

// FIX-3: Ensure exactly ONE Gemini API call per PDF
// Single-call approach ensures reliability and predictable cost
async function analyzeWithGemini(text: string, fileName: string, apiKey: string) {
  console.log(`📄 Total text length: ${text.length} characters`);
  
  // FIX-4: Detect image-based/scanned PDFs with improved thresholds
  const trimmedText = text.trim();
  
  // More sophisticated detection for scanned/image PDFs
  if (trimmedText.length < MIN_TEXT_LENGTH) {
    const error = new Error('IMAGE_BASED_PDF') as any;
    error.statusCode = 400;
    error.userMessage = `This PDF appears to be scanned or image-based (only ${trimmedText.length} characters extracted). Please upload a text-based PDF for accurate analysis. If you have a scanned PDF, please use OCR software to convert it first.`;
    throw error;
  }
  
  // Additional check: If text is very short relative to file size, likely image-based
  // Typical PDFs have ~2000-3000 chars per page for text-based content
  const expectedMinChars = 1500; // Minimum chars we expect from a valid text-based PDF
  if (trimmedText.length < expectedMinChars) {
    const error = new Error('LIKELY_SCANNED_PDF') as any;
    error.statusCode = 400;
    error.userMessage = `This PDF appears to be scanned or image-based. Text-based PDFs typically contain more extractable text. Please ensure your PDF is text-based (not just scanned images) for accurate analysis.`;
    throw error;
  }
  
  console.log(`✅ Processing document with ONE Gemini API call (production mode)...`);
  return await analyzeSingleChunk(text, fileName, apiKey);
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

  // 🔒 GLOBAL LOCK: Ensure one analysis at a time for serverless function stability
  if (isProcessing) {
    console.log('⚠️  Another analysis is already in progress. Rejecting request.');
    return res.status(429).json({
      success: false,
      error: 'Another newspaper is being analyzed. Please wait 30 seconds and try again.',
      code: 'CONCURRENT_REQUEST_BLOCKED'
    });
  }

  // ⏱️ COOLDOWN: Enforce short delay between requests for system stability
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (lastRequestTime > 0 && timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
    console.log(`⏳ Cooldown active. Last request was ${Math.floor(timeSinceLastRequest / 1000)}s ago.`);
    return res.status(429).json({
      success: false,
      error: `Please wait ${waitTime} seconds before uploading another document.`,
      code: 'COOLDOWN_ACTIVE',
      retryAfter: waitTime
    });
  }

  // Acquire lock and update timestamp
  isProcessing = true;
  lastRequestTime = now;
  console.log('🔓 Lock acquired - starting analysis...');

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
        const fileSizeMB = file.size / (1024 * 1024);

        console.log(`📎 Processing: ${fileName} (${fileSizeMB.toFixed(2)} MB)`);

        // ⚠️ STRICT FILE SIZE ENFORCEMENT - Reject immediately if too large
        if (file.size > MAX_FILE_SIZE_BYTES) {
          const error = new Error('FILE_TOO_LARGE') as any;
          error.statusCode = 400;
          error.userMessage = `File too large. Please upload newspapers up to ${MAX_FILE_SIZE_MB} MB. Your file is ${fileSizeMB.toFixed(1)} MB.`;
          throw error;
        }

        let text = '';
        let pageCount = 0;

        if (fileExtension === '.pdf') {
          const dataBuffer = fs.readFileSync(tempFilePath);
          const pdfData = await pdfParse(dataBuffer);
          text = pdfData.text;
          pageCount = pdfData.numpages;
          
          console.log(`📑 Extracted ${text.length} characters from ${pageCount} pages`);
          
          // ⚠️ STRICT PAGE LIMIT ENFORCEMENT - Hard fail if exceeded
          // Do NOT attempt chunking or partial processing
          if (pageCount > MAX_PAGES) {
            const error = new Error('TOO_MANY_PAGES') as any;
            error.statusCode = 400;
            error.userMessage = `This newspaper has ${pageCount} pages. Maximum allowed is ${MAX_PAGES} pages. Please upload the first ${MAX_PAGES} pages for best results.`;
            throw error;
          }
        } else if (fileExtension === '.docx') {
          const result = await mammoth.extractRawText({ path: tempFilePath });
          text = result.value;
        } else {
          throw new Error('Unsupported file type. Use PDF or DOCX.');
        }

        console.log(`📑 Text extracted successfully (${text.length} characters)`);

        // Enhanced validation for text extraction
        if (!text || text.trim().length < 50) {
          const error = new Error('NO_TEXT_EXTRACTED') as any;
          error.statusCode = 400;
          error.userMessage = 'Could not extract text from this PDF. It may be corrupted, password-protected, or image-based. Please try a different file.';
          throw error;
        }

        // Get API key from environment
        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`🔑 API Key status: ${apiKey ? 'Found (length: ' + apiKey.length + ')' : 'NOT FOUND'}`);
        
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not configured. Please set it in Vercel Environment Variables.');
        }

        console.log(`🚀 Starting Gemini 2.0 Flash analysis (paid tier)...`);

        const analysisResult = await analyzeWithGemini(text, fileName, apiKey);
        console.log(`✅ Analysis complete! Extracted news items successfully.`);

        res.status(200).json({
          success: true,
          data: analysisResult
        });

      } catch (error: any) {
        console.error('❌ Analysis error:', error.message);
        
        // FIX-5: User-friendly, mentor-appropriate error messages
        // Handle file size errors
        if (error.statusCode === 400 && error.message === 'FILE_TOO_LARGE') {
          return res.status(400).json({
            success: false,
            error: error.userMessage || `File too large. Please upload newspapers up to ${MAX_FILE_SIZE_MB} MB.`,
            code: 'FILE_TOO_LARGE'
          });
        }
        
        // Handle page limit errors
        if (error.message === 'TOO_MANY_PAGES' || (error.statusCode === 400 && error.userMessage?.includes('pages'))) {
          return res.status(400).json({
            success: false,
            error: error.userMessage || `This newspaper has too many pages. Maximum allowed is ${MAX_PAGES} pages.`,
            code: 'TOO_MANY_PAGES'
          });
        }
        
        if (error.statusCode === 429) {
          return res.status(429).json({
            success: false,
            error: error.userMessage || 'The AI analysis service is currently at capacity. Please wait 30-60 seconds and try again.',
            code: 'SERVICE_BUSY',
            retryAfter: 45,
            userFriendlyMessage: 'Too many requests right now. Take a short break and try again in about a minute.'
          });
        }
        
        if (error.statusCode === 403) {
          return res.status(403).json({
            success: false,
            error: error.userMessage || 'The analysis service is temporarily experiencing issues. Please try again in a few minutes.',
            code: 'SERVICE_UNAVAILABLE',
            userFriendlyMessage: 'Service temporarily unavailable. Please try again in 2-3 minutes or contact your mentor if this persists.'
          });
        }
        
        if (error.statusCode === 400) {
          return res.status(400).json({
            success: false,
            error: error.userMessage || 'Could not analyze this document. Please ensure it is a valid text-based PDF.',
            code: 'INVALID_DOCUMENT'
          });
        }
        
        // Generic error - professional message without technical details
        res.status(500).json({
          success: false,
          error: 'An unexpected error occurred during analysis. Please try again or contact support if this persists.',
          code: 'ANALYSIS_ERROR'
        });
        
      } finally {
        // 🔒 ALWAYS release lock (critical!)
        isProcessing = false;
        console.log('🔓 Lock released');
        
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log('🗑️  Temp file cleaned up');
        }
        resolve();
      }
    });
  });
}
