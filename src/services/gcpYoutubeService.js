import axios from "axios";

/**
 * GCP-Optimized YouTube Service
 * Menggunakan Firestore untuk cache dan Cloud Functions untuk processing
 *
 * NOTE: Firestore harus di-enable terlebih dahulu di GCP Console
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const CACHE_DURATION_HOURS = 24; // Cache valid selama 24 jam
const USE_GCP_CACHE = process.env.USE_GCP_CACHE === "true";

// Lazy load Firestore hanya jika USE_GCP_CACHE enabled
let firestore = null;
let COLLECTIONS = null;

if (USE_GCP_CACHE) {
  try {
    const firestoreModule = await import("../config/firestore.js");
    firestore = firestoreModule.default;
    COLLECTIONS = firestoreModule.COLLECTIONS;
  } catch (error) {
    console.warn("⚠️ Firestore not available, GCP cache disabled:", error.message);
  }
}

/**
 * Mendapatkan video recommendations dari cache Firestore
 * Jika cache tidak ada atau expired, fetch dari YouTube API
 *
 * @param {string} materi - Nama materi pembelajaran
 * @param {number} limit - Jumlah video yang diinginkan
 * @returns {Promise<Array>} Array of video objects dengan stats
 */
export async function getVideoRecommendations(materi, limit = 10) {
  try {
    console.log(`🔍 Getting video recommendations for: "${materi}"`);

    // 1. Cek cache di Firestore
    const cachedVideos = await getCachedVideos(materi);

    if (cachedVideos && cachedVideos.length > 0) {
      console.log(`✅ Found ${cachedVideos.length} cached videos`);

      // Check if cache is still valid
      const cacheAge = Date.now() - cachedVideos[0].cached_at;
      const cacheExpired = cacheAge > CACHE_DURATION_HOURS * 60 * 60 * 1000;

      if (!cacheExpired) {
        // Sort by views and likes, return top N
        return sortAndFilterVideos(cachedVideos, limit);
      }

      console.log("⚠️ Cache expired, refreshing...");
    }

    // 2. Fetch fresh data dari YouTube API
    console.log("🔄 Fetching fresh videos from YouTube API...");
    const freshVideos = await fetchAndCacheVideos(materi);

    return sortAndFilterVideos(freshVideos, limit);
  } catch (error) {
    console.error("❌ Error getting video recommendations:", error);

    // Fallback: Try to get any cached videos even if expired
    const cachedVideos = await getCachedVideos(materi);
    if (cachedVideos && cachedVideos.length > 0) {
      console.log("⚠️ Using expired cache as fallback");
      return sortAndFilterVideos(cachedVideos, limit);
    }

    throw error;
  }
}

/**
 * Fetch videos dari YouTube API dan cache ke Firestore
 * Mengambil video statistics (views, likes) untuk ranking
 */
async function fetchAndCacheVideos(materi) {
  try {
    // 1. Search videos dengan berbagai query variants
    const queries = generateSearchQueries(materi);
    const allVideoIds = new Set();

    // Fetch dari multiple queries untuk hasil lebih komprehensif
    for (const query of queries) {
      const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
        params: {
          key: YOUTUBE_API_KEY,
          q: query,
          part: "snippet",
          type: "video",
          maxResults: 15, // Fetch lebih banyak untuk filtering
          videoEmbeddable: true,
          videoSyndicated: true,
          relevanceLanguage: "id",
          safeSearch: "strict",
          order: "viewCount", // Prioritas views tinggi
        },
      });

      if (response.data.items) {
        response.data.items.forEach(item => allVideoIds.add(item.id.videoId));
      }
    }

    const videoIds = Array.from(allVideoIds);

    if (videoIds.length === 0) {
      console.warn("⚠️ No videos found");
      return [];
    }

    console.log(`📊 Fetching statistics for ${videoIds.length} videos...`);

    // 2. Batch fetch video statistics (views, likes, comments, dll)
    const statsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
      params: {
        key: YOUTUBE_API_KEY,
        id: videoIds.join(","),
        part: "snippet,statistics,contentDetails",
      },
    });

    if (!statsResponse.data.items) {
      return [];
    }

    // 3. Format dan enrich video data
    const videos = statsResponse.data.items.map((video) => {
      const stats = video.statistics;
      const snippet = video.snippet;

      // Calculate engagement score
      const views = parseInt(stats.viewCount || 0);
      const likes = parseInt(stats.likeCount || 0);
      const comments = parseInt(stats.commentCount || 0);

      // Engagement score = likes + (comments * 2) untuk prioritize engagement
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

    // 4. Save to Firestore cache
    await cacheVideosToFirestore(materi, videos);

    console.log(`✅ Cached ${videos.length} videos to Firestore`);
    return videos;
  } catch (error) {
    console.error("❌ Error fetching and caching videos:", error);
    throw error;
  }
}

/**
 * Generate multiple search queries untuk hasil lebih baik
 */
function generateSearchQueries(materi) {
  return [
    `belajar ${materi} SD kelas 4`,
    `tutorial ${materi} untuk anak SD`,
    `${materi} matematika SD mudah dipahami`,
    `cara mudah belajar ${materi}`,
    `${materi} SD lengkap`,
  ];
}

/**
 * Get cached videos from Firestore
 */
async function getCachedVideos(materi) {
  // Skip jika Firestore tidak tersedia
  if (!firestore || !COLLECTIONS) {
    console.log("⚠️ Firestore not available, skipping cache");
    return null;
  }

  try {
    const cacheRef = firestore
      .collection(COLLECTIONS.YOUTUBE_VIDEOS)
      .doc(normalizeMateriKey(materi));

    const doc = await cacheRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return data.videos || [];
  } catch (error) {
    console.error("❌ Error getting cached videos:", error.message);
    return null;
  }
}

/**
 * Cache videos to Firestore
 */
async function cacheVideosToFirestore(materi, videos) {
  // Skip jika Firestore tidak tersedia
  if (!firestore || !COLLECTIONS) {
    console.log("⚠️ Firestore not available, skipping cache save");
    return;
  }

  try {
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

    console.log(`✅ Cached ${videos.length} videos for "${materi}"`);
  } catch (error) {
    console.warn("⚠️ Error caching videos (non-critical):", error.message);
    // Don't throw - caching failure should not break the app
  }
}

/**
 * Sort dan filter videos berdasarkan views dan likes
 * Menggunakan composite score: 70% views + 30% engagement
 */
function sortAndFilterVideos(videos, limit) {
  // Calculate composite score untuk setiap video
  const maxViews = Math.max(...videos.map(v => v.views || 0));
  const maxEngagement = Math.max(...videos.map(v => v.engagement_score || 0));

  const scoredVideos = videos.map(video => {
    // Normalize scores to 0-1
    const normalizedViews = maxViews > 0 ? video.views / maxViews : 0;
    const normalizedEngagement = maxEngagement > 0 ? video.engagement_score / maxEngagement : 0;

    // Composite score: 70% views (populer), 30% engagement (quality)
    const compositeScore = (normalizedViews * 0.7) + (normalizedEngagement * 0.3);

    return {
      ...video,
      composite_score: compositeScore,
    };
  });

  // Sort by composite score descending
  scoredVideos.sort((a, b) => b.composite_score - a.composite_score);

  // Return top N videos
  return scoredVideos.slice(0, limit).map(video => ({
    judul: video.judul,
    url: video.url,
    thumbnail: video.thumbnail,
    channel: video.channel,
    views: formatNumber(video.views),
    likes: formatNumber(video.likes),
    duration: parseDuration(video.duration),
    published_at: video.published_at,
  }));
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

/**
 * Format number untuk display (1.2M, 150K, dll)
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Parse ISO 8601 duration (PT15M33S) ke format readable
 */
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

  const hours = (match[1] || "").replace("H", "");
  const minutes = (match[2] || "").replace("M", "");
  const seconds = (match[3] || "").replace("S", "");

  const parts = [];
  if (hours) parts.push(`${hours}j`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && !hours) parts.push(`${seconds}d`);

  return parts.join(" ") || "0m";
}

/**
 * Get top videos untuk multiple materi sekaligus
 * Useful untuk dashboard atau bulk recommendations
 */
export async function getBulkVideoRecommendations(materiList, limitPerMateri = 5) {
  try {
    const results = {};

    // Fetch videos untuk setiap materi secara parallel
    const promises = materiList.map(async (materi) => {
      const videos = await getVideoRecommendations(materi, limitPerMateri);
      return { materi, videos };
    });

    const allResults = await Promise.all(promises);

    allResults.forEach(({ materi, videos }) => {
      results[materi] = videos;
    });

    return results;
  } catch (error) {
    console.error("❌ Error getting bulk recommendations:", error);
    throw error;
  }
}

/**
 * Refresh cache untuk materi tertentu
 * Dapat dipanggil via Cloud Scheduler atau manual
 */
export async function refreshVideoCache(materi) {
  try {
    console.log(`🔄 Refreshing cache for "${materi}"`);
    const videos = await fetchAndCacheVideos(materi);
    console.log(`✅ Cache refreshed: ${videos.length} videos`);
    return videos;
  } catch (error) {
    console.error(`❌ Error refreshing cache for "${materi}":`, error);
    throw error;
  }
}

/**
 * Refresh all cached materi
 * Untuk Cloud Scheduler daily update
 */
export async function refreshAllCaches() {
  try {
    console.log("🔄 Refreshing all video caches...");

    // Get all materi dari Supabase
    const { data: allMateri } = await supabaseAdmin
      .from("materi")
      .select("judul_materi");

    if (!allMateri || allMateri.length === 0) {
      console.log("⚠️ No materi found");
      return;
    }

    const materiList = allMateri.map(m => m.judul_materi);

    console.log(`📋 Refreshing cache for ${materiList.length} materi...`);

    // Refresh secara parallel dengan rate limiting
    const batchSize = 5; // Process 5 at a time to avoid rate limits
    for (let i = 0; i < materiList.length; i += batchSize) {
      const batch = materiList.slice(i, i + batchSize);
      await Promise.all(batch.map(materi => refreshVideoCache(materi)));

      // Wait 2 seconds between batches to respect API rate limits
      if (i + batchSize < materiList.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log("✅ All caches refreshed successfully");
  } catch (error) {
    console.error("❌ Error refreshing all caches:", error);
    throw error;
  }
}
