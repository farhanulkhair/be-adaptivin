import express from "express";
import {
  getAllKelas,
  createKelas,
  getKelasById,
  updateKelas,
  deleteKelas,
} from "../controllers/kelasController.js";
import {
  authMiddleware,
  requireAdminOrSuperadmin,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getAllKelas);
router.post("/", authMiddleware, requireAdminOrSuperadmin, createKelas);
router.get("/:id", authMiddleware, getKelasById);
router.put("/:id", authMiddleware, requireAdminOrSuperadmin, updateKelas);
router.delete("/:id", authMiddleware, requireAdminOrSuperadmin, deleteKelas);

export default router;
