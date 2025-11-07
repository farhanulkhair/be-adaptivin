import express from "express";
import {
  createKuis,
  getAllKuis,
  getKuisById,
  updateKuis,
  deleteKuis,
  getSoalForKuis,
} from "../controllers/kuisController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, createKuis); // Guru membuat kuis
router.get("/", authMiddleware, getAllKuis); // Ambil semua kuis (filter by guru/materi)
router.get("/:id", authMiddleware, getKuisById); // Ambil detail kuis
router.put("/:id", authMiddleware, updateKuis); // Update kuis
router.delete("/:id", authMiddleware, deleteKuis); // Hapus kuis

// Endpoint khusus untuk mendapatkan soal adaptif
router.get("/:id/soal", authMiddleware, getSoalForKuis); // Ambil soal untuk kuis

export default router;
