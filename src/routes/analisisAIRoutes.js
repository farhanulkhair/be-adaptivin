import express from "express";
import {
  createAnalisis,
  getAllAnalisis,
  getAnalisisByHasilKuis,
  getAnalisisByMateri,
  deleteAnalisis,
} from "../controllers/analisisAiController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

  // CRUD analisis
router.post("/:hasilKuisId", authMiddleware, createAnalisis); // Buat analisis AI
router.get("/", authMiddleware, getAllAnalisis); // Ambil semua analisis (filter by siswa/kuis)
router.get("/:hasilKuisId", authMiddleware, getAnalisisByHasilKuis); // Ambil analisis untuk hasil kuis
router.get("/materi/:materiId", authMiddleware, getAnalisisByMateri); // Ambil analisis by materi (guru)
router.delete("/:id", authMiddleware, deleteAnalisis); // Hapus analisis (admin)

export default router;
