# 🎬 Quick Start: Video Rekomendasi YouTube untuk Anak SD

Panduan cepat untuk mengimplementasikan sistem rekomendasi video YouTube dengan caching GCP dan ranking berdasarkan views + likes terbanyak.

## 🎯 Apa yang Baru?

Sistem ini memberikan **rekomendasi video YouTube langsung** kepada anak SD berdasarkan:
- ✅ **Views terbanyak** - Video populer yang banyak ditonton
- ✅ **Likes terbanyak** - Video berkualitas dengan engagement tinggi
- ✅ **Cache otomatis** - Response cepat tanpa query berulang
- ✅ **Auto-refresh** - Update data setiap hari otomatis
- ✅ **Hemat API quota** - Menggunakan Firestore cache

## 🚀 Mode Implementasi

### Mode 1: Tanpa GCP (Direct YouTube API) - SIMPLE

**Kelebihan**: Setup cepat, tidak perlu GCP
**Kekurangan**: Tidak ada cache, lebih lambat, API quota cepat habis

```env
# Di file .env
USE_GCP_CACHE=false
YOUTUBE_API_KEY=your_youtube_api_key
```

Video akan langsung di-fetch dari YouTube API setiap request.

---

### Mode 2: Dengan GCP Cache - RECOMMENDED ⭐

**Kelebihan**:
- ⚡ Response cepat dengan cache
- 🎖️ Smart ranking (views + likes)
- 🔄 Auto-update setiap hari
- 💰 Hemat API quota

**Setup**: Ikuti [GCP_SETUP.md](./GCP_SETUP.md)

```env
# Di file .env
USE_GCP_CACHE=true
GCP_PROJECT_ID=your_project_id
GCP_KEY_FILE=./gcp-key.json
YOUTUBE_API_KEY=your_youtube_api_key
```

## 📦 Quick Setup (5 Menit)

### 1. Install Dependencies

```bash
cd be-adaptivin
npm install
```

### 2. Update .env

```bash
# Copy dari example
cp .env.example .env

# Edit .env dan isi:
YOUTUBE_API_KEY=AIzaSy...  # Dari Google Cloud Console
USE_GCP_CACHE=false        # Set false dulu untuk testing cepat

# Untuk mode GCP, tambahkan:
# GCP_PROJECT_ID=your_project_id
# GCP_KEY_FILE=./gcp-key.json
# USE_GCP_CACHE=true
```

### 3. Start Backend

```bash
npm start
```

### 4. Test API

```bash
# Test basic endpoint
curl http://localhost:5000/api/test

# Test video rekomendasi untuk materi Pecahan
curl http://localhost:5000/api/video-rekomendasi/materi/Pecahan
```

**Response Example**:
```json
{
  "success": true,
  "materi": "Pecahan",
  "video_count": 10,
  "cached": false,
  "videos": [
    {
      "judul": "Belajar Pecahan Mudah untuk Anak SD",
      "url": "https://www.youtube.com/watch?v=abc123",
      "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      "channel": "Ruang Guru SD",
      "views": "2.5M",
      "likes": "125K",
      "duration": "15m 30d"
    }
  ]
}
```

## 🎮 Cara Pakai di Frontend

### React/Next.js Example

```javascript
// Get video rekomendasi untuk materi Pecahan
const getVideoRekomendasi = async (materi) => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/video-rekomendasi/materi/${materi}`
    );
    const data = await response.json();

    if (data.success) {
      return data.videos; // Array of video objects
    }
  } catch (error) {
    console.error('Error fetching videos:', error);
  }
};

// Component
function VideoRekomendasi({ materi }) {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    getVideoRekomendasi(materi).then(setVideos);
  }, [materi]);

  return (
    <div className="video-grid">
      {videos.map((video, index) => (
        <div key={index} className="video-card">
          <a href={video.url} target="_blank" rel="noopener noreferrer">
            <img src={video.thumbnail} alt={video.judul} />
            <h3>{video.judul}</h3>
            <p>{video.channel}</p>
            <div className="stats">
              <span>👁️ {video.views}</span>
              <span>👍 {video.likes}</span>
              <span>⏱️ {video.duration}</span>
            </div>
          </a>
        </div>
      ))}
    </div>
  );
}
```

### Usage di Halaman Materi

```jsx
// Di halaman belajar materi
<MaterialPage>
  <h1>Belajar {materiName}</h1>

  {/* Konten materi */}
  <MaterialContent />

  {/* Video rekomendasi langsung */}
  <section className="video-recommendations">
    <h2>🎬 Video Pembelajaran Terbaik</h2>
    <p>Video paling populer dan banyak disukai untuk materi ini:</p>
    <VideoRekomendasi materi={materiName} />
  </section>
</MaterialPage>
```

## 📡 API Endpoints yang Tersedia

### 1. Get Video by Materi (Main)

```http
GET /api/video-rekomendasi/materi/:materi?limit=10
```

Parameter:
- `materi` (required): Nama materi (contoh: "Pecahan", "Perkalian")
- `limit` (optional): Jumlah video (default: 10, max: 50)

---

### 2. Get Bulk Videos (Multiple Materi)

```http
POST /api/video-rekomendasi/bulk
Content-Type: application/json

{
  "materi_list": ["Pecahan", "Perkalian", "Bangun Datar"],
  "limit": 5
}
```

Berguna untuk dashboard atau halaman overview.

---

### 3. Get Trending Videos

```http
GET /api/video-rekomendasi/trending?limit=20
```

Menampilkan video trending dari semua materi berdasarkan views tertinggi.

---

### 4. Refresh Cache (Admin Only)

```http
POST /api/video-rekomendasi/refresh/:materi
Authorization: Bearer {admin_token}
```

Untuk manual refresh cache jika ada update video baru.

## 🎯 Flow User (Anak SD)

```
1. Anak SD buka materi "Pecahan"
   ↓
2. Halaman materi load
   ↓
3. Frontend request: GET /api/video-rekomendasi/materi/Pecahan
   ↓
4. Backend check cache (jika USE_GCP_CACHE=true)
   ├─ Cache ada & fresh → Return dari cache (fast!)
   └─ Cache expired/tidak ada → Fetch dari YouTube API → Cache → Return
   ↓
5. Frontend tampilkan 10 video terbaik (ranking by views + likes)
   ↓
6. Anak SD klik video → Langsung buka di YouTube
   ↓
7. Selesai! Anak belajar dari video berkualitas tinggi 🎉
```

## 🏆 Ranking Algorithm

Video diurutkan berdasarkan **Composite Score**:

```
Composite Score = (Normalized Views × 0.7) + (Engagement Score × 0.3)

Engagement Score = Likes + (Comments × 2)
```

**Contoh**:
- Video A: 1M views, 50K likes → Score: 0.7 + 0.3 = **1.0**
- Video B: 500K views, 100K likes, 10K comments → Score: 0.35 + 0.45 = **0.8**
- Video A menang karena views lebih tinggi! ✅

## 🔧 Customization

### Ubah Ranking Algorithm

Edit di `src/services/gcpYoutubeService.js`:

```javascript
// Original: 70% views + 30% engagement
const compositeScore = (normalizedViews * 0.7) + (normalizedEngagement * 0.3);

// Opsi 1: Lebih prioritas engagement (quality)
const compositeScore = (normalizedViews * 0.5) + (normalizedEngagement * 0.5);

// Opsi 2: Full views-based (populer banget)
const compositeScore = normalizedViews;
```

### Ubah Cache Duration

Edit di `src/services/gcpYoutubeService.js`:

```javascript
const CACHE_DURATION_HOURS = 24; // Default: 24 jam

// Opsi: 12 jam (update lebih sering)
const CACHE_DURATION_HOURS = 12;

// Opsi: 7 hari (hemat API quota)
const CACHE_DURATION_HOURS = 168;
```

### Tambah Filter Custom

```javascript
// Filter hanya video < 20 menit
const filteredVideos = videos.filter(video => {
  const duration = parseDurationToMinutes(video.duration);
  return duration <= 20;
});

// Filter hanya channel tertentu
const trustedChannels = ["Ruang Guru", "Zenius", "Quipper"];
const filteredVideos = videos.filter(video =>
  trustedChannels.includes(video.channel)
);
```

## 🐛 Troubleshooting

### Error: "YouTube API quota exceeded"

**Solusi**:
1. Enable GCP cache: `USE_GCP_CACHE=true`
2. Increase cache duration: `CACHE_DURATION_HOURS = 48`
3. Request quota increase di Google Cloud Console

### Video tidak muncul

**Check**:
```bash
# Test YouTube API key
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&key=YOUR_API_KEY"

# Check backend logs
npm start
# Lihat console output
```

### Cache tidak update

**Solusi**:
```bash
# Manual refresh via API
curl -X POST http://localhost:5000/api/video-rekomendasi/refresh/Pecahan \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Atau restart Cloud Scheduler (jika pakai GCP)
gcloud scheduler jobs run refresh-youtube-cache --location=asia-southeast2
```

## 📊 Monitoring

### Check Cache Status (Firestore)

```bash
# Via Console
https://console.cloud.google.com/firestore/data

# Lihat collection: youtube_videos_cache
```

### Check API Usage

```bash
# YouTube API quota
https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
```

## 🎉 Next Steps

1. ✅ Test API di Postman/Thunder Client
2. ✅ Implementasi di frontend
3. ✅ Setup GCP cache untuk production (lihat GCP_SETUP.md)
4. ✅ Deploy backend ke cloud (Vercel/Railway/GCP)
5. ✅ Monitor usage dan optimize ranking

## 💡 Tips & Best Practices

1. **Untuk Development**: Use `USE_GCP_CACHE=false` untuk testing cepat
2. **Untuk Production**: Use `USE_GCP_CACHE=true` untuk performa optimal
3. **Maternity List**: Prepare list materi di awal untuk pre-cache
4. **Error Handling**: Always handle empty video results di frontend
5. **User Feedback**: Add "Report video" button untuk quality control

---

**🎬 Ready to Go!** Anak SD sekarang bisa langsung akses video YouTube terbaik untuk belajar! 🚀
