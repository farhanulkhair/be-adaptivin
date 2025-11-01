import { supabase } from "../config/supabaseClient.js";

// 🟢 Superadmin bisa lihat semua sekolah, admin hanya sekolahnya
export const getAllSekolah = async (req, res) => {
  try {
    const { role, sekolah_id } = req.user || req.body;

    let query = supabase.from("sekolah").select("*");

    if (role === "admin") {
      query = query.eq("id", sekolah_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      message: "Sekolah retrieved successfully",
      sekolah: data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🟢 Hanya superadmin yang bisa membuat sekolah
export const createSekolah = async (req, res) => {
  try {
    const { role, id: creator_id } = req.user || req.body;
    const { nama_sekolah, alamat_sekolah } = req.body;

    if (role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Hanya superadmin yang dapat membuat sekolah" });
    }

    const { data, error } = await supabase
      .from("sekolah")
      .insert([{ nama_sekolah, alamat_sekolah, creator_id }])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Sekolah created successfully",
      sekolah: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🟢 Superadmin bisa lihat detail sekolah (admin hanya sekolah sendiri)
export const getSekolahById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, sekolah_id } = req.user || req.body;

    if (role !== "superadmin" && sekolah_id !== id) {
      return res
        .status(403)
        .json({ error: "Hanya superadmin yang bisa melihat data detail sekolah" });
    }

    const { data, error } = await supabase
      .from("sekolah")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    res.json({
      message: "Sekolah retrieved successfully",
      sekolah: data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🟢 Hanya superadmin yang boleh update sekolah
export const updateSekolah = async (req, res) => {
  try {
    const { role } = req.user || req.body;
    const { id } = req.params;
    const { nama_sekolah, alamat_sekolah } = req.body;

    if (role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Hanya superadmin yang dapat mengubah sekolah" });
    }

    const { data, error } = await supabase
      .from("sekolah")
      .update({
        nama_sekolah,
        alamat_sekolah,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    res.json({
      message: "Sekolah updated successfully",
      sekolah: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🟢 Hanya superadmin yang boleh hapus sekolah
export const deleteSekolah = async (req, res) => {
  try {
    const { role } = req.user || req.body;
    const { id } = req.params;

    if (role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Hanya superadmin yang dapat menghapus sekolah" });
    }

    const { data, error } = await supabase
      .from("sekolah")
      .delete()
      .eq("id", id)
      .select();

    if (error) throw error;

    res.json({
      message: "Sekolah deleted successfully",
      sekolah: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
