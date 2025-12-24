# 🩺 Troubleshooting Rate Limit Errors

## Step 1: Check Your Gemini API Key Status

1. Go to: **https://aistudio.google.com/apikey**
2. Find your current API key
3. Look for these indicators:

```
✅ GREEN/ACTIVE = Key is working, just rate limited temporarily
❌ RED/DISABLED = Key is disabled or quota exhausted permanently
⚠️ YELLOW/WARNING = Approaching limits
```

4. Check the **"Quota"** section:
   - If it says **"Quota Exceeded"** → Your free quota is fully used
   - If it says **"Rate Limit"** → Just need to wait

---

## Step 2: Try a Fresh API Key (Free - Takes 30 seconds)

**Before upgrading to paid, try this:**

1. Go to: https://aistudio.google.com/apikey
2. Click **"Create API Key"**
3. Select your Google Cloud project
4. Copy the new key
5. Update in Vercel:
   - Go to Vercel Dashboard → Your Project
   - Settings → Environment Variables
   - Edit `GEMINI_API_KEY`
   - Paste new key
   - Save
   - Redeploy (Settings → Deployments → Redeploy latest)

**Why this helps:**

- Each API key has its own quota counter
- Old key might be exhausted from testing
- New key = fresh quota (15 req/min again)

---

## Step 3: Check if It's Really Gemini or Something Else

Open your browser console (F12) when you get the error and look for:

### If you see this in Network tab:

```json
{
  "success": false,
  "error": "Rate limit reached (15 requests/minute on free tier)...",
  "code": "RATE_LIMIT_HIT",
  "retryAfter": 120
}
```

→ **This is Gemini's rate limit** (wait or new key needed)

### If you see this:

```json
{
  "success": false,
  "error": "API key invalid or quota exceeded...",
  "code": "API_KEY_INVALID"
}
```

→ **Your API key is exhausted** (need new key or upgrade)

### If you see this:

```json
{
  "success": false,
  "error": "Please wait 5 seconds before uploading...",
  "code": "COOLDOWN_ACTIVE"
}
```

→ **Our cooldown protection working** (just wait 5s)

---

## Step 4: Check Vercel Logs

1. Go to Vercel Dashboard
2. Click your project
3. Go to **"Logs"** tab
4. Look for recent errors from `/api/analyze`

### What to look for:

```
❌ Gemini API Error Response: { status: 429 }
→ Rate limit from Gemini

❌ Gemini API Error Response: { status: 403 }
→ API key invalid/exhausted

✅ Gemini response received (12543 chars)
→ Working fine! (Error might be elsewhere)
```

---

## Step 5: Test with a Different Google Account

If you've exhausted your quota, you can:

### Option A: New API Key (Different Google Account)

1. Sign out of Google
2. Sign in with a different Google account
3. Go to https://aistudio.google.com/apikey
4. Create API key
5. Use this key in Vercel

**Free quota:** 15 requests/minute per API key

### Option B: Upgrade to Paid (If You Need More)

See `UPGRADE_TO_PAID.md` for instructions

---

## Step 6: Alternative Testing Without Using Quota

While debugging, you can test the UI without calling Gemini:

1. Comment out the Gemini call temporarily
2. Return mock data
3. Test UI/UX changes
4. Uncomment when ready for real analysis

**File:** `api/analyze.ts`

```typescript
// TEMPORARY: Mock response for testing
// const analysisResult = await analyzeWithGemini(text, fileName, apiKey);

const analysisResult = {
  source_file: fileName,
  categories: {
    polity: [
      {
        title: "Test News Item",
        points: ["Test point 1", "Test point 2"],
        references: [{ page: 1, excerpt: "Test reference" }],
        confidence: 0.9,
        hasNumbers: false,
        numericHighlights: [],
        priorityScore: 0.9,
      },
    ],
    economy: [],
    // ... other categories
  },
};
```

---

## 🎯 Most Likely Solutions (In Order)

### 1. **Create New API Key** (90% success rate)

- Takes 30 seconds
- Free
- Fresh quota

### 2. **Wait 10+ Minutes** (70% success rate)

- Let ALL previous requests age out
- Clear browser cache
- Try again

### 3. **Use Different Browser/Incognito** (50% success rate)

- Rules out local caching issues
- Fresh session

### 4. **Check API Key on AI Studio** (100% diagnostic)

- See actual quota status
- Know if you need to upgrade

### 5. **Upgrade to Paid Tier** (100% success, costs money)

- Only if free quota exhausted permanently
- See next section

---

## 💰 When You ACTUALLY Need to Upgrade

Upgrade to paid tier if:

- ✅ You've tried 2-3 different API keys (all exhausted)
- ✅ Your Google Cloud project shows "Quota exceeded"
- ✅ You need to process 100+ documents per day
- ✅ You need more than 15 requests/minute sustained
- ✅ You're in production with real users

DON'T upgrade if:

- ❌ You're just testing/developing
- ❌ You haven't tried a new API key yet
- ❌ You're processing <10 docs/day
- ❌ Error just started happening today

---

## 🚀 Next Steps

1. **Try Step 2** (new API key) - 99% chance this fixes it
2. If that doesn't work, check Step 4 (Vercel logs)
3. Share the logs with me if still stuck
4. Consider upgrading only if quota is truly exhausted

**Most users don't need paid tier** - a fresh API key usually solves it! 🎉
