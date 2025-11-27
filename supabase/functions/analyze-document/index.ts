import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import pdfParse from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_CHARS_PER_CHUNK = 2000;
const MIN_WORDS_PER_CHUNK = 20;
const EXCERPT_LENGTH = 120;
const GEMINI_TIMEOUT = 25000;
const MAX_RETRIES = 1;
const MIN_CONFIDENCE = 0.55;

interface Chunk {
  id: number;
  page: number;
  text: string;
  excerpt: string;
  wordCount: number;
}

interface NewsItem {
  title: string;
  points: Array<{ text: string; confidence: number }>;
  references: Array<{ page: number; excerpt: string }>;
  confidence: number;
  sourceChunkIds?: number[];
}

interface AnalysisData {
  source_file: string;
  categories: {
    polity: NewsItem[];
    economy: NewsItem[];
    international_relations: NewsItem[];
    science_tech: NewsItem[];
    environment: NewsItem[];
    geography: NewsItem[];
    culture: NewsItem[];
    security: NewsItem[];
    misc: NewsItem[];
  };
  metadata?: {
    chunksUsed: number;
    lowConfidenceCount: number;
    generatedAt: number;
  };
}

interface CategoryMapping {
  [category: string]: number[];
}

const CATEGORIES = [
  "polity",
  "economy",
  "international_relations",
  "science_tech",
  "environment",
  "geography",
  "culture",
  "security",
  "misc",
];

function log(label: string, message: any) {
  console.log(`[${label}]`, typeof message === 'string' ? message : JSON.stringify(message));
}

function sanitizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function extractExcerpt(text: string, maxLength: number = EXCERPT_LENGTH): string {
  const sanitized = sanitizeText(text);
  const lines = sanitized.split('\n').filter(line => line.trim().length > 10);
  const excerpt = lines.slice(0, 2).join(' ').substring(0, maxLength);
  return excerpt || sanitized.substring(0, maxLength);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function chunkText(pages: Array<{ page: number; text: string }>): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkId = 0;

  for (const { page, text } of pages) {
    const sanitized = sanitizeText(text);
    const wordCount = countWords(sanitized);

    if (wordCount < MIN_WORDS_PER_CHUNK) {
      log("CHUNK_SKIP", `Skipping page ${page} (only ${wordCount} words)`);
      continue;
    }

    if (sanitized.length <= MAX_CHARS_PER_CHUNK) {
      chunks.push({
        id: chunkId++,
        page,
        text: sanitized,
        excerpt: extractExcerpt(sanitized, 100),
        wordCount,
      });
    } else {
      const sentences = sanitized.split(/[.!?]\s+/);
      let currentChunk = "";
      let currentWords = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i] + (i < sentences.length - 1 ? ". " : "");
        const sentenceWords = countWords(sentence);

        if (currentChunk.length + sentence.length > MAX_CHARS_PER_CHUNK && currentChunk) {
          chunks.push({
            id: chunkId++,
            page,
            text: currentChunk.trim(),
            excerpt: extractExcerpt(currentChunk, 100),
            wordCount: currentWords,
          });
          currentChunk = sentence;
          currentWords = sentenceWords;
        } else {
          currentChunk += sentence;
          currentWords += sentenceWords;
        }
      }

      if (currentChunk.trim()) {
        chunks.push({
          id: chunkId++,
          page,
          text: currentChunk.trim(),
          excerpt: extractExcerpt(currentChunk, 100),
          wordCount: currentWords,
        });
      }
    }
  }

  log("CHUNK_COMPLETE", `Created ${chunks.length} chunks from ${pages.length} pages`);
  return chunks;
}

async function extractTextFromPDF(fileBuffer: ArrayBuffer): Promise<Array<{ page: number; text: string }>> {
  log("EXTRACT_PDF_START", "Starting PDF extraction");

  const data = await pdfParse(Buffer.from(fileBuffer));
  const fullText = sanitizeText(data.text);

  if (!fullText || fullText.length < 50) {
    throw new Error("PDF extraction failed or file is empty");
  }

  const pages: Array<{ page: number; text: string }> = [];
  const pageTexts = fullText.split('\f');

  if (pageTexts.length > 1) {
    pageTexts.forEach((pageText, index) => {
      const sanitized = sanitizeText(pageText);
      if (sanitized.length > 50) {
        pages.push({ page: index + 1, text: sanitized });
      }
    });
  } else {
    pages.push({ page: 1, text: fullText });
  }

  log("EXTRACT_PDF_OK", `Extracted ${pages.length} pages`);
  return pages;
}

async function extractTextFromDOCX(fileBuffer: ArrayBuffer): Promise<Array<{ page: number; text: string }>> {
  log("EXTRACT_DOCX_START", "Starting DOCX extraction");

  const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
  const text = sanitizeText(result.value);

  if (!text || text.length < 50) {
    throw new Error("DOCX extraction failed or file is empty");
  }

  log("EXTRACT_DOCX_OK", `Extracted ${countWords(text)} words`);
  return [{ page: 1, text }];
}

async function callGemini(prompt: string, geminiApiKey: string, maxTokens: number = 2048): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      log("GEMINI_START", `Attempt ${attempt + 1}, prompt length: ${prompt.length}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              topP: 0.1,
              maxOutputTokens: maxTokens,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gemini API error (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error("Gemini returned empty response");
      }

      log("GEMINI_SUCCESS", `Received ${generatedText.length} chars`);
      return generatedText;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (attempt === MAX_RETRIES) {
        log("GEMINI_FAIL", errorMsg);
        throw error;
      }

      log("GEMINI_RETRY", `Retrying after 400ms: ${errorMsg}`);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  throw new Error("Max retries exceeded");
}

async function classifyPagesForCategories(chunks: Chunk[], geminiApiKey: string): Promise<CategoryMapping> {
  log("CLASSIFY_START", `Classifying ${chunks.length} chunks`);

  const prompt = `You are a UPSC Current Affairs classifier. For each chunk below, identify which UPSC category it belongs to.

CATEGORIES: ${CATEGORIES.join(", ")}

RULES:
- Return ONLY valid JSON
- If a chunk doesn't fit any category clearly, mark it as "misc"
- Format: { "chunkId": category }
- NO explanations, NO markdown

CHUNKS:
${chunks.map(c => `Chunk ${c.id} (Page ${c.page}): ${c.excerpt}...`).join('\n')}

Return JSON mapping chunk IDs to categories. Example:
{ "0": "polity", "1": "economy", "2": "polity" }`;

  try {
    const response = await callGemini(prompt, geminiApiKey, 500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found in classification response");
    }

    const chunkToCategory: { [key: string]: string } = JSON.parse(jsonMatch[0]);
    const categoryMapping: CategoryMapping = {};

    CATEGORIES.forEach(cat => {
      categoryMapping[cat] = [];
    });

    Object.entries(chunkToCategory).forEach(([chunkIdStr, category]) => {
      const chunkId = parseInt(chunkIdStr);
      if (categoryMapping[category]) {
        categoryMapping[category].push(chunkId);
      }
    });

    const totalMapped = Object.values(categoryMapping).reduce((sum, ids) => sum + ids.length, 0);
    log("CLASSIFY_OK", `Mapped ${totalMapped} chunks across ${Object.keys(categoryMapping).filter(k => categoryMapping[k].length > 0).length} categories`);

    return categoryMapping;
  } catch (error) {
    log("CLASSIFY_FALLBACK", "Classification failed, using all chunks for all categories");
    const fallback: CategoryMapping = {};
    CATEGORIES.forEach(cat => {
      fallback[cat] = chunks.map(c => c.id);
    });
    return fallback;
  }
}

function buildCategoryPrompt(category: string, chunks: Chunk[], fileName: string): string {
  return `You are an expert UPSC Current Affairs Analyst. Extract ${category.replace(/_/g, ' ').toUpperCase()} news items from the text below.

CRITICAL HARD RULES:
1. If information is not clearly present in the text, output an empty array for this category
2. Never infer or guess missing facts
3. Never add information not in the text
4. If reference cannot be found, skip the point
5. All points must be backed by excerpts
6. Return ONLY valid JSON, no markdown, no explanations

OUTPUT SCHEMA:
{
  "items": [
    {
      "title": "Concise title from text (max 100 chars)",
      "points": [
        { "text": "Point 1 (2-3 sentences from text)", "confidence": 0.85 },
        { "text": "Point 2 (2-3 sentences from text)", "confidence": 0.90 }
      ],
      "references": [{ "page": number, "excerpt": "First 80 chars from text" }],
      "confidence": 0.87
    }
  ]
}

CONFIDENCE RULES:
- 0.9-1.0: Direct quote, exact match
- 0.7-0.9: Strong inference from text
- 0.55-0.7: Moderate inference
- Below 0.55: DO NOT INCLUDE

SOURCE: ${fileName}
CATEGORY: ${category}

TEXT CHUNKS:
${chunks.map(c => `[Page ${c.page}, Chunk ${c.id}]\n${c.text}\n`).join('\n---\n')}

Return ONLY the JSON object. Start with { and end with }.`;
}

async function extractCategoryItems(
  category: string,
  chunkIds: number[],
  allChunks: Chunk[],
  fileName: string,
  geminiApiKey: string
): Promise<NewsItem[]> {
  if (chunkIds.length === 0) {
    log(`EXTRACT_${category.toUpperCase()}_SKIP`, "No chunks assigned");
    return [];
  }

  const relevantChunks = allChunks.filter(c => chunkIds.includes(c.id));

  log(`EXTRACT_${category.toUpperCase()}_START`, `Processing ${relevantChunks.length} chunks`);

  try {
    const prompt = buildCategoryPrompt(category, relevantChunks, fileName);
    const response = await callGemini(prompt, geminiApiKey, 2000);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const items: NewsItem[] = (parsed.items || []).map((item: any) => ({
      title: item.title || "Untitled",
      points: (item.points || [])
        .filter((p: any) => p.text && p.text.split(/\s+/).length >= 5)
        .map((p: any) => ({
          text: p.text,
          confidence: typeof p.confidence === 'number' ? p.confidence : 0.5
        })),
      references: (item.references || [])
        .filter((r: any) => typeof r.page === 'number')
        .map((r: any) => ({
          page: r.page,
          excerpt: (r.excerpt || "").substring(0, 80)
        })),
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
      sourceChunkIds: chunkIds
    })).filter((item: NewsItem) =>
      item.points.length > 0 &&
      item.confidence >= MIN_CONFIDENCE
    );

    log(`EXTRACT_${category.toUpperCase()}_OK`, `Extracted ${items.length} items`);
    return items;

  } catch (error) {
    log(`EXTRACT_${category.toUpperCase()}_ERROR`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function performTwoPhaseAnalysis(
  chunks: Chunk[],
  fileName: string,
  geminiApiKey: string
): Promise<AnalysisData> {
  log("TWO_PHASE_START", "Beginning two-phase analysis");

  const categoryMapping = await classifyPagesForCategories(chunks, geminiApiKey);

  const activeCategories = Object.entries(categoryMapping)
    .filter(([_, chunkIds]) => chunkIds.length > 0)
    .map(([category]) => category);

  log("PARALLEL_EXTRACT_START", `Processing ${activeCategories.length} categories in parallel`);

  const extractionPromises = activeCategories.map(category =>
    extractCategoryItems(category, categoryMapping[category], chunks, fileName, geminiApiKey)
      .then(items => ({ category, items, success: true }))
      .catch(error => ({ category, items: [], success: false, error }))
  );

  const results = await Promise.allSettled(extractionPromises);

  const categories: any = {};
  CATEGORIES.forEach(cat => {
    categories[cat] = [];
  });

  let lowConfidenceCount = 0;

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.success) {
      const { category, items } = result.value;
      categories[category] = items;
      lowConfidenceCount += items.filter(item => item.confidence < 0.7).length;
    }
  });

  log("TWO_PHASE_COMPLETE", `Extracted items across ${activeCategories.length} categories`);

  const compatibleCategories: any = {};
  CATEGORIES.forEach(cat => {
    compatibleCategories[cat] = categories[cat].map((item: NewsItem) => ({
      title: item.title,
      points: item.points.map(p => p.text),
      references: item.references,
      confidence: item.confidence
    }));
  });

  return {
    source_file: fileName,
    categories: compatibleCategories,
    metadata: {
      chunksUsed: chunks.length,
      lowConfidenceCount,
      generatedAt: Date.now()
    }
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ success: false, error: "Content-Type must be multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileName = (formData.get("fileName") as string) || file?.name || "unknown.pdf";

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileExtension = fileName.toLowerCase().split('.').pop();
    log("INIT", `Processing ${fileName} (${fileExtension}), size: ${file.size} bytes`);

    const fileBuffer = await file.arrayBuffer();
    let pages: Array<{ page: number; text: string }>;

    if (fileExtension === 'pdf') {
      pages = await extractTextFromPDF(fileBuffer);
    } else if (fileExtension === 'docx') {
      pages = await extractTextFromDOCX(fileBuffer);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported file type: ${fileExtension}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chunks = chunkText(pages);

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid text chunks extracted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisData = await performTwoPhaseAnalysis(chunks, fileName, geminiApiKey);

    log("SUCCESS", "Analysis completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisData
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";

    log("ERROR", `${errorMsg}\n${stack}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
