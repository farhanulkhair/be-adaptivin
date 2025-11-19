import jwt from "jsonwebtoken";
import { supabase } from "../config/supabaseClient.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

export const registerUser = async (req, res) => {
  try {
    const {
      email,
      password,
      nama_lengkap,
      role,
      jenis_kelamin,
      nip,
      nisn,
      alamat,
      tanggal_lahir,
      sekolah_id,
    } = req.body;

    console.log("📝 Register attempt:", { email, role });

    if (!email || !password || !nama_lengkap || !role) {
      return errorResponse(res, "Missing required fields", 400);
    }

    // Validasi berdasarkan role
    if (role === "guru" && !nip) {
      return errorResponse(res, "NIP wajib diisi untuk guru", 400);
    }

    if (role === "siswa" && !nisn) {
      return errorResponse(res, "NISN wajib diisi untuk siswa", 400);
    }

    // 1️⃣ Create user di Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nama_lengkap,
          role,
        },
      });

    if (authError) {
      console.error("❌ Auth error:", authError);
      return errorResponse(
        res,
        `Gagal membuat akun: ${authError.message}`,
        400
      );
    }

    const userId = authData.user.id;
    console.log("✅ Auth user created:", userId);

    // 2️⃣ Insert ke tabel pengguna (TANPA password!)
    const { data, error } = await supabase
      .from("pengguna")
      .insert([
        {
          id: userId,
          nama_lengkap,
          role,
          jenis_kelamin,
          nip,
          nisn,
          alamat,
          tanggal_lahir,
          sekolah_id,
        },
      ])
      .select();

    if (error) {
      console.error("❌ Insert error:", error);
      // Rollback: hapus user dari auth
      await supabase.auth.admin.deleteUser(userId);
      return errorResponse(
        res,
        `Gagal menyimpan data pengguna: ${error.message}`,
        400
      );
    }

    console.log("✅ User registered successfully:", data[0].id);

    return successResponse(
      res,
      {
        user: {
          id: data[0].id,
          email: email, // Gunakan email dari request
          nama_lengkap: data[0].nama_lengkap,
          role: data[0].role,
        },
      },
      "User registered",
      201
    );
  } catch (error) {
    console.error("❌ Registration error:", error);
    return errorResponse(res, error.message, 500);
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password, expectedRole } = req.body;

    console.log("🔐 Login attempt for:", email, "Expected role:", expectedRole);

    if (!email || !password) {
      return errorResponse(res, "Email dan password wajib diisi", 400);
    }

    // 1️⃣ Login via Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      console.error("❌ Auth error:", authError.message);
      return errorResponse(
        res,
        `Email atau password salah: ${authError.message}`,
        400
      );
    }

    console.log("✅ Auth success for user ID:", authData.user.id);

    // 2️⃣ Ambil data lengkap dari tabel pengguna
    const { data: userData, error: userError } = await supabase
      .from("pengguna")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (userError || !userData) {
      console.error("❌ User data not found:", userError);
      return errorResponse(res, "Data pengguna tidak ditemukan", 400);
    }

    console.log("✅ User data found:", email, userData.role);

    // 2.5️⃣ Validasi role jika expectedRole diberikan
    if (expectedRole && userData.role !== expectedRole) {
      console.error(
        "❌ Role mismatch: expected",
        expectedRole,
        "but got",
        userData.role
      );

      // Logout dari Supabase Auth untuk keamanan
      await supabase.auth.signOut();

      // Berikan pesan error yang jelas
      if (expectedRole === "guru" && userData.role === "siswa") {
        return errorResponse(
          res,
          "Akses ditolak! Anda tidak bisa login sebagai guru dengan akun siswa. Silakan gunakan halaman login siswa.",
          403
        );
      } else if (expectedRole === "siswa" && userData.role === "guru") {
        return errorResponse(
          res,
          "Akses ditolak! Anda tidak bisa login sebagai siswa dengan akun guru. Silakan gunakan halaman login guru.",
          403
        );
      } else {
        return errorResponse(
          res,
          `Akses ditolak! Role Anda adalah ${userData.role}, bukan ${expectedRole}.`,
          403
        );
      }
    }

    // 3️⃣ Generate JWT token (custom backend token)
    const token = jwt.sign(
      { id: userData.id, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return successResponse(
      res,
      {
        token,
        user: {
          id: userData.id,
          email: email, // Gunakan email dari request karena tabel pengguna mungkin tidak punya kolom email
          role: userData.role,
          nama_lengkap: userData.nama_lengkap,
          alamat: userData.alamat,
          jenis_kelamin: userData.jenis_kelamin,
          tanggal_lahir: userData.tanggal_lahir,
          nip: userData.nip,
          nisn: userData.nisn,
          sekolah_id: userData.sekolah_id,
          has_completed_onboarding: userData.has_completed_onboarding || false,
        },
      },
      "Login success"
    );
  } catch (error) {
    console.error("❌ Login error:", error);
    return errorResponse(res, error.message, 500);
  }
};

export const logoutUser = async (req, res) => {
  try {
    console.log("🚪 Logout attempt for user ID:", req.user?.id);
    console.log("✅ User logged out successfully:", req.user?.id);
    return successResponse(res, { success: true }, "Logout successful");
  } catch (error) {
    console.error("❌ Logout error:", error);
    return errorResponse(res, error.message || "Logout gagal", 500);
  }
};
