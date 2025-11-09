import express from "express";
import {
  createAnalisis,
  getAllAnalisis,
  getAnalisisByHasilKuis,
  getAnalisisByMateri,
  deleteAnalisis,
  checkAnalisisStatus,
} from "../controllers/analisisAiController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Check analisis status (harus di atas route dinamis lainnya)
router.get("/check/:hasilKuisId", authMiddleware, checkAnalisisStatus);

// CRUD analisis
router.post("/:hasilKuisId", authMiddleware, createAnalisis); // Buat analisis AI
router.get("/", authMiddleware, getAllAnalisis); // Ambil semua analisis (filter by siswa/kuis)
router.get("/materi/:materiId", authMiddleware, getAnalisisByMateri); // Ambil analisis by materi (guru)
router.get("/:hasilKuisId", authMiddleware, getAnalisisByHasilKuis); // Ambil analisis untuk hasil kuis
router.delete("/:id", authMiddleware, deleteAnalisis); // Hapus analisis (admin)

export default router;
