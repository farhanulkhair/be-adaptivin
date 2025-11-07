import express from "express";
import {
  createJawaban,
  getJawabanByHasilKuis,
  updateJawaban,
  deleteJawaban,
} from "../controllers/detailJawabanController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// CRUD jawaban
router.post("/", authMiddleware, createJawaban); // Simpan jawaban siswa
router.get("/:hasilKuisId", authMiddleware, getJawabanByHasilKuis); // Ambil semua jawaban dalam satu kuis
router.put("/:id", authMiddleware, updateJawaban); // Update jawaban (retry)
router.delete("/:id", authMiddleware, deleteJawaban); // Hapus jawaban (admin)

export default router;
