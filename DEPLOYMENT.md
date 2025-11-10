# 🚀 Backend Deployment Guide - Adaptivin

## 📋 Pre-Deployment Checklist

### ✅ Required Environment Variables

Pastikan **semua** environment variables berikut sudah di-set di platform deployment:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Supabase Configuration
SUPABASE_URL=https://rhwcxfhglvfodcybkcen.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT Configuration
JWT_SECRET=your_production_jwt_secret

# AI API Keys
API_AI_KEY=AIzaSyDR64TNmFDEoUk__F4Q6PVNh_5B8tI1A34
YOUTUBE_API_KEY=AIzaSyCQNAVeQxk-kXxScFvrjoXmwaXaUingS9E

# Frontend URLs (CRITICAL - UPDATE THESE!)
FRONTEND_URL=https://your-frontend-domain.vercel.app
ADMIN_URL=https://your-admin-domain.vercel.app

# Optional: Google Cloud Firestore
USE_GCP_CACHE=false
# GCP_PROJECT_ID=your-project-id
# GCP_KEY_FILE=./gcp-key.json
```

---

## 🌐 Platform-Specific Deployment

### **Option 1: Vercel (Recommended)**

#### 1️⃣ Install Vercel CLI

```bash
npm i -g vercel
```

#### 2️⃣ Login to Vercel

```bash
vercel login
```

#### 3️⃣ Deploy

```bash
vercel --prod
```

#### 4️⃣ Set Environment Variables

```bash
# Via CLI
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add JWT_SECRET
vercel env add API_AI_KEY
vercel env add YOUTUBE_API_KEY
vercel env add FRONTEND_URL
vercel env add ADMIN_URL

# Or via Vercel Dashboard:
# https://vercel.com/your-project/settings/environment-variables
```

#### 5️⃣ Redeploy

```bash
vercel --prod
```

---

### **Option 2: Railway**

#### 1️⃣ Install Railway CLI

```bash
npm i -g @railway/cli
```

#### 2️⃣ Login

```bash
railway login
```

#### 3️⃣ Initialize Project

```bash
railway init
```

#### 4️⃣ Set Environment Variables

```bash
railway variables set PORT=5000
railway variables set NODE_ENV=production
railway variables set SUPABASE_URL=https://rhwcxfhglvfodcybkcen.supabase.co
# ... (set all other variables)
```

#### 5️⃣ Deploy

```bash
railway up
```

---

### **Option 3: Render**

#### 1️⃣ Connect GitHub Repository

- Go to https://render.com
- Click "New +" → "Web Service"
- Connect your GitHub repository

#### 2️⃣ Configure Build Settings

- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** `Node`

#### 3️⃣ Set Environment Variables

Add all variables from `.env` in Render Dashboard

#### 4️⃣ Deploy

Click "Create Web Service"

---

## 🔧 Build Settings Summary

### For Deployment Platforms:

| Setting              | Value                |
| -------------------- | -------------------- |
| **Build Command**    | `npm install`        |
| **Output Directory** | `.` (or leave empty) |
| **Install Command**  | `npm install`        |
| **Start Command**    | `npm start`          |
| **Node Version**     | `18.x` or higher     |

---

## ⚠️ CRITICAL: CORS Configuration

**IMPORTANT:** After deploying, update `.env` with production URLs:

```env
# Local Development
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

# Production (UPDATE THESE!)
FRONTEND_URL=https://fe-adaptivin.vercel.app
ADMIN_URL=https://adaptivin-admin.vercel.app
```

Without this, your frontend **WILL NOT** be able to connect to backend! 🔴

---

## 🧪 Testing After Deployment

### 1. Test Health Endpoint

```bash
curl https://your-backend-url.vercel.app/api/test
```

Expected response:

```json
{
  "message": "Server is running!",
  "timestamp": "2025-11-10T..."
}
```

### 2. Test Authentication

```bash
curl -X POST https://your-backend-url.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 3. Check CORS

Open browser console on your frontend and check for CORS errors.

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Error

**Symptom:** `Access-Control-Allow-Origin` error in browser console

**Solution:**

1. Check `FRONTEND_URL` and `ADMIN_URL` in environment variables
2. Make sure URLs match **exactly** (no trailing slash)
3. Redeploy after updating

### Issue 2: 404 on All Routes

**Symptom:** All API calls return 404

**Solution:**

1. Check `vercel.json` exists and is configured correctly
2. Verify `src/server.js` path is correct
3. Check build logs for errors

### Issue 3: Environment Variables Not Working

**Symptom:** App crashes or returns 500 errors

**Solution:**

1. Verify all required env vars are set on platform
2. Check for typos in variable names
3. Restart/redeploy the service

### Issue 4: Supabase Connection Errors

**Symptom:** Database queries fail

**Solution:**

1. Verify `SUPABASE_URL` and keys are correct
2. Check Supabase project is active
3. Test connection with Supabase client directly

---

## 📊 Monitoring

### View Logs

**Vercel:**

```bash
vercel logs
```

**Railway:**

```bash
railway logs
```

**Render:**
Check logs in dashboard

---

## 🔐 Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] All sensitive keys are set as environment variables
- [ ] JWT_SECRET is strong and unique for production
- [ ] CORS is properly configured with production URLs
- [ ] Rate limiting is enabled (if applicable)
- [ ] HTTPS is enforced

---

## 📞 Support

If you encounter issues:

1. Check deployment logs
2. Verify all environment variables
3. Test locally with production env vars
4. Check Supabase and API quotas

---

**Last Updated:** November 10, 2025
