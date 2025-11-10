# 🚀 Setup GCP untuk Sistem Rekomendasi Video YouTube

Dokumentasi lengkap untuk setup Google Cloud Platform (GCP) untuk sistem rekomendasi video YouTube dengan caching dan auto-refresh.

## 📋 Arsitektur Sistem

```
┌─────────────────┐
│   User Request  │
│  (Anak SD)      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Backend Express.js API            │
│   /api/video-rekomendasi/:materi    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   GCP Firestore Cache               │
│   - Video data dengan stats         │
│   - Cache duration: 24 jam          │
│   - Auto-refresh via Scheduler      │
└────────┬────────────────────────────┘
         │
         ▼ (jika cache expired/tidak ada)
┌─────────────────────────────────────┐
│   YouTube Data API v3               │
│   - Fetch video list                │
│   - Get video statistics            │
│   - Filter: views + likes terbanyak │
└─────────────────────────────────────┘
```

## 🎯 Keunggulan Sistem

1. **⚡ Performance**: Cache di Firestore mengurangi API calls dan response time
2. **🎖️ Smart Ranking**: Video diurutkan berdasarkan composite score (70% views + 30% engagement)
3. **🔄 Auto-Update**: Cloud Scheduler refresh cache setiap hari pukul 00:00 WIB
4. **💰 Cost-Efficient**: Minimize YouTube API quota usage
5. **📊 Analytics Ready**: Semua stats (views, likes, comments) tersimpan untuk analytics

## 📦 Prerequisites

1. **Google Cloud Account** dengan billing enabled
2. **GCP Project** sudah dibuat
3. **YouTube Data API v3** enabled
4. **Firestore Database** sudah disetup (Native mode)
5. **Service Account** dengan permissions:
   - Cloud Datastore User
   - Cloud Functions Developer
   - Cloud Scheduler Admin

## 🔧 Step-by-Step Setup

### 1. Setup GCP Project

```bash
# Set project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable firestore.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable youtube.googleapis.com
```

### 2. Create Firestore Database

```bash
# Create Firestore database (Native mode)
gcloud firestore databases create --region=asia-southeast2

# Atau via Console:
# https://console.cloud.google.com/firestore
# → Create Database → Native mode → asia-southeast2 (Jakarta)
```

### 3. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create adaptivin-youtube-service \
    --display-name="Adaptivin YouTube Service"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:adaptivin-youtube-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:adaptivin-youtube-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudfunctions.developer"

# Generate key file
gcloud iam service-accounts keys create ./gcp-key.json \
    --iam-account=adaptivin-youtube-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

**⚠️ PENTING**: Simpan file `gcp-key.json` dengan aman! Jangan commit ke Git!

### 4. Deploy Cloud Function

```bash
cd be-adaptivin/functions

# Install dependencies
npm install

# Deploy function
gcloud functions deploy refreshYoutubeCache \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point refreshYoutubeCache \
  --timeout 540s \
  --memory 512MB \
  --region asia-southeast2 \
  --set-env-vars YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY

# Get function URL
gcloud functions describe refreshYoutubeCache --region asia-southeast2
```

### 5. Setup Cloud Scheduler

```bash
# Create scheduler job untuk refresh cache setiap hari pukul 00:00 WIB
gcloud scheduler jobs create http refresh-youtube-cache \
  --schedule="0 0 * * *" \
  --uri="https://asia-southeast2-YOUR_PROJECT_ID.cloudfunctions.net/refreshYoutubeCache" \
  --http-method=POST \
  --time-zone="Asia/Jakarta" \
  --location=asia-southeast2

# Test manual trigger
gcloud scheduler jobs run refresh-youtube-cache --location=asia-southeast2
```

### 6. Update Backend .env

Tambahkan ke file `.env`:

```env
# GCP Configuration
GCP_PROJECT_ID=YOUR_PROJECT_ID
GCP_KEY_FILE=./gcp-key.json
USE_GCP_CACHE=true

# Existing YouTube API Key
YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY
```

### 7. Test Backend API

```bash
# Start backend
cd be-adaptivin
npm start

# Test endpoint
curl http://localhost:5000/api/video-rekomendasi/materi/Pecahan
```

## 📡 API Endpoints

### 1. Get Video Recommendations by Materi

**GET** `/api/video-rekomendasi/materi/:materi`

```bash
GET /api/video-rekomendasi/materi/Pecahan?limit=10
```

Response:
```json
{
  "success": true,
  "materi": "Pecahan",
  "video_count": 10,
  "cached": true,
  "videos": [
    {
      "judul": "Belajar Pecahan - Matematika SD",
      "url": "https://www.youtube.com/watch?v=...",
      "thumbnail": "https://i.ytimg.com/vi/.../hqdefault.jpg",
      "channel": "Channel Edukasi",
      "views": "1.2M",
      "likes": "45K",
      "duration": "15m 30d",
      "published_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### 2. Get Bulk Recommendations

**POST** `/api/video-rekomendasi/bulk`

```bash
POST /api/video-rekomendasi/bulk
Content-Type: application/json

{
  "materi_list": ["Pecahan", "Perkalian", "Bangun Datar"],
  "limit": 5
}
```

### 3. Get Trending Videos

**GET** `/api/video-rekomendasi/trending?limit=20`

### 4. Refresh Cache (Admin Only)

**POST** `/api/video-rekomendasi/refresh/:materi`

Requires authentication token.

## 🔍 Monitoring & Debugging

### Check Firestore Data

```bash
# Via Console
https://console.cloud.google.com/firestore/data

# Via gcloud
gcloud firestore operations list
```

### Check Cloud Function Logs

```bash
gcloud functions logs read refreshYoutubeCache --region asia-southeast2
```

### Check Scheduler Jobs

```bash
gcloud scheduler jobs list --location=asia-southeast2
gcloud scheduler jobs describe refresh-youtube-cache --location=asia-southeast2
```

## 💰 Cost Estimation

**Asumsi**: 10 materi, 10 video per materi, refresh 1x/hari

### Firestore
- Storage: 10 documents × 30 KB = 300 KB/bulan → **GRATIS** (quota: 1 GB)
- Reads: ~1000 reads/hari × 30 = 30K reads/bulan → **GRATIS** (quota: 50K/hari)

### Cloud Functions
- Invocations: 1x/hari × 30 = 30/bulan → **GRATIS** (quota: 2M/bulan)
- Compute: ~20 detik × 30 = 10 menit/bulan → **GRATIS** (quota: 400K GB-seconds)

### YouTube API v3
- Search: 10 materi × 3 queries × 100 units = 3,000 units/hari
- Video stats: 10 materi × 10 videos × 1 unit = 100 units/hari
- Total: ~3,100 units/hari × 30 = **93,000 units/bulan** (quota: 10,000/hari)

**Total Cost**: **GRATIS** dengan GCP Free Tier! 🎉

## 🚨 Troubleshooting

### Error: "PERMISSION_DENIED"

```bash
# Check service account permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:adaptivin-youtube-service*"
```

### Error: "Quota exceeded"

```bash
# Check YouTube API quota
https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas

# Request quota increase jika perlu
```

### Cache tidak ter-update

```bash
# Manual trigger Cloud Scheduler
gcloud scheduler jobs run refresh-youtube-cache --location=asia-southeast2

# Check logs
gcloud functions logs read refreshYoutubeCache --region asia-southeast2 --limit 50
```

## 🔐 Security Best Practices

1. **Jangan commit `gcp-key.json`** ke Git
2. Add ke `.gitignore`:
   ```
   gcp-key.json
   *-key.json
   ```
3. **Restrict API Keys**:
   - YouTube API Key → Restrict to your server IP
   - Cloud Function → Require authentication (optional)
4. **Enable Cloud Armor** untuk DDoS protection (optional)

## 📈 Optimization Tips

1. **Adjust cache duration** di `gcpYoutubeService.js`:
   ```javascript
   const CACHE_DURATION_HOURS = 24; // Bisa diubah sesuai kebutuhan
   ```

2. **Tune ranking algorithm**:
   ```javascript
   // Composite score: 70% views + 30% engagement
   const compositeScore = (normalizedViews * 0.7) + (normalizedEngagement * 0.3);
   ```

3. **Batch size untuk rate limiting**:
   ```javascript
   const batchSize = 5; // Process 5 materi at a time
   ```

## 🎓 Next Steps

1. ✅ Setup monitoring dengan Cloud Monitoring
2. ✅ Add analytics untuk track most viewed videos
3. ✅ Implement A/B testing untuk ranking algorithm
4. ✅ Add user feedback mechanism untuk improve recommendations
5. ✅ Setup alerts untuk API quota usage

## 📚 Resources

- [GCP Firestore Docs](https://cloud.google.com/firestore/docs)
- [Cloud Functions Docs](https://cloud.google.com/functions/docs)
- [YouTube Data API Docs](https://developers.google.com/youtube/v3)
- [Cloud Scheduler Docs](https://cloud.google.com/scheduler/docs)

---

**🎉 Setup Complete!** Backend Anda sekarang memiliki sistem rekomendasi video YouTube yang powerful dengan GCP!
