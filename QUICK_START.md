# UPSC Current Affairs Analyzer - Quick Start Guide

## 🚀 Setup (5 minutes)

### 1. Set Gemini API Key
```bash
# In Supabase Dashboard → Edge Functions → analyze-document → Settings
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Verify Environment Variables
Check `.env` file has:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Deploy Edge Function (if not already deployed)
The Edge Function is at: `supabase/functions/analyze-document/index.ts`

## 🎯 Usage

### Option 1: Test with Demo (Already Integrated)
1. Run `npm run dev`
2. Navigate to Landing Page
3. Click "Proceed to Analysis"
4. System automatically uses test file path
5. View analysis results in UI

### Option 2: Upload Real PDF
1. On Landing Page, drag-drop PDF or click "Choose File"
2. Select PDF/DOCX file (max 50MB)
3. Click "Proceed to Analysis"
4. Wait for analysis (up to 2 minutes)
5. View categorized news items

## 📊 What You'll See

### Categories (9 total):
- **Polity** - Government, Constitution, Laws
- **Economy** - Budget, Trade, Finance
- **International Relations** - Diplomacy, Foreign Policy
- **Science & Tech** - Innovation, Research
- **Environment** - Climate, Ecology
- **Geography** - Physical, Human Geography
- **Culture** - Arts, Heritage, Society
- **Security** - Defense, Internal Security
- **Miscellaneous** - Other topics

### News Item Card:
```
┌─────────────────────────────────────────┐
│ 📰 Article Title                        │
│ Category: Polity | Confidence: 85%     │
├─────────────────────────────────────────┤
│ 1. First analytical point (2-3 lines)  │
│ 2. Second analytical point              │
│ 3. Third analytical point               │
│                                         │
│ References: Page 3 - "excerpt..."      │
├─────────────────────────────────────────┤
│ [Copy] [Edit] [Bookmark] [Download]    │
└─────────────────────────────────────────┘
```

## ✏️ Features You Can Use

### Inline Editing:
- **Click title** to edit
- **Hover over point** to show edit/copy/revert buttons
- **Press Enter** to save
- **Press Escape** to cancel

### Copy Options:
- Copy individual points
- Copy entire card
- Copy all items in category
- Format: Plain text, ready for PPT/notes

### Export Options:
- **PDF** - Formatted document with bullets
- **DOCX** - Word document with headings
- **JSON** - Raw data for programmatic use
- **PPT JSON** - Special format for slides

### Bookmarking:
- Click bookmark icon to save favorites
- Bookmarks persist during session

## 🐛 Troubleshooting

### "GEMINI_API_KEY not configured"
→ Add API key in Supabase Edge Function settings

### "Analysis failed: 400"
→ File type not supported (use PDF or DOCX only)
→ File size exceeds 50MB

### "Analysis failed: 500"
→ Check Edge Function logs in Supabase
→ Verify Gemini API key is valid
→ Check API quota/rate limits

### No items showing
→ Check if document has text (not scanned images)
→ Review confidence threshold (default: 0.5)
→ Try different category filter

### Loading forever
→ Check browser console for errors
→ Verify network connection
→ Check Supabase Edge Function status

## 🔍 Debugging

### Browser Console:
```javascript
// Should see these logs:
Starting analysis for test file: the-hindu-2025-11-18.pdf
Calling edge function: https://...
Response status: 200
Analysis result: { success: true, ... }
Analysis stored successfully
```

### Edge Function Logs (Supabase Dashboard):
```
[INIT] Processing file...
[EXTRACT_PDF_OK] Extracted 15 chunks
[GEMINI_CALL_OK] Received 8500 chars
[PARSE_OK] Validated 23 items
[SUCCESS] Analysis completed
```

## 📁 File Locations

```
project/
├── supabase/functions/analyze-document/
│   └── index.ts                    ← Backend logic
├── src/
│   ├── pages/
│   │   ├── Landing.tsx            ← Upload page
│   │   └── Analysis.tsx           ← Results page
│   ├── components/
│   │   ├── CategorySidebar.tsx    ← Category filter
│   │   └── NewsItemCard.tsx       ← Item display
│   ├── lib/
│   │   ├── prompts.ts             ← AI prompts
│   │   ├── api.ts                 ← API client
│   │   └── exportUtils.ts         ← Export logic
│   └── store/
│       └── analysisStore.ts       ← State management
└── DEBUGGING_IMPROVEMENTS.md      ← Full tech docs
```

## 🎨 Customization

### Change Categories:
Edit `CATEGORIES` array in:
- `supabase/functions/analyze-document/index.ts`
- `src/lib/prompts.ts`

### Adjust Chunking:
Modify constants in Edge Function:
```typescript
WORDS_PER_CHUNK = 1200;  // Words per chunk
MAX_CHUNK_TOKENS = 1800; // Token limit
```

### Change Confidence Threshold:
In `NewsItemCard.tsx`, filter items:
```typescript
items.filter(item => item.confidence >= 0.7)
```

### Customize Prompt:
Edit `buildUPSCGeminiPrompt()` in `src/lib/prompts.ts`

## 🚀 Performance Tips

1. **Smaller Files**: Analyze 10-20 page documents for faster results
2. **Category Filter**: Use specific category for focused analysis
3. **Batch Processing**: Upload multiple files sequentially
4. **Cache Results**: Store analysis JSON locally for offline access

## 📚 Next Steps

1. **Test with Real PDF**: Upload actual newspaper PDF
2. **Review Results**: Check accuracy and relevance
3. **Adjust Prompts**: Fine-tune for better extraction
4. **Enable Caching**: Store results in Supabase Storage
5. **Add Authentication**: Implement user accounts

## ⚙️ Advanced Configuration

### Environment Variables:
```env
VITE_SUPABASE_URL=          # Required
VITE_SUPABASE_ANON_KEY=     # Required
GEMINI_API_KEY=             # Set in Edge Function
```

### Build & Deploy:
```bash
npm run build               # Build for production
npm run preview             # Preview production build
```

---

**Need Help?** Check `DEBUGGING_IMPROVEMENTS.md` for detailed technical docs.

**Ready to Go!** 🎉
