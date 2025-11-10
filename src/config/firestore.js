import { Firestore } from "@google-cloud/firestore";

/**
 * Firestore Configuration untuk cache video YouTube
 * Menggunakan Google Cloud Firestore untuk menyimpan data video
 */

// Only initialize if GCP credentials are provided
let firestore = null;

if (process.env.GCP_PROJECT_ID && process.env.GCP_KEY_FILE) {
  try {
    firestore = new Firestore({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE, // Path ke service account key JSON
    });
    console.log("✅ Firestore initialized successfully");
  } catch (error) {
    console.warn("⚠️ Firestore initialization failed:", error.message);
    console.warn("📌 YouTube cache will use memory only");
  }
} else {
  console.warn("⚠️ GCP credentials not found, Firestore disabled");
  console.warn("📌 Set GCP_PROJECT_ID and GCP_KEY_FILE to enable Firestore");
}

// Collections
export const COLLECTIONS = {
  YOUTUBE_VIDEOS: "youtube_videos_cache",
  VIDEO_STATS: "video_statistics",
};

export default firestore;
