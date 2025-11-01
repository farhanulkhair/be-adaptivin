import express from "express";
import {
  getAllAdmins,
  createAdmin,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
} from "../controllers/adminController.js";
import {
  authMiddleware,
  requireSuperadmin,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// Router for current admin profile (any admin/superadmin)
router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);
router.put("/me/password", authMiddleware, updateMyPassword);

// Router for superadmin managing admin
router.get("/", authMiddleware, requireSuperadmin, getAllAdmins);
router.post("/buat-admin", authMiddleware, requireSuperadmin, createAdmin);
router.get("/:id", authMiddleware, requireSuperadmin, getAdminById);
router.put("/:id", authMiddleware, requireSuperadmin, updateAdmin);
router.delete("/:id", authMiddleware, requireSuperadmin, deleteAdmin);

export default router;
