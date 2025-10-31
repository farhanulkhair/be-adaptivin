import { supabase } from '../config/supabaseClient.js';

export const getAllAdmins = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa mengakses data admin" });
    }
    const { data, error } = await supabase
      .from("pengguna")
      .select("*")
      .eq("role", "admin");
    if (error) throw error;
    res.json({ message: "Admins retrieved successfully", users: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { role } = req.user; // harus superadmin
    if (role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa menambah admin" });
    }

    const { email, password, nama, sekolah_id } = req.body;

    // insert ke tabel pengguna
    const { data, error } = await supabase
      .from("pengguna")
      .insert([{ email, password, nama, role: "admin", sekolah_id }])
      .select();

    if (error) throw error;
    res.status(201).json({ message: "Admin berhasil ditambahkan", user: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { role } = req.user; 
    if (role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa mengubah admin" });
    }
    const { id } = req.params;
    const { email, nama, sekolah_id } = req.body;
    const { data, error } = await supabase
      .from("pengguna")
      .update({ email, nama, sekolah_id, updated_at: new Date() })
      .eq("id", id)
      .eq("role", "admin")
      .select();

    if (error) throw error;
    res.json({ message: "Admin berhasil diubah", user: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAdminById = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa mengakses data admin" });
    }

    const { id } = req.params;
    const { data, error } = await supabase
      .from("pengguna")
      .select("*")
      .eq("id", id)
      .eq("role", "admin")
      .single();
    if (error) throw error;

    res.json({ message: "Admin retrieved successfully", user: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa menghapus admin" });
    }
    const { id } = req.params;
    const { data, error } = await supabase
      .from("pengguna")
      .delete()
      .eq("id", id)
      .eq("role", "admin")
      .select();
    if (error) throw error;
    res.json({ message: "Admin deleted successfully", user: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};