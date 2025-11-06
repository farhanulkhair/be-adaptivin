import express from "express";
import {
  getAllSoal,
  getSoalById,
  getSoalCountByMateri,
  createSoal,
  updateSoal,
  deleteSoal,
  getMateriDropdown,
  upload,
} from "../controllers/soalController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==================== PUBLIC/AUTHENTICATED ROUTES ====================

/**
 * GET /api/soal/materi-dropdown
 * Get list materi for dropdown
 * Access: Authenticated (Guru)
 */
router.get("/materi-dropdown", authMiddleware, getMateriDropdown);

/**
 * GET /api/soal
 * Get all soal (with optional filters)
 * Query params: materi_id, level_soal, tipe_jawaban
 * Access: Authenticated (Guru)
 */
router.get("/", authMiddleware, getAllSoal);

/**
 * GET /api/soal/materi/:materi_id/count
 * Get count soal per level by materi_id
 * Access: Authenticated (Guru)
 */
router.get("/materi/:materi_id/count", authMiddleware, getSoalCountByMateri);

/**
 * GET /api/soal/:id
 * Get soal by ID with jawaban
 * Access: Authenticated (Guru)
 */
router.get("/:id", authMiddleware, getSoalById);

/**
 * POST /api/soal
 * Create new soal with jawaban
 * Supports multipart/form-data for image upload
 * Access: Authenticated (Guru only)
 *
 * Body (form-data):
 * - materi_id: string (required)
 * - level_soal: string (c1-c6) (required)
 * - tipe_jawaban: string (pilihan_ganda|pilihan_ganda_kompleks|isian_singkat) (required)
 * - soal_teks: string (required)
 * - soal_gambar: file (optional, image only)
 * - penjelasan: string (optional)
 * - gambar_pendukung_jawaban: file (optional, image only)
 * - durasi_soal: number (dalam menit) (required)
 * - jawaban: JSON string array (required)
 *   Format: [{ isi_jawaban: "text", is_benar: true/false }]
 *   Contoh: [{"isi_jawaban":"A. Option 1","is_benar":false},{"isi_jawaban":"B. Option 2","is_benar":true}]
 */
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "soal_gambar", maxCount: 1 },
    { name: "gambar_pendukung_jawaban", maxCount: 1 },
  ]),
  createSoal
);

/**
 * PUT /api/soal/:id
 * Update soal and jawaban
 * Supports multipart/form-data for image upload
 * Access: Authenticated (Guru only)
 *
 * Body (form-data):
 * - All fields same as POST (all optional)
 * - hapus_soal_gambar: string ("true" to delete)
 * - hapus_gambar_pendukung: string ("true" to delete)
 */
router.put(
  "/:id",
  authMiddleware,
  upload.fields([
    { name: "soal_gambar", maxCount: 1 },
    { name: "gambar_pendukung_jawaban", maxCount: 1 },
  ]),
  updateSoal
);

/**
 * DELETE /api/soal/:id
 * Delete soal (cascade delete jawaban)
 * Access: Authenticated (Guru only)
 */
router.delete("/:id", authMiddleware, deleteSoal);

export default router;
