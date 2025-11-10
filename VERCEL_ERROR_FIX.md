# 🔴 **Vercel Error 500 - TROUBLESHOOTING GUIDE**

## Error yang Terjadi

```
500: INTERNAL_SERVER_ERROR
Code: FUNCTION_INVOCATION_FAILED
This Serverless Function has crashed
```

## 🔍 **Root Causes Fixed:**

### 1. ❌ **Server Setup Incompatible with Vercel Serverless**

**Problem:** `app.listen()` tidak bisa digunakan di Vercel serverless
**Solution:** ✅ Export app sebagai default untuk Vercel handler

### 2. ❌ **Missing Environment Variables**

**Problem:** Environment variables tidak di-set di Vercel
**Solution:** ✅ Must configure all env vars in Vercel dashboard

### 3. ❌ **Hardcoded Supabase Error Messages**

**Problem:** Error messages tidak clear untuk debugging
**Solution:** ✅ Added better error logging

---

## 🚀 **STEPS TO FIX AND REDEPLOY**

### **Step 1: Commit Changes**

```bash
cd "c:\Users\Asus TUF Gaming\Documents\KULIAH\LOMBA\LIDM\Website\be-adaptivin"

git add .
git commit -m "fix: update server for Vercel serverless compatibility"
git push origin main
```

### **Step 2: Set Environment Variables in Vercel**

#### Via Vercel Dashboard:

1. Go to: https://vercel.com/farhanulkhair-usk/your-project-name
2. Click **Settings** > **Environment Variables**
3. Add ALL these variables:

```env
SUPABASE_URL=https://rhwcxfhglvfodcybkcen.supabase.co

SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJod2N4ZmhnbHZmb2RjeWJrY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Nzg0NjUsImV4cCI6MjA3MTQ1NDQ2NX0.I9jqM4zlCE4V6zJ6oGVWjyozRUc8c-tf40Yc_3wVl24

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJod2N4ZmhnbHZmb2RjeWJrY2VuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg3ODQ2NSwiZXhwIjoyMDcxNDU0NDY1fQ.NmG3pnlcB_bc9EK8p_WvYHiwnkTa_60Iv-b314r3TYg

JWT_SECRET=ypqHx5Q2KXUTPJq5ZipsYwsC4G7A6X3RkLj3G6r9171orThqEX5siDyPS+4KDqxkokbgayAipeoKe8AtQBOW9Q==

API_AI_KEY=AIzaSyDR64TNmFDEoUk__F4Q6PVNh_5B8tI1A34

YOUTUBE_API_KEY=AIzaSyCQNAVeQxk-kXxScFvrjoXmwaXaUingS9E

FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

USE_GCP_CACHE=false
```

**IMPORTANT:** For each variable:

- Click "Add New"
- Enter **Name** (e.g., `SUPABASE_URL`)
- Enter **Value** (paste the value)
- Select **Environment**: Production, Preview, Development (check all)
- Click "Save"

### **Step 3: Trigger Redeploy**

#### Option A: Via Vercel Dashboard

1. Go to **Deployments** tab
2. Click **...** (three dots) on latest deployment
3. Click **Redeploy**

#### Option B: Via Git Push

```bash
# Make a small change to trigger redeploy
git commit --allow-empty -m "trigger redeploy"
git push origin main
```

### **Step 4: Check Deployment Logs**

1. Go to Vercel Dashboard > **Deployments**
2. Click on the latest deployment
3. Click **View Function Logs**
4. Look for:
   - ✅ `Checking Environment Variables...`
   - ✅ `All required environment variables are set!`
   - ✅ `Supabase Admin initialized`
   - ✅ `Registering routes...`

---

## 🧪 **Testing After Redeploy**

### 1. Test Health Endpoint

```bash
curl https://your-backend-url.vercel.app/api/test
```

**Expected Response:**

```json
{
  "message": "Server is running!",
  "timestamp": "2025-11-10T..."
}
```

### 2. Test from Browser

Open in browser:

```
https://your-backend-url.vercel.app/api/test
```

Should see JSON response, not error page.

### 3. Test Authentication (Optional)

```bash
curl -X POST https://your-backend-url.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

---

## 🔍 **If Still Getting 500 Error:**

### Check Logs in Detail:

1. Vercel Dashboard > Deployments
2. Click latest deployment
3. Click **View Function Logs**
4. Look for red error messages

### Common Issues:

#### Issue 1: Missing Env Vars

```
❌ MISSING: SUPABASE_URL
```

**Fix:** Add the missing variable in Vercel dashboard

#### Issue 2: Wrong Env Var Format

```
Error: Invalid Supabase URL
```

**Fix:** Check URL format (should start with `https://`)

#### Issue 3: Import Errors

```
Cannot find module './routes/...'
```

**Fix:** Check file paths are correct, all files committed

---

## 📊 **What Was Changed:**

### Files Modified:

1. ✅ `src/server.js` - Export app for Vercel serverless
2. ✅ `src/app.js` - Add env check on startup
3. ✅ `src/config/supabaseAdmin.js` - Better error messages
4. ✅ `src/config/supabaseClient.js` - Better error messages
5. ✅ `src/config/firestore.js` - Optional GCP (won't crash)
6. ✅ `src/utils/checkEnv.js` - NEW: Env validator
7. ✅ `vercel.json` - Add VERCEL=1 env var

### Key Changes:

- ✅ Server now exports app for Vercel instead of using `app.listen()`
- ✅ Environment variables validated on startup
- ✅ Better error messages for debugging
- ✅ Optional features (Firestore) won't crash server

---

## ✅ **Success Indicators:**

After successful deployment, you should see:

1. ✅ Vercel dashboard shows "Deployment Ready"
2. ✅ `/api/test` returns JSON (not error)
3. ✅ Logs show "All required environment variables are set!"
4. ✅ No 500 errors when visiting API

---

## 🆘 **Need Help?**

If still having issues:

1. Screenshot the Vercel function logs
2. Check which env vars are missing
3. Verify all files are committed and pushed
4. Try clearing Vercel cache (Settings > General > Clear Build Cache)

---

**Last Updated:** November 10, 2025
