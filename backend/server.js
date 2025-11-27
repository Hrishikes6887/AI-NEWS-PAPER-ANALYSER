// Local Backend Server for PDF Analysis
// Run with: node server.js

require('dotenv').config({ path: '../.env' });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }
});
const PORT = 3001;

app.use(cors());
app.use(express.json());

// UPSC Categories
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

// Main analysis endpoint
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileName = req.body.fileName || req.file.originalname;
    const fileExtension = fileName.toLowerCase().split('.').pop();

    console.log(`Processing file: ${fileName} (${fileExtension})`);

    let text = '';

    // Extract text based on file type
    if (fileExtension === 'pdf') {
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (fileExtension === 'docx') {
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value;
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Unsupported file type' });
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ success: false, error: 'No text extracted from document' });
    }

    console.log(`Extracted ${text.length} characters`);

    // Call Gemini AI for analysis
    const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'VITE_GEMINI_API_KEY not configured in .env file' 
      });
    }

    const analysisResult = await analyzeWithGemini(text, fileName, geminiApiKey);

    return res.json({
      success: true,
      data: analysisResult
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed'
    });
  }
});

// Call Gemini AI with correct format
async function callGemini(prompt, retries = 2) {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`🤖 Calling Gemini AI (attempt ${attempt + 1})...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 16384, // Increased from 8192 to handle more items
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini API Error:', errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0]) {
        console.error('❌ Invalid Gemini response:', JSON.stringify(data, null, 2));
        throw new Error('Invalid response structure from Gemini');
      }

      const text = data.candidates[0].content.parts[0].text;
      console.log(`✅ Gemini response received (${text.length} chars)`);
      return text;

    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
      if (attempt === retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Main analysis endpoint
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    console.log('📄 Starting document analysis...');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    filePath = req.file.path;
    const fileName = req.body.fileName || req.file.originalname;
    const fileType = path.extname(fileName).toLowerCase();

    console.log(`📎 File: ${fileName} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Extract text
    let text = '';
    if (fileType === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (fileType === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else {
      throw new Error('Unsupported file type. Use PDF or DOCX.');
    }

    console.log(`📑 Extracted ${text.length} characters`);

    if (!text || text.trim().length < 50) {
      throw new Error('No text extracted from document');
    }

    // Call Gemini for analysis
    const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      throw new Error('VITE_GEMINI_API_KEY not configured in .env file');
    }

    const analysisResult = await analyzeWithGemini(text, fileName);
    console.log(`✅ Analysis complete!`);

    res.json({
      success: true,
      data: analysisResult
    });

  } catch (error) {
    console.error('❌ Analysis error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️  Temp file cleaned up');
    }
  }
});

async function analyzeWithGemini(text, fileName) {
  console.log(`📄 Total text length: ${text.length} characters`);
  
  // Process in chunks if text is very large
  const maxChars = 100000; // Increased from 30k to 100k for better coverage
  const chunkSize = 50000;
  
  if (text.length <= maxChars) {
    console.log(`✅ Processing single chunk (${text.length} chars)`);
    return await analyzeSingleChunk(text, fileName, 1, 1);
  } else {
    // Split into multiple chunks for large PDFs
    console.log(`📊 Large document detected, splitting into chunks...`);
    const numChunks = Math.ceil(text.length / chunkSize);
    const chunks = [];
    
    for (let i = 0; i < numChunks && i < 3; i++) { // Max 3 chunks
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.substring(start, end));
    }
    
    console.log(`🔄 Processing ${chunks.length} chunks...`);
    
    // Process each chunk and merge results
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`  📑 Processing chunk ${i + 1}/${chunks.length}...`);
      const result = await analyzeSingleChunk(chunks[i], fileName, i + 1, chunks.length);
      results.push(result);
    }
    
    // Merge all results
    return mergeAnalysisResults(results, fileName);
  }
}

function mergeAnalysisResults(results, fileName) {
  console.log(`🔗 Merging ${results.length} chunk results...`);
  
  const merged = {
    source_file: fileName,
    categories: {}
  };
  
  // Initialize all categories
  CATEGORIES.forEach(cat => {
    merged.categories[cat] = [];
  });
  
  // Merge items from all chunks
  results.forEach(result => {
    if (result && result.categories) {
      Object.keys(result.categories).forEach(cat => {
        if (merged.categories[cat] && result.categories[cat]) {
          merged.categories[cat].push(...result.categories[cat]);
        }
      });
    }
  });
  
  // Remove duplicates based on title similarity
  Object.keys(merged.categories).forEach(cat => {
    const items = merged.categories[cat];
    const unique = [];
    const seenTitles = new Set();
    
    items.forEach(item => {
      const normalizedTitle = item.title.toLowerCase().substring(0, 50);
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        unique.push(item);
      }
    });
    
    merged.categories[cat] = unique;
  });
  
  const totalItems = Object.values(merged.categories).reduce((sum, items) => sum + items.length, 0);
  console.log(`✅ Merged result: ${totalItems} unique items`);
  
  return merged;
}

async function analyzeSingleChunk(text, fileName, chunkNum, totalChunks) {
  const truncatedText = text.substring(0, 50000); // Use up to 50k chars per chunk
  
  const chunkInfo = totalChunks > 1 ? ` (Chunk ${chunkNum}/${totalChunks})` : '';
  
  const prompt = `You are an expert UPSC Current Affairs Analyst. Analyze the newspaper text below and extract ALL relevant news items${chunkInfo}.

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no explanations
2. Categorize into: polity, economy, international_relations, science_tech, environment, geography, culture, security, misc
3. **IMPORTANT: Extract AT LEAST 10-15 news items PER CATEGORY if available in the text**
4. Each item needs: title (concise, max 100 chars), points (2-4 key bullet points), references (array with page and excerpt), confidence (0-1)
5. Include items with confidence >= 0.5 (lowered threshold for better coverage)
6. Be thorough - don't miss any news items, even smaller ones
7. If a category has no relevant content, return empty array []

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
    const response = await callGemini(prompt);
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Ensure all categories exist
    CATEGORIES.forEach(cat => {
      if (!parsed.categories[cat]) {
        parsed.categories[cat] = [];
      }
    });

    return parsed;

  } catch (error) {
    console.error('Gemini parsing error:', error.message);
    // Return fallback structure
    const fallback = {
      source_file: fileName,
      categories: {}
    };
    
    CATEGORIES.forEach(cat => {
      fallback.categories[cat] = [];
    });
    
    fallback.categories.polity = [{
      title: 'Error: Could not analyze with Gemini AI',
      points: [
        `Error: ${error.message}`,
        'Please check your VITE_GEMINI_API_KEY in .env file',
        'Get your key from: https://ai.google.dev/'
      ],
      references: [{ page: 1, excerpt: 'Error occurred during analysis' }],
      confidence: 0.5
    }];
    
    return fallback;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    geminiConfigured: !!process.env.VITE_GEMINI_API_KEY,
    apiKey: process.env.VITE_GEMINI_API_KEY ? '✓ Configured' : '✗ Missing'
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Local backend server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/analyze`);
  console.log(`🔑 Gemini API Key: ${process.env.VITE_GEMINI_API_KEY ? '✓ Configured' : '✗ Missing'}\n`);
});
