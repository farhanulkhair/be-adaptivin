import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
} from "../controllers/userController.js";
import {
  authMiddleware,
  requireAdminOrSuperadmin,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Routes for user guru and siswa - Harus pakai authentication
router.get("/", authMiddleware, requireAdminOrSuperadmin, getAllUsers);
router.post("/", authMiddleware, requireAdminOrSuperadmin, createUser);
router.get("/:id", authMiddleware, requireAdminOrSuperadmin, getUserById);
router.put("/:id", authMiddleware, requireAdminOrSuperadmin, updateUser);
router.delete("/:id", authMiddleware, requireAdminOrSuperadmin, deleteUser);

export default router;
