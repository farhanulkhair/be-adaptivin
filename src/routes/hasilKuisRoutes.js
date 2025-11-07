import express from "express";
import {
  createHasilKuis,
  getAllHasilKuis,
  getHasilKuisById,
  finishHasilKuis,
  getHasilKuisBySiswa,
} from "../controllers/hasilKuisController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// CRUD hasil kuis
router.post("/", authMiddleware, createHasilKuis); // Siswa mulai kuis
router.get("/", authMiddleware, getAllHasilKuis); // Ambil semua hasil kuis (filter by kuis/siswa)
router.get("/:id", authMiddleware, getHasilKuisById); // Ambil detail hasil kuis
router.put("/:id/selesai", authMiddleware, finishHasilKuis); // Tandai kuis selesai

// Endpoint khusus
router.get("/siswa/:siswaId", authMiddleware, getHasilKuisBySiswa); // Ambil semua hasil kuis siswa

export default router;
