import { supabase } from "../config/SupabaseClient.js";

export const getAllKelas = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let query = supabase.from("kelas").select("*");

    if (role === "admin") {
      // hanya kelas yang dibuat oleh admin ini
      query = query.eq("creator_id", userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      message: "Kelas retrieved successfully",
      kelas: data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createKelas = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    const {
      nama_kelas,
      sekolah_id,
      tingkat_kelas,
      rombel,
      mata_pelajaran,
      tahun_ajaran,
    } = req.body;

    // Validasi
    if (
      !nama_kelas ||
      !tingkat_kelas ||
      !rombel ||
      !mata_pelajaran ||
      !tahun_ajaran ||
      !sekolah_id
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Admin hanya bisa buat kelas di sekolah miliknya
    if (role === "admin") {
      // pastikan sekolah_id ini milik admin yang login
      const { data: sekolah, error: sekolahError } = await supabase
        .from("sekolah")
        .select("id, creator_id")
        .eq("id", sekolah_id)
        .single();

      if (sekolahError || !sekolah)
        throw sekolahError || new Error("Sekolah tidak ditemukan");

      if (sekolah.creator_id !== userId) {
        return res
          .status(403)
          .json({ error: "Anda tidak memiliki akses ke sekolah ini" });
      }
    }

    const { data, error } = await supabase
      .from("kelas")
      .insert([
        {
          nama_kelas,
          sekolah_id,
          creator_id: userId,
          tingkat_kelas,
          rombel,
          mata_pelajaran,
          tahun_ajaran,
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Kelas created successfully",
      kelas: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getKelasById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    let query = supabase.from("kelas").select("*").eq("id", id).single();

    if (role === "admin") {
      query = query.eq("creator_id", userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      message: "Kelas retrieved successfully",
      kelas: data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateKelas = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;
    const {
      nama_kelas,
      sekolah_id,
      tingkat_kelas,
      rombel,
      mata_pelajaran,
      tahun_ajaran,
    } = req.body;

    let query = supabase
      .from("kelas")
      .update({
        nama_kelas,
        sekolah_id,
        tingkat_kelas,
        rombel,
        mata_pelajaran,
        tahun_ajaran,
      })
      .eq("id", id)
      .select();

    if (role === "admin") {
      query = query.eq("creator_id", userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      message: "Kelas updated successfully",
      kelas: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteKelas = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    let query = supabase.from("kelas").delete().eq("id", id).select();

    if (role === "admin") {
      query = query.eq("creator_id", userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      message: "Kelas deleted successfully",
      kelas: data[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
