/**
 * Google Cloud Function untuk refresh cache video YouTube
 * Dipanggil oleh Cloud Scheduler setiap hari pukul 00:00 WIB
 *
 * Deploy command:
 * gcloud functions deploy refreshYoutubeCache \
 *   --runtime nodejs20 \
 *   --trigger-http \
 *   --allow-unauthenticated \
 *   --entry-point refreshYoutubeCache \
 *   --timeout 540s \
 *   --memory 512MB
 *
 * Cloud Scheduler command:
 * gcloud scheduler jobs create http refresh-youtube-cache \
 *   --schedule="0 0 * * *" \
 *   --uri="https://REGION-PROJECT_ID.cloudfunctions.net/refreshYoutubeCache" \
 *   --http-method=POST \
 *   --time-zone="Asia/Jakarta"
 */

const functions = require("@google-cloud/functions-framework");
const { Firestore } = require("@google-cloud/firestore");
const axios = require("axios");

// Initialize Firestore
const firestore = new Firestore();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const COLLECTIONS = {
  YOUTUBE_VIDEOS: "youtube_videos_cache",
};

/**
 * Main Cloud Function handler
 */
functions.http("refreshYoutubeCache", async (req, res) => {
  try {
    console.log("🚀 Starting YouTube cache refresh...");

    // Get materi list dari query param atau hardcoded list
    let materiList = req.body?.materi_list || req.query?.materi_list;

    if (!materiList) {
      // Default materi untuk SD kelas 4-5
      materiList = [
        "Pecahan",
        "Perkalian dan Pembagian",
        "Bangun Datar",
        "Bangun Ruang",
        "Pengukuran",
        "Bilangan Bulat",
        "FPB dan KPK",
        "Pola Bilangan",
        "Koordinat",
        "Statistika Sederhana",
      ];
    }

    if (typeof materiList === "string") {
      materiList = materiList.split(",").map(m => m.trim());
    }

    console.log(`📋 Processing ${materiList.length} materi...`);

    const results = {
      success: [],
      failed: [],
      timestamp: new Date().toISOString(),
    };

    // Process dengan rate limiting
    const batchSize = 3;
    for (let i = 0; i < materiList.length; i += batchSize) {
      const batch = materiList.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(materi => refreshCacheForMateri(materi))
      );

      batchResults.forEach((result, index) => {
        const materi = batch[index];
        if (result.status === "fulfilled") {
          results.success.push({
            materi,
            video_count: result.value,
          });
          console.log(`✅ ${materi}: ${result.value} videos cached`);
        } else {
          results.failed.push({
            materi,
            error: result.reason.message,
          });
          console.error(`❌ ${materi}: ${result.reason.message}`);
        }
      });

      // Wait between batches to respect API rate limits
      if (i + batchSize < materiList.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ Cache refresh completed: ${results.success.length} success, ${results.failed.length} failed`);

    res.status(200).json({
      message: "Cache refresh completed",
      results,
    });
  } catch (error) {
    console.error("❌ Error in Cloud Function:", error);
    res.status(500).json({
      error: "Cache refresh failed",
      message: error.message,
    });
  }
});

/**
 * Refresh cache untuk satu materi
 */
async function refreshCacheForMateri(materi) {
  try {
    console.log(`🔄 Refreshing: ${materi}`);

    // Generate search queries
    const queries = [
      `belajar ${materi} SD kelas 4`,
      `tutorial ${materi} untuk anak SD`,
      `${materi} matematika SD mudah dipahami`,
    ];

    const allVideoIds = new Set();

    // Search videos
    for (const query of queries) {
      const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
        params: {
          key: YOUTUBE_API_KEY,
          q: query,
          part: "snippet",
          type: "video",
          maxResults: 10,
          videoEmbeddable: true,
          videoSyndicated: true,
          relevanceLanguage: "id",
          safeSearch: "strict",
          order: "viewCount",
        },
      });

      if (response.data.items) {
        response.data.items.forEach(item => allVideoIds.add(item.id.videoId));
      }

      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const videoIds = Array.from(allVideoIds);

    if (videoIds.length === 0) {
      console.warn(`⚠️ No videos found for ${materi}`);
      return 0;
    }

    // Get video statistics
    const statsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
      params: {
        key: YOUTUBE_API_KEY,
        id: videoIds.join(","),
        part: "snippet,statistics,contentDetails",
      },
    });

    if (!statsResponse.data.items) {
      return 0;
    }

    // Format video data
    const videos = statsResponse.data.items.map((video) => {
      const stats = video.statistics;
      const snippet = video.snippet;

      const views = parseInt(stats.viewCount || 0);
      const likes = parseInt(stats.likeCount || 0);
      const comments = parseInt(stats.commentCount || 0);
      const engagementScore = likes + (comments * 2);

      return {
        video_id: video.id,
        judul: snippet.title,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnail: snippet.thumbnails.high?.url || snippet.thumbnails.medium.url,
        channel: snippet.channelTitle,
        channel_id: snippet.channelId,
        published_at: snippet.publishedAt,
        description: snippet.description,
        views: views,
        likes: likes,
        comments: comments,
        engagement_score: engagementScore,
        duration: video.contentDetails.duration,
        materi: materi,
        cached_at: Date.now(),
        last_updated: new Date().toISOString(),
      };
    });

    // Save to Firestore
    const cacheRef = firestore
      .collection(COLLECTIONS.YOUTUBE_VIDEOS)
      .doc(normalizeMateriKey(materi));

    await cacheRef.set({
      materi: materi,
      videos: videos,
      cached_at: Date.now(),
      last_updated: new Date().toISOString(),
      video_count: videos.length,
    });

    return videos.length;
  } catch (error) {
    console.error(`❌ Error refreshing ${materi}:`, error.message);
    throw error;
  }
}

/**
 * Normalize materi key untuk Firestore document ID
 */
function normalizeMateriKey(materi) {
  return materi
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
