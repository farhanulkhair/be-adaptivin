import { Firestore } from "@google-cloud/firestore";

/**
 * Firestore Configuration untuk cache video YouTube
 * Menggunakan Google Cloud Firestore untuk menyimpan data video
 */

// Initialize Firestore
const firestore = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE, // Path ke service account key JSON
});

// Collections
export const COLLECTIONS = {
  YOUTUBE_VIDEOS: "youtube_videos_cache",
  VIDEO_STATS: "video_statistics",
};

export default firestore;
