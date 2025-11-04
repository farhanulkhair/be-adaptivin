import express from "express";
import multer from "multer";
import {
  getMateriByKelas,
  getMateriById,
  createMateri,
  updateMateri,
  deleteMateri,
  getSubMateriByMateri,
  getSubMateriById,
  createSubMateri,
  updateSubMateri,
  deleteSubMateri,
  uploadMedia,
  deleteMedia,
  getMediaBySubMateri,
} from "../controllers/materiController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory as Buffer
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types, validation happens in controller
    cb(null, true);
  },
});

// ==================== MATERI ROUTES ====================
router.get("/materi/kelas/:kelasId", authMiddleware, getMateriByKelas);
router.get("/materi/:id", authMiddleware, getMateriById);
router.post("/materi", authMiddleware, createMateri);
router.put("/materi/:id", authMiddleware, updateMateri);
router.delete("/materi/:id", authMiddleware, deleteMateri);

// ==================== SUB_MATERI ROUTES ====================
router.get(
  "/sub-materi/materi/:materiId",
  authMiddleware,
  getSubMateriByMateri
);
router.get("/sub-materi/:id", authMiddleware, getSubMateriById);
router.post(
  "/sub-materi",
  authMiddleware,
  upload.any(),
  createSubMateri
);
router.put("/sub-materi/:id", authMiddleware, updateSubMateri);
router.delete("/sub-materi/:id", authMiddleware, deleteSubMateri);

// ==================== MEDIA ROUTES ====================
router.post(
  "/media/sub-materi/:subMateriId",
  authMiddleware,
  upload.single("file"),
  uploadMedia
);
router.delete("/media/:mediaId", authMiddleware, deleteMedia);
router.get(
  "/media/sub-materi/:subMateriId",
  authMiddleware,
  getMediaBySubMateri
);

export default router;
