import express from "express";
import { getAllSekolah, createSekolah, getSekolahById, updateSekolah, deleteSekolah } from "../controllers/sekolahController.js";
import { authMiddleware, requireAdminOrSuperadmin, requireSuperadmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, requireAdminOrSuperadmin, getAllSekolah);
router.post("/buat-sekolah", authMiddleware, requireSuperadmin, createSekolah);
router.get("/:id", authMiddleware, getSekolahById);
router.put("/:id", authMiddleware, requireSuperadmin, updateSekolah);
router.delete("/:id", authMiddleware, requireSuperadmin, deleteSekolah);

export default router;
