import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabaseClient.js";

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
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validasi berdasarkan role
    if (role === "guru" && !nip) {
      return res.status(400).json({ error: "NIP wajib diisi untuk guru" });
    }

    if (role === "siswa" && !nisn) {
      return res.status(400).json({ error: "NISN wajib diisi untuk siswa" });
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
      return res.status(400).json({
        error: "Gagal membuat akun",
        details: authError.message,
      });
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
      return res.status(400).json({
        error: "Gagal menyimpan data pengguna",
        details: error.message,
      });
    }

    console.log("✅ User registered successfully:", data[0].id);

    res.status(201).json({
      message: "User registered",
      user: {
        id: data[0].id,
        email: data[0].email,
        nama_lengkap: data[0].nama_lengkap,
        role: data[0].role,
      },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      error: error.message,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt for:", email);

    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    // 1️⃣ Login via Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      console.error("❌ Auth error:", authError.message);
      return res.status(400).json({
        error: "Email atau password salah",
        details: authError.message,
      });
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
      return res.status(400).json({ error: "Data pengguna tidak ditemukan" });
    }

    console.log("✅ User data found:", userData.email, userData.role);

    // 3️⃣ Generate JWT token (custom backend token)
    const token = jwt.sign(
      { id: userData.id, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login success",
      token,
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        nama_lengkap: userData.nama_lengkap,
        sekolah_id: userData.sekolah_id,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    console.log("🚪 Logout attempt for user ID:", req.user?.id);
    console.log("✅ User logged out successfully:", req.user?.id);
    res.json({
      message: "Logout successful",
      success: true,
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({
      error: error.message || "Logout gagal",
      success: false,
    });
  }
};
