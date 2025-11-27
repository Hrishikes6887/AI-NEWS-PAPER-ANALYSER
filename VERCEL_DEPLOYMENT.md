# 🚀 VERCEL DEPLOYMENT GUIDE

## ✅ PRE-DEPLOYMENT CHECKLIST

Your project is **READY TO DEPLOY**! All files have been configured:

- ✅ `api/analyze.ts` - Vercel serverless function (replaces backend server)
- ✅ `vercel.json` - Vercel configuration (300s timeout, 1GB memory)
- ✅ `package.json` - Updated with backend dependencies
- ✅ `.gitignore` - Configured to exclude .env, uploads/, .vercel/
- ✅ Git initialized and first commit created

---

## 📋 STEP-BY-STEP DEPLOYMENT

### **Step 1: Push to GitHub**

1. Create a new repository on GitHub:

   - Go to https://github.com/new
   - Name it: `upsc-current-affairs-analyzer` (or any name)
   - **DO NOT** initialize with README (you already have one)
   - Click "Create repository"

2. Copy the remote URL (should look like: `https://github.com/YOUR_USERNAME/upsc-current-affairs-analyzer.git`)

3. Push your code:

```bash
cd "f:/NEW DOWNLOADS/project-bolt-sb1-ns1pk818 (1)/project"
git remote add origin https://github.com/YOUR_USERNAME/upsc-current-affairs-analyzer.git
git branch -M main
git push -u origin main
```

---

### **Step 2: Deploy to Vercel**

#### **Option A: Via Vercel Dashboard (Recommended)**

1. Go to https://vercel.com/new

2. Click **"Import Git Repository"**

3. Select your GitHub repository: `upsc-current-affairs-analyzer`

4. Configure Project:

   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

5. **Add Environment Variables** (CRITICAL):

   - Click **"Environment Variables"**
   - Add variable:
     - **Name**: `VITE_GEMINI_API_KEY`
     - **Value**: `AIzaSyAAqtoWo0-AXdKcF2Wm6se7BF5L2b3wNb0`
     - **Environment**: Check all (Production, Preview, Development)
   - Click **"Add"**

6. Click **"Deploy"**

7. Wait 2-3 minutes for deployment

8. Click on the deployed URL (e.g., `https://your-project.vercel.app`)

9. **Test the deployment**:
   - Upload a PDF file
   - Check if analysis works
   - Verify all categories show items

---

#### **Option B: Via Vercel CLI**

1. Install Vercel CLI:

```bash
npm install -g vercel
```

2. Login to Vercel:

```bash
vercel login
```

- Follow the browser authentication

3. Deploy:

```bash
cd "f:/NEW DOWNLOADS/project-bolt-sb1-ns1pk818 (1)/project"
vercel
```

- Link to existing project? **No**
- Project name? **upsc-current-affairs-analyzer**
- Directory? **./project** (press Enter)
- Override settings? **No**

4. Add environment variable:

```bash
vercel env add VITE_GEMINI_API_KEY
```

- When prompted, paste: `AIzaSyAAqtoWo0-AXdKcF2Wm6se7BF5L2b3wNb0`
- Select environments: **Production, Preview, Development** (select all)

5. Deploy to production:

```bash
vercel --prod
```

6. Copy the production URL and test it!

---

## 🔍 POST-DEPLOYMENT VERIFICATION

### Test Checklist:

1. ✅ Frontend loads correctly
2. ✅ File upload works (drag-drop or choose file)
3. ✅ Analysis completes without errors
4. ✅ All 9 categories show data
5. ✅ Items can be edited
6. ✅ Bookmarking works
7. ✅ Export to PDF/DOCX works

### Common Issues & Solutions:

#### Issue 1: "VITE_GEMINI_API_KEY not configured"

**Solution**:

- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add `VITE_GEMINI_API_KEY` = `AIzaSyAAqtoWo0-AXdKcF2Wm6se7BF5L2b3wNb0`
- Click "Save"
- Go to Deployments tab → Click "..." → "Redeploy"

#### Issue 2: Function timeout (>300s)

**Solution**:

- Large PDFs may timeout
- Edit `vercel.json` and increase `maxDuration` to 600
- Recommit and redeploy

#### Issue 3: 500 Internal Server Error

**Solution**:

- Check Vercel Logs: Dashboard → Your Project → Logs
- Look for error messages
- Common causes: Missing dependencies, API key issues

---

## 📊 Deployment Architecture

```
User Browser
     ↓
Vercel CDN (Static Files - Frontend)
     ↓
/api/analyze → Vercel Serverless Function
     ↓
Gemini 2.0 Flash API
     ↓
Response with Categorized News Items
```

---

## 🔐 Environment Variables Reference

| Variable              | Value                                     | Description                |
| --------------------- | ----------------------------------------- | -------------------------- |
| `VITE_GEMINI_API_KEY` | `AIzaSyAAqtoWo0-AXdKcF2Wm6se7BF5L2b3wNb0` | Your Google Gemini API key |

**IMPORTANT**: Never commit `.env` file to Git! It's already in `.gitignore`.

---

## 🎯 Production URL

After deployment, your app will be available at:

- **Production**: `https://your-project.vercel.app`
- **Preview**: `https://your-project-git-branch.vercel.app` (for each branch)

---

## 🔄 Future Updates

To deploy changes:

1. Make your code changes
2. Commit and push to GitHub:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

3. Vercel will **automatically redeploy** (no manual action needed!)

---

## 📞 Support

- **Vercel Docs**: https://vercel.com/docs
- **Gemini API Docs**: https://ai.google.dev/docs
- **Project Issues**: Check Vercel logs for detailed error messages

---

## ✅ YOU'RE READY TO DEPLOY!

Choose your preferred method (Dashboard or CLI) and follow the steps above. Good luck! 🚀
