import jwt from "jsonwebtoken";
import { supabase } from "../config/supabaseClient.js";

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
    const { data: userProfile, error } = await supabase
      .from("pengguna")
      .select("id, email, role, nama_lengkap")
      .eq("id", decoded.id)
      .single();

    if (error || !userProfile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    req.user = userProfile;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware tambahan: hanya untuk admin/superadmin
export const requireAdminOrSuperadmin = (req, res, next) => {
  const { role } = req.user || {};
  if (role !== "admin" && role !== "superadmin") {
    return res.status(403).json({ error: "Akses ditolak: Admin atau Superadmin saja" });
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
