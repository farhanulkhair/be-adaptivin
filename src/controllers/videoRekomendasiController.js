import {
  getVideoRecommendations,
  getBulkVideoRecommendations,
  refreshVideoCache,
} from "../services/gcpYoutubeService.js";

/**
 * Controller untuk rekomendasi video YouTube
 * Menggunakan GCP Firestore cache dengan auto-refresh
 */

/**
 * GET /api/video-rekomendasi/:materi
 * Mendapatkan video rekomendasi untuk materi tertentu
 */
export const getVideoByMateri = async (req, res) => {
  try {
    const { materi } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    if (!materi) {
      return res.status(400).json({
        error: "Materi is required",
      });
    }

    console.log(`📺 Getting video recommendations for: ${materi}`);

    const videos = await getVideoRecommendations(materi, limit);

    res.json({
      success: true,
      materi: materi,
      video_count: videos.length,
      videos: videos,
      cached: true, // Indicate data dari cache
    });
  } catch (error) {
    console.error("❌ Error in getVideoByMateri:", error);
    res.status(500).json({
      error: "Failed to get video recommendations",
      message: error.message,
    });
  }
};

/**
 * POST /api/video-rekomendasi/bulk
 * Mendapatkan video untuk multiple materi sekaligus
 *
 * Body: { materi_list: ["Pecahan", "Perkalian"], limit: 5 }
 */
export const getBulkVideos = async (req, res) => {
  try {
    const { materi_list, limit } = req.body;

    if (!materi_list || !Array.isArray(materi_list)) {
      return res.status(400).json({
        error: "materi_list array is required",
      });
    }

    console.log(`📺 Getting bulk recommendations for ${materi_list.length} materi`);

    const limitPerMateri = parseInt(limit) || 5;
    const results = await getBulkVideoRecommendations(materi_list, limitPerMateri);

    res.json({
      success: true,
      materi_count: materi_list.length,
      results: results,
    });
  } catch (error) {
    console.error("❌ Error in getBulkVideos:", error);
    res.status(500).json({
      error: "Failed to get bulk video recommendations",
      message: error.message,
    });
  }
};

/**
 * POST /api/video-rekomendasi/refresh/:materi
 * Manual refresh cache untuk materi tertentu
 * Requires admin authentication
 */
export const refreshCache = async (req, res) => {
  try {
    const { materi } = req.params;

    if (!materi) {
      return res.status(400).json({
        error: "Materi is required",
      });
    }

    console.log(`🔄 Manual refresh cache for: ${materi}`);

    const videos = await refreshVideoCache(materi);

    res.json({
      success: true,
      message: "Cache refreshed successfully",
      materi: materi,
      video_count: videos.length,
    });
  } catch (error) {
    console.error("❌ Error in refreshCache:", error);
    res.status(500).json({
      error: "Failed to refresh cache",
      message: error.message,
    });
  }
};

/**
 * GET /api/video-rekomendasi/trending
 * Mendapatkan video trending untuk semua materi
 * Diurutkan berdasarkan views dan engagement tertinggi
 */
export const getTrendingVideos = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    console.log(`🔥 Getting trending videos (limit: ${limit})`);

    // Get semua materi populer
    const popularMateri = [
      "Pecahan",
      "Perkalian dan Pembagian",
      "Bangun Datar",
      "Bilangan Bulat",
    ];

    // Get video dari semua materi
    const allVideosMap = await getBulkVideoRecommendations(popularMateri, 10);

    // Flatten dan sort by views
    const allVideos = [];
    Object.entries(allVideosMap).forEach(([materi, videos]) => {
      videos.forEach(video => {
        allVideos.push({
          ...video,
          materi: materi,
        });
      });
    });

    // Sort by views (already formatted as string like "1.2M")
    // Need to convert back to number for sorting
    allVideos.sort((a, b) => {
      const viewsA = parseFormattedNumber(a.views);
      const viewsB = parseFormattedNumber(b.views);
      return viewsB - viewsA;
    });

    const trendingVideos = allVideos.slice(0, limit);

    res.json({
      success: true,
      video_count: trendingVideos.length,
      videos: trendingVideos,
    });
  } catch (error) {
    console.error("❌ Error in getTrendingVideos:", error);
    res.status(500).json({
      error: "Failed to get trending videos",
      message: error.message,
    });
  }
};

/**
 * Helper: Parse formatted number string (1.2M, 150K) ke number
 */
function parseFormattedNumber(str) {
  if (typeof str === "number") return str;

  const num = parseFloat(str);
  if (str.includes("M")) return num * 1000000;
  if (str.includes("K")) return num * 1000;
  return num;
}
