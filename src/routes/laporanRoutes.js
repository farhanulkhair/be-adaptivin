import express from "express";
import {
  getLaporanSiswa,
  getHasilKuisDetail,
} from "../controllers/laporanController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get laporan per siswa
router.get(
  "/kelas/:kelasId/siswa/:siswaId",
  authMiddleware,
  getLaporanSiswa
);

// Get detail hasil kuis untuk materi tertentu
router.get(
  "/kelas/:kelasId/siswa/:siswaId/materi/:materiId/hasil-kuis",
  authMiddleware,
  getHasilKuisDetail
);

export default router;
