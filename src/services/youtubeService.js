import axios from "axios";
import { getVideoRecommendations } from "./gcpYoutubeService.js";

/**
 * Service untuk YouTube Data API v3
 * Mencari video pembelajaran yang relevan dengan materi
 *
 * UPDATED: Sekarang menggunakan GCP Firestore cache untuk performa lebih baik
 * dan ranking berdasarkan views + likes terbanyak
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const USE_GCP_CACHE = process.env.USE_GCP_CACHE !== "false"; // Default: true

/**
 * Mencari video YouTube berdasarkan query
 * @param {string} query - Kata kunci pencarian
 * @param {number} maxResults - Jumlah hasil maksimal (default: 3)
 * @returns {Promise<Array>} Array of video objects dengan judul dan URL
 */
export async function searchYouTubeVideos(query, maxResults = 3) {
  try {
    if (!YOUTUBE_API_KEY) {
      console.error("❌ YOUTUBE_API_KEY not found in .env");
      return getFallbackVideos(query);
    }

    console.log(`🔍 Searching YouTube for: "${query}"`);

    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
      params: {
        key: YOUTUBE_API_KEY,
        q: query,
        part: "snippet",
        type: "video",
        maxResults: maxResults,
        videoEmbeddable: true,
        videoSyndicated: true,
        relevanceLanguage: "id", // Prioritas bahasa Indonesia
        safeSearch: "strict", // Filter konten aman untuk anak
        order: "relevance", // Urutkan berdasarkan relevansi
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.data.items || response.data.items.length === 0) {
      console.warn("⚠️ No videos found, using fallback");
      return getFallbackVideos(query);
    }

    const videos = response.data.items.map((item) => ({
      judul: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.medium.url,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

    console.log(`✅ Found ${videos.length} videos`);
    return videos;
  } catch (error) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.error("❌ Network error searching YouTube:", error.message);
      console.log("💡 Tip: Check your internet connection or proxy settings");
    } else if (error.response?.status === 403) {
      console.error("❌ YouTube API quota exceeded or invalid key");
    } else {
      console.error("❌ Error searching YouTube:", error.message);
    }
    return getFallbackVideos(query);
  }
}

/**
 * Normalize materi name - extract core topic from potentially long title
 * Example: "belajar Pecahan SD kelas 4" -> "Pecahan"
 */
function normalizeMateriName(materi) {
  if (!materi) return materi;

  // Remove common prefixes
  let normalized = materi
    .replace(/^(belajar|tutorial|materi|pengenalan|pembelajaran)\s+/i, '')
    .replace(/\s+(untuk\s+)?(anak\s+)?SD(\s+kelas\s+\d+)?$/i, '')
    .replace(/\s+matematika$/i, '')
    .trim();

  // If normalized is empty, return original
  return normalized || materi;
}

/**
 * Mencari video untuk materi tertentu dengan berbagai variasi query
 * @param {string} materi - Nama materi (misal: "Pecahan" atau "belajar Pecahan SD kelas 4")
 * @returns {Promise<Array>} Array of 3 best videos
 */
export async function searchEducationalVideos(materi) {
  try {
    // Normalize materi name untuk avoid duplikasi
    const coreMateri = normalizeMateriName(materi);
    console.log(`📚 Original materi: "${materi}" -> Normalized: "${coreMateri}"`);

    // FEATURE: Gunakan GCP cache dengan ranking berdasarkan views + likes
    if (USE_GCP_CACHE) {
      console.log("🚀 Using GCP Firestore cache with smart ranking...");
      const videos = await getVideoRecommendations(coreMateri, 3);

      // Format untuk compatibility dengan existing code
      return videos.map(video => ({
        judul: video.judul,
        url: video.url,
        thumbnail: video.thumbnail,
        channel: video.channel,
        publishedAt: video.published_at,
        views: video.views, // Sudah dalam format readable (1.2M, 150K)
        likes: video.likes,
      }));
    }

    // FALLBACK: Gunakan direct YouTube API (legacy)
    console.log("⚠️ Using legacy YouTube API (GCP cache disabled)");

    // Coba beberapa query untuk hasil terbaik
    const queries = [
      `${coreMateri} SD kelas 4`,
      `belajar ${coreMateri} untuk anak SD`,
      `tutorial ${coreMateri} matematika SD`,
    ];

    // Cari dengan query pertama dulu
    let videos = await searchYouTubeVideos(queries[0], 3);

    // Kalau kurang dari 3, coba query lain
    if (videos.length < 3) {
      const moreVideos = await searchYouTubeVideos(queries[1], 3 - videos.length);
      videos = [...videos, ...moreVideos];
    }

    // Ambil top 3 saja
    return videos.slice(0, 3);
  } catch (error) {
    console.error("❌ Error in searchEducationalVideos:", error);
    return getFallbackVideos(materi);
  }
}

/**
 * Fallback videos kalau API gagal
 * Menggunakan direct YouTube search URLs
 */
function getFallbackVideos(materi) {
  console.log("⚠️ Using fallback videos (YouTube search URLs)");

  // Normalize materi untuk avoid duplikasi
  const coreMateri = normalizeMateriName(materi);

  // Generate direct YouTube search links
  return [
    {
      judul: `Belajar ${coreMateri} - SD Kelas 4`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`belajar ${coreMateri} SD kelas 4`)}`,
      channel: "YouTube Search",
      thumbnail: "https://via.placeholder.com/320x180?text=Video+1",
    },
    {
      judul: `Tutorial ${coreMateri} Mudah Dipahami`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`tutorial ${coreMateri} SD mudah`)}`,
      channel: "YouTube Search",
      thumbnail: "https://via.placeholder.com/320x180?text=Video+2",
    },
    {
      judul: `${coreMateri} untuk Anak SD`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${coreMateri} anak SD`)}`,
      channel: "YouTube Search",
      thumbnail: "https://via.placeholder.com/320x180?text=Video+3",
    },
  ];
}

/**
 * Format video untuk output JSON analisis
 * @param {Array} videos - Array of video objects
 * @returns {Array} Formatted videos untuk JSON
 */
export function formatVideosForAnalysis(videos) {
  return videos.map((video) => ({
    judul: video.judul,
    url: video.url,
  }));
}
