import { supabase } from "../config/SupabaseClient.js";

// Middleware utama untuk verifikasi token dan attach data user
export const authMiddleware = async (req, res, next) => {
  try {
    // Ambil token dari header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Verifikasi token ke Supabase
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }

    // Ambil profil pengguna dari tabel `pengguna`
    const { data: userProfile, error: userError } = await supabase
      .from("pengguna")
      .select("id, email, role, nama_lengkap")
      .eq("id", userData.user.id)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // Simpan data user ke request agar bisa digunakan di route berikutnya
    req.user = {
      id: userProfile.id,
      email: userProfile.email,
      role: userProfile.role,
      nama_lengkap: userProfile.nama_lengkap,
    };

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
};

// Middleware tambahan untuk membatasi hanya admin/superadmin
export const requireAdminOrSuperadmin = (req, res, next) => {
  const { role } = req.user || {};
  if (role !== "admin" && role !== "superadmin") {
    return res.status(403).json({ error: "Akses ditolak: Admin atau Superadmin saja" });
  }
  next();
};
