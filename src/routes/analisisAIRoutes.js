import express from "express";
import {
  createAnalisis,
  getAllAnalisis,
  getAnalisisByHasilKuis,
  getAnalisisByMateri,
  deleteAnalisis,
  checkAnalisisStatus,
  createTeacherAnalysis,
  getTeacherAnalysisByHasilKuis,
  getTeacherAnalysisByMateri,
  getTeacherAnalysisBySiswa,
  checkTeacherAnalysisStatus,
  deleteTeacherAnalysis,
} from "../controllers/analisisAIController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ========================================
// ANALISIS UNTUK GURU - HARUS DI ATAS ROUTE SISWA!
// ========================================
// PENTING: Route yang lebih spesifik (/guru/...) harus di atas route umum (/:hasilKuisId)
// untuk menghindari konflik routing

// Check analisis guru status
router.get(
  "/guru/check/:hasilKuisId",
  authMiddleware,
  checkTeacherAnalysisStatus
);

// CRUD analisis guru
router.post("/guru/:hasilKuisId", authMiddleware, createTeacherAnalysis); // Buat analisis strategi untuk guru
router.get(
  "/guru/materi/:materiId",
  authMiddleware,
  getTeacherAnalysisByMateri
); // Ambil analisis guru by materi
router.get("/guru/siswa/:siswaId", authMiddleware, getTeacherAnalysisBySiswa); // Ambil analisis guru by siswa
router.get("/guru/:hasilKuisId", (req, res, next) => {
  console.log("🎯 Route HIT: /guru/:hasilKuisId with param:", req.params.hasilKuisId);
  next();
}, authMiddleware, getTeacherAnalysisByHasilKuis); // Ambil analisis guru untuk hasil kuis
router.delete("/guru/:id", authMiddleware, deleteTeacherAnalysis); // Hapus analisis guru

// ========================================
// ANALISIS UNTUK SISWA
// ========================================

// Check analisis status (harus di atas route dinamis lainnya)
router.get("/check/:hasilKuisId", authMiddleware, checkAnalisisStatus);

// CRUD analisis siswa
router.post("/:hasilKuisId", authMiddleware, createAnalisis); // Buat analisis AI untuk siswa
router.get("/", authMiddleware, getAllAnalisis); // Ambil semua analisis (filter by siswa/kuis)
router.get("/materi/:materiId", authMiddleware, getAnalisisByMateri); // Ambil analisis by materi
router.get("/:hasilKuisId", authMiddleware, getAnalisisByHasilKuis); // Ambil analisis untuk hasil kuis
router.delete("/:id", authMiddleware, deleteAnalisis); // Hapus analisis (admin)

export default router;
