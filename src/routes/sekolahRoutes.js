import express from "express";
import { getAllSekolah, createSekolah, getSekolahById, updateSekolah, deleteSekolah } from "../controllers/sekolahController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getAllSekolah);
router.post("/buat-sekolah", authMiddleware, createSekolah);
router.get("/:id", authMiddleware, getSekolahById);
router.put("/:id", authMiddleware, updateSekolah);
router.delete("/:id", authMiddleware, deleteSekolah);

export default router;