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
      return errorResponse(
        res,
        `Gagal membuat akun: ${authError.message}`,
        400
      );
    }

    const userId = authData.user.id;

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
      // Rollback: hapus user dari auth
      await supabase.auth.admin.deleteUser(userId);
      return errorResponse(
        res,
        `Gagal menyimpan data pengguna: ${error.message}`,
        400
      );
    }

    return successResponse(
      res,
      {
        user: {
          id: data[0].id,
          email: email,
          nama_lengkap: data[0].nama_lengkap,
          role: data[0].role,
        },
      },
      "User registered",
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password, expectedRole } = req.body;

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
      return errorResponse(
        res,
        `Email atau password salah: ${authError.message}`,
        400
      );
    }

    // 2️⃣ Ambil data lengkap dari tabel pengguna
    const { data: userData, error: userError } = await supabase
      .from("pengguna")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (userError || !userData) {
      return errorResponse(res, "Data pengguna tidak ditemukan", 400);
    }

    // 2.5️⃣ Validasi role jika expectedRole diberikan
    if (expectedRole && userData.role !== expectedRole) {
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
          email: email,
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
    return errorResponse(res, error.message, 500);
  }
};

export const logoutUser = async (req, res) => {
  try {
    return successResponse(res, { success: true }, "Logout successful");
  } catch (error) {
    return errorResponse(res, error.message || "Logout gagal", 500);
  }
};
