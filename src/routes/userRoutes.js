import express from "express";
import multer from "multer";
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
  downloadTemplate,
  previewImport,
  importUsers,
  exportUsers,
} from "../controllers/userController.js";
import {
  authMiddleware,
  requireAdminOrSuperadmin,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format file tidak didukung. Hanya .xlsx atau .csv"));
    }
  },
});

// ✅ Import/Export routes
router.get(
  "/template/:role",
  authMiddleware,
  requireAdminOrSuperadmin,
  downloadTemplate
);
router.post(
  "/import/preview",
  authMiddleware,
  requireAdminOrSuperadmin,
  upload.single("file"),
  previewImport
);
router.post(
  "/import",
  authMiddleware,
  requireAdminOrSuperadmin,
  upload.single("file"),
  importUsers
);
router.get("/export", authMiddleware, requireAdminOrSuperadmin, exportUsers);

// ✅ Get all karakter (for pilih karakter page)
router.get("/karakter", authMiddleware, getAllKarakter);

// ✅ Self-service routes (guru/siswa can access their own profile)
router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);
router.put("/me/password", authMiddleware, updateMyPassword);

// ✅ Get siswa by kelas (guru can see their students)
router.get("/kelas/:kelasId/siswa", authMiddleware, getSiswaByKelas);

// ✅ Bulk move students to another class
router.post(
  "/bulk-move",
  authMiddleware,
  requireAdminOrSuperadmin,
  bulkMoveStudents
);

// ✅ Reset user password
router.post(
  "/:id/reset-password",
  authMiddleware,
  requireAdminOrSuperadmin,
  resetUserPassword
);

// ✅ Routes for user guru and siswa - Harus pakai authentication
router.get("/", authMiddleware, requireAdminOrSuperadmin, getAllUsers);
router.post("/", authMiddleware, requireAdminOrSuperadmin, createUser);
router.get("/:id", authMiddleware, requireAdminOrSuperadmin, getUserById);
router.put("/:id", authMiddleware, requireAdminOrSuperadmin, updateUser);
router.delete("/:id", authMiddleware, requireAdminOrSuperadmin, deleteUser);

export default router;
