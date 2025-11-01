import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../config/supabaseAdmin.js";

const mapAuthErrorToStatus = (err) => {
  if (!err) return { status: 401, message: "Unauthorized" };

  if (err.name === "TokenExpiredError") {
    return { status: 401, message: "Token expired" };
  }

  if (err.name === "JsonWebTokenError" || err.name === "NotBeforeError") {
    return { status: 401, message: "Invalid token" };
  }

  return { status: 401, message: "Unauthorized" };
};

// Middleware utama untuk verifikasi token JWT custom kamu
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verifikasi token menggunakan secret yang sama seperti di loginUser
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ambil profil user dari Supabase berdasarkan ID yang ada di payload token
    const { data: userProfile, error } = await supabaseAdmin
      .from("pengguna")
      .select("id, role, nama_lengkap, sekolah_id")
      .eq("id", decoded.id)
      .maybeSingle();

    if (error) {
      console.error("Supabase user fetch error:", error);
      return res.status(500).json({
        error: "Failed to retrieve user profile",
        details: error.message,
      });
    }

    if (!userProfile) {
      console.warn("Auth Middleware: user profile not found for", decoded.id);
      return res.status(401).json({ error: "User profile not found" });
    }

    req.user = userProfile;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    const { status, message } = mapAuthErrorToStatus(err);
    res.status(status).json({ error: message });
  }
};

// Middleware tambahan: hanya untuk admin/superadmin
export const requireAdminOrSuperadmin = (req, res, next) => {
  const { role } = req.user || {};
  if (role !== "admin" && role !== "superadmin") {
    return res
      .status(403)
      .json({ error: "Akses ditolak: Admin atau Superadmin saja" });
  }
  next();
};

// Middleware tambahan: hanya untuk superadmin
export const requireSuperadmin = (req, res, next) => {
  const { role } = req.user || {};
  if (role !== "superadmin") {
    return res.status(403).json({ error: "Akses ditolak: Superadmin saja" });
  }
  next();
};
