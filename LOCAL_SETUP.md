# 🚀 Local Setup Guide - UPSC Current Affairs Analyzer

## ✅ Refactoring Complete!

**All Supabase dependencies have been removed.** The project now uses a local Node.js backend with Express.

---

## 📋 What Changed

### ✅ Removed:

- ❌ Supabase Edge Functions
- ❌ `@supabase/supabase-js` dependency
- ❌ `VITE_SUPABASE_URL` environment variable
- ❌ `VITE_SUPABASE_ANON_KEY` environment variable
- ❌ All references to `/functions/v1/analyze-document`

### ✅ Added:

- ✅ Local Express.js backend (`server.js`)
- ✅ Local `/api/analyze` endpoint
- ✅ Direct Gemini AI integration in backend
- ✅ `VITE_GEMINI_API_KEY` environment variable
- ✅ Express, CORS, Multer dependencies

---

## 🛠️ Setup Instructions

### Step 1: Install Dependencies

```bash
npm install
```

This installs:

- **Frontend:** React, Vite, Tailwind, Zustand
- **Backend:** Express, Multer, CORS, PDF-parse, Mammoth
- **Dev Tools:** Concurrently (to run both servers)

---

### Step 2: Configure Gemini API Key

Edit `.env` file and add your Gemini API key:

```env
VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here
VITE_GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
```

**Get your key from:** https://ai.google.dev/

---

### Step 3: Run the Project

You have **3 options**:

#### Option A: Run Both Servers Simultaneously (Recommended)

```bash
npm run dev:full
```

This starts:

- ✅ Backend server on `http://localhost:3001`
- ✅ Frontend dev server on `http://localhost:5173`

#### Option B: Run Separately (Two Terminals)

**Terminal 1 (Backend):**

```bash
npm run server
```

**Terminal 2 (Frontend):**

```bash
npm run dev
```

#### Option C: Frontend Only (Uses Mock Data)

```bash
npm run dev
```

**Note:** Without backend, you'll see mock analysis results.

---

## 🎯 How It Works Now

### Upload Flow:

```
1. User uploads PDF/DOCX → FileUpload.tsx
2. Frontend sends to → POST /api/analyze
3. Vite proxy forwards to → http://localhost:3001/api/analyze
4. Backend (server.js):
   - Extracts text from PDF/DOCX
   - Calls Gemini AI API
   - Returns structured JSON
5. Frontend displays → Analysis.tsx
```

### API Endpoint:

- **URL:** `POST /api/analyze`
- **Body:** `FormData` with `file` and `fileName`
- **Response:**

```json
{
  "success": true,
  "data": {
    "source_file": "document.pdf",
    "categories": {
      "polity": [...],
      "economy": [...],
      ...
    }
  }
}
```

---

## 📁 Modified Files

### Frontend:

- ✅ `src/lib/api.ts` - Now calls `/api/analyze` instead of Supabase
- ✅ `src/pages/Landing.tsx` - Removed Supabase auth headers
- ✅ `vite.config.ts` - Added proxy for `/api` routes

### Backend:

- ✅ `server.js` - New Express server with PDF/DOCX processing
- ✅ `.env` - Updated environment variables
- ✅ `package.json` - Added Express, Multer, CORS, Concurrently

### Configuration:

- ✅ `.gitignore` - Added `uploads/` directory
- ✅ Removed all Supabase references

---

## 🧪 Testing

1. **Start both servers:**

   ```bash
   npm run dev:full
   ```

2. **Open browser:**

   ```
   http://localhost:5173
   ```

3. **Upload a PDF:**

   - Max size: 50MB
   - Formats: PDF, DOCX

4. **Wait for analysis:**

   - Processing time: 30-120 seconds
   - Uses Gemini AI for categorization

5. **View results:**
   - 9 UPSC categories
   - Editable content
   - Export to PDF/DOCX/JSON

---

## 🐛 Troubleshooting

### Issue: "Analysis failed (404)"

**Solution:** Backend server is not running. Run:

```bash
npm run server
```

### Issue: "VITE_GEMINI_API_KEY not configured"

**Solution:** Add your API key to `.env` file

### Issue: "Empty response from Gemini"

**Solution:**

- Check API key is valid
- Check API quota/rate limits
- Try with a smaller PDF

### Issue: "Port 3001 already in use"

**Solution:** Change port in `server.js`:

```javascript
const PORT = 3002; // Change this
```

### Issue: "No text extracted from document"

**Solution:**

- PDF might be scanned images (not text-based)
- Try OCR tool first to convert to text PDF
- Use DOCX instead

---

## 📊 Commands Reference

| Command            | Description              |
| ------------------ | ------------------------ |
| `npm install`      | Install all dependencies |
| `npm run dev`      | Start frontend only      |
| `npm run server`   | Start backend only       |
| `npm run dev:full` | Start both servers       |
| `npm run build`    | Build for production     |
| `npm run lint`     | Run ESLint               |

---

## 🎉 Success!

Your project now runs **100% locally** without Supabase.

**Next Steps:**

1. ✅ Run `npm install`
2. ✅ Add Gemini API key to `.env`
3. ✅ Run `npm run dev:full`
4. ✅ Upload a PDF and test

---

## 📝 Notes

- **No Supabase account needed** ✅
- **No cloud deployment required** ✅
- **All processing happens locally** ✅
- **Gemini API is the only external service** ✅

**Questions?** Check the error messages in both terminal windows for debugging.
