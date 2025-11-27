interface PageContent {
  page: number;
  text: string;
  excerpt: string;
  wordCount?: number;
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

export const buildUPSCGeminiPrompt = (fileName: string, pages: PageContent[], categoryFilter?: string) => {
  const categoriesList = categoryFilter ? [categoryFilter] : CATEGORIES;

  return `You are an expert UPSC Current Affairs Analyst. Analyze the newspaper text below.

CRITICAL RULES:
1. Use ONLY the provided text. NO outside knowledge. NO hallucinations.
2. Return ONLY valid JSON. No markdown, no explanations, ONLY JSON.
3. If a category has no relevant items, use an empty array [].

OUTPUT SCHEMA (exact format):
{
  "source_file": "${fileName}",
  "categories": {
    ${CATEGORIES.map(cat => `"${cat}": []`).join(',\n    ')}
  }
}

Each item in a category array must have:
{
  "title": "Concise title (max 100 chars)",
  "points": ["Point 1 (2-3 sentences)", "Point 2 (2-3 sentences)", "Point 3 (2-3 sentences)"],
  "references": [{"page": number, "excerpt": "First 80 chars of relevant text"}],
  "confidence": 0.85
}

CATEGORIES TO ANALYZE: ${categoriesList.join(", ")}

CONFIDENCE SCORING:
- 0.9-1.0: Direct quote, clear topic match
- 0.7-0.9: Strong inference from text
- 0.5-0.7: Moderate inference
- Below 0.5: DO NOT INCLUDE

EXTRACTED TEXT:
Filename: ${fileName}
Total Pages: ${pages.length}

${pages.map(p => `=== PAGE ${p.page} ===
${p.text}
`).join('\n')}

Return ONLY the JSON object. Start with { and end with }.`;
};
