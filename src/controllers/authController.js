import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../config/SupabaseClient.js";

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
    } = req.body;

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

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) throw authError;

    const userId = authData.user.id;

    const { data, error } = await supabase
      .from("pengguna")
      .insert([
        {
          id: userId,
          email,
          password: await bcrypt.hash(password, 10),
          nama_lengkap,
          role,
          jenis_kelamin,
          nip,
          nisn,
          alamat,
          tanggal_lahir,
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "User registered",
      user: data[0]
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase
      .from("pengguna")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data)
      return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, data.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: data.id, role: data.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ message: "Login success", token, user: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];

    const { error } = await supabase.auth.admin.invalidateUserTokensByAccessToken(token);
    if (error) throw error;
    
    res.json({ message: "Logout successful" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};