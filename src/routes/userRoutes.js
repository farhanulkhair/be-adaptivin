import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
  getSiswaByKelas,
  getAllKarakter,
  bulkMoveStudents,
  resetUserPassword,
} from "../controllers/userController.js";
import {
  authMiddleware,
  requireAdminOrSuperadmin,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Get all karakter (for pilih karakter page)
router.get("/karakter", authMiddleware, getAllKarakter);

// ✅ Self-service routes (guru/siswa can access their own profile)
router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);
router.put("/me/password", authMiddleware, updateMyPassword);

// ✅ Get siswa by kelas (guru can see their students)
router.get("/kelas/:kelasId/siswa", authMiddleware, getSiswaByKelas);

// ✅ Bulk move students to another class
router.post("/bulk-move", authMiddleware, requireAdminOrSuperadmin, bulkMoveStudents);

// ✅ Reset user password
router.post("/:id/reset-password", authMiddleware, requireAdminOrSuperadmin, resetUserPassword);

// ✅ Routes for user guru and siswa - Harus pakai authentication
router.get("/", authMiddleware, requireAdminOrSuperadmin, getAllUsers);
router.post("/", authMiddleware, requireAdminOrSuperadmin, createUser);
router.get("/:id", authMiddleware, requireAdminOrSuperadmin, getUserById);
router.put("/:id", authMiddleware, requireAdminOrSuperadmin, updateUser);
router.delete("/:id", authMiddleware, requireAdminOrSuperadmin, deleteUser);

export default router;
