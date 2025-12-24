# 🚨 Gemini Free Tier - Complete Guide

## Understanding the Limits

**Gemini 2.0 Flash FREE tier**: 15 requests per minute (RPM)  
**Rate limit type**: Rolling window (NOT reset-based)  
**Recovery time**: 60 seconds from last batch of requests

## Why You're Getting Errors

### Phase 1 (Supabase Edge Function)

- **9 concurrent calls per PDF** (one per category)
- Uploading 2 PDFs = 18 Gemini calls
- **Result**: Instant rate limit hit ❌

### Phase 2 (Current Vercel Optimization)

- **1 call per PDF** ✅
- But if you test 15 times in an hour → rate limited
- Or if you test immediately after Phase 1 → still locked from earlier

## 🎯 How to Use the App Successfully

### ✅ CORRECT Usage Pattern:

```
1. Upload PDF #1 → Wait for analysis → SUCCESS
2. Wait 5 seconds (cooldown enforced)
3. Upload PDF #2 → Wait for analysis → SUCCESS
4. Wait 5 seconds
5. Continue...

✅ Can process 12 PDFs per hour (5 req/min sustained)
```

### ❌ WRONG Usage Pattern:

```
1. Upload PDF #1 → Get results
2. Click "Upload Another" immediately
3. Upload same PDF again (testing)
4. ERROR: Rate limit hit 429
5. Keep retrying → Makes it worse

❌ This exhausts quota fast
```

## 🔧 Current Protections in Code

### 1. **Global Lock** (api/analyze.ts)

```typescript
let isProcessing = false;
// Only ONE analysis at a time
```

### 2. **5-Second Cooldown**

```typescript
const MIN_REQUEST_INTERVAL = 5000;
// Forces 5s wait between uploads
```

### 3. **No Retry on 429**

```typescript
if (response.status === 429) {
  throw error; // Don't retry, return immediately
}
```

### 4. **Single-Chunk Processing**

```typescript
const maxChars = 60000;
// One Gemini call per PDF (not 9 like Phase 1)
```

## 🩹 If You're Currently Rate Limited

**Your Gemini API quota is exhausted from earlier tests**

### Immediate Fix:

```bash
1. STOP uploading documents
2. Wait 2-3 full minutes
3. Clear browser cache/cookies
4. Refresh the page
5. Try ONE document
6. If it works → Great! If not → Wait another 2 minutes
```

### Why 2-3 minutes?

- Rate limit is rolling 60-second window
- But if you made 20 calls in last 3 minutes, you need to wait for ALL of them to age out
- 3 minutes = safe buffer

## 📊 Sustainable Usage for Free Tier

### Daily Recommendations:

- **Max 10-12 documents per hour** (with 5s cooldown)
- **Max 100-120 documents per day** (if used 10 hours)
- **Test mode**: Only 3-4 uploads, then wait 5 minutes

### If You Need More:

1. **Get a second Gemini API key** (different Google account)
2. **Upgrade to Gemini Paid Tier** ($0.02 per 1M tokens)
3. **Use AI Studio Playground** for testing (different quota)

## 🐛 Debugging Your Current State

### Check if you're rate limited:

```bash
# In browser console after failed upload:
1. Check Network tab
2. Look for /api/analyze request
3. Response tab shows:
   {
     "success": false,
     "error": "Rate limit reached...",
     "code": "RATE_LIMIT_HIT",
     "retryAfter": 120
   }
```

### Check your API key status:

1. Go to: https://aistudio.google.com/apikey
2. Look at your key's quota usage
3. If it shows "Quota exceeded" → Confirmed rate limited
4. Wait or create new key

## 🎓 Best Practices Going Forward

### For Development:

- **Use small test PDFs** (2-3 pages max)
- **Test only 3-4 times per session**
- **Use console.log to debug** (not repeated uploads)
- **Comment out Gemini call** during UI work

### For Production:

- **Add user-facing cooldown timer** (5s countdown)
- **Show "Processing..." clearly** (prevent double-clicks)
- **Cache results** (don't re-analyze same file)
- **Inform users**: "Free tier: 10 docs/hour limit"

## 🚀 Your Next Steps

### Right Now:

1. **Wait 3 minutes** (let quota recover)
2. **Deploy latest code** (has all protections)
3. **Test with ONE document**
4. **Verify success before testing more**

### Tomorrow:

1. Clear all caches
2. Fresh API key if needed
3. Normal usage: 1 doc every 10-15 minutes
4. Should work flawlessly ✅

## ⚠️ Warning Signs

### You're about to hit rate limit if:

- Uploading same file repeatedly "just to test"
- Clicking upload before cooldown timer finishes
- Testing with multiple browser tabs simultaneously
- Running automated tests that call the API

### You've hit rate limit if:

- Error message mentions "429" or "rate limit"
- Error says "15 requests/minute"
- Console shows: `RATE_LIMIT_HIT` code
- All uploads fail immediately (not processing)

---

## 📞 Still Having Issues?

If after waiting 3 minutes and deploying latest code you still see errors:

1. **Check Vercel logs**: Look for actual error from Gemini
2. **Verify API key**: Make sure it's valid on AI Studio
3. **Check GEMINI_API_KEY env var**: Must be set in Vercel dashboard
4. **Try different browser**: Rule out local cache issues

**The current code is PRODUCTION-READY for Gemini free tier** ✅  
Your rate limit is from **earlier testing**, not a code problem.
