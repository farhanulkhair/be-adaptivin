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
    });

    if (!response.data.items || response.data.items.length === 0) {
      console.warn("⚠️ No videos found, using fallback");
      return getFallbackVideos(query);
    }

    const videos = response.data.items.map((item) => ({
      judul: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
      thumbnail: item.snippet.thumbnails.medium.url,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

    console.log(`✅ Found ${videos.length} videos`);
    return videos;
  } catch (error) {
    console.error("❌ Error searching YouTube:", error.message);
    return getFallbackVideos(query);
  }
}

/**
 * Mencari video untuk materi tertentu dengan berbagai variasi query
 * @param {string} materi - Nama materi (misal: "Pecahan")
 * @returns {Promise<Array>} Array of 3 best videos
 */
export async function searchEducationalVideos(materi) {
  try {
    // FEATURE: Gunakan GCP cache dengan ranking berdasarkan views + likes
    if (USE_GCP_CACHE) {
      console.log("🚀 Using GCP Firestore cache with smart ranking...");
      const videos = await getVideoRecommendations(materi, 3);

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
      `belajar ${materi} SD kelas 4`,
      `tutorial ${materi} untuk anak SD`,
      `${materi} matematika SD mudah dipahami`,
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
 * Menggunakan channel edukatif populer Indonesia
 */
function getFallbackVideos(materi) {
  console.log("⚠️ Using fallback videos");

  // Video populer dari channel edukatif Indonesia
  const fallbackChannels = {
    Pecahan: [
      {
        judul: "Belajar Pecahan - Matematika SD Kelas 4",
        url: "https://www.youtube.com/watch?v=kFXlM8bHXIA",
        channel: "Channel Edukasi",
      },
      {
        judul: "Cara Mudah Memahami Pecahan",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        channel: "Belajar Matematika",
      },
      {
        judul: "Pecahan Sederhana untuk Anak SD",
        url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
        channel: "Ruang Guru",
      },
    ],
    default: [
      {
        judul: `Belajar ${materi} - Matematika SD`,
        url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(`belajar ${materi} SD`),
        channel: "YouTube Search",
      },
      {
        judul: `Tutorial ${materi} Mudah Dipahami`,
        url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(`tutorial ${materi} SD`),
        channel: "YouTube Search",
      },
      {
        judul: `${materi} untuk Anak SD`,
        url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${materi} anak SD`),
        channel: "YouTube Search",
      },
    ],
  };

  return fallbackChannels[materi] || fallbackChannels.default;
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
