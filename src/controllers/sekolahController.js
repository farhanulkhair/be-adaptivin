import { supabase } from "../config/SupabaseClient.js";

export const getAllSekolah = async (req, res) => {
  try {
    const { role, id: userId } = req.user || req.body; // ambil role dan id dari user login

    let query = supabase.from("sekolah").select("*");

    if (role === "admin") {
      query = query.eq("creator_id", userId);
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

export const createSekolah = async (req, res) => {
  try {
    const { role, id: creator_id } = req.user || req.body;
    const { nama_sekolah, alamat_sekolah } = req.body;

    // Cegah admin punya lebih dari 1 sekolah
    if (role === "admin") {
      const { count, error: countError } = await supabase
        .from("sekolah")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", creator_id);

      if (countError) throw countError;
      if (count > 0) {
        return res.status(400).json({ error: "Admin hanya boleh memiliki satu sekolah" });
      }
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

export const getSekolahById = async (req, res) => {
  try {
    const { id } = req.params;
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

export const updateSekolah = async (req, res) => {
  try {
    const { role, id: creator_id } = req.user || req.body;
    const { id } = req.params;
    const { nama_sekolah, alamat_sekolah } = req.body;

    let query = supabase.from("sekolah").update({
      nama_sekolah,
      alamat_sekolah,
      updated_at: new Date(),
    }).eq("id", id);

    if (role === "admin") {
      query = query.eq("creator_id", creator_id);
    }

    const { data, error } = await query.select();
    if (error) throw error;

    res.json({
      message: "Sekolah updated successfully",
      sekolah: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteSekolah = async (req, res) => {
  try {
    const { role, id: creator_id } = req.user || req.body;
    const { id } = req.params;

    let query = supabase.from("sekolah").delete().eq("id", id);
    if (role === "admin") {
      query = query.eq("creator_id", creator_id);
    }

    const { data, error } = await query.select();
    if (error) throw error;

    res.json({
      message: "Sekolah deleted successfully",
      sekolah: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

