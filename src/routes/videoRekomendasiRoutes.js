import express from "express";
import {
  getVideoByMateri,
  getBulkVideos,
  refreshCache,
  getTrendingVideos,
} from "../controllers/videoRekomendasiController.js";
import { authMiddleware, requireAdminOrSuperadmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Routes untuk video rekomendasi YouTube
 * Menggunakan GCP Firestore cache
 */

// Public routes - dapat diakses oleh siswa
router.get("/materi/:materi", getVideoByMateri);
router.get("/trending", getTrendingVideos);
router.post("/bulk", getBulkVideos);

// Protected routes - hanya admin yang dapat refresh cache
router.post("/refresh/:materi", authMiddleware, requireAdminOrSuperadmin, refreshCache);

export default router;
