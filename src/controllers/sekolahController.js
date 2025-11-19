import { supabase } from "../config/supabaseClient.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

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

    return successResponse(res, data, "Sekolah retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// 🟢 Hanya superadmin yang bisa membuat sekolah
export const createSekolah = async (req, res) => {
  try {
    const { role, id: creator_id } = req.user || req.body;
    const { nama_sekolah, alamat_sekolah } = req.body;

    if (role !== "superadmin") {
      return errorResponse(
        res,
        "Hanya superadmin yang dapat membuat sekolah",
        403
      );
    }

    const { data, error } = await supabase
      .from("sekolah")
      .insert([{ nama_sekolah, alamat_sekolah, creator_id }])
      .select();

    if (error) throw error;

    return successResponse(res, data[0], "Sekolah created successfully", 201);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// 🟢 Superadmin bisa lihat detail sekolah (admin hanya sekolah sendiri)
export const getSekolahById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, sekolah_id } = req.user || req.body;

    if (role !== "superadmin" && sekolah_id !== id) {
      return errorResponse(
        res,
        "Hanya superadmin yang bisa melihat data detail sekolah",
        403
      );
    }

    const { data, error } = await supabase
      .from("sekolah")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return successResponse(res, data, "Sekolah retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// 🟢 Hanya superadmin yang boleh update sekolah
export const updateSekolah = async (req, res) => {
  try {
    const { role } = req.user || req.body;
    const { id } = req.params;
    const { nama_sekolah, alamat_sekolah } = req.body;

    if (role !== "superadmin") {
      return errorResponse(
        res,
        "Hanya superadmin yang dapat mengubah sekolah",
        403
      );
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

    return successResponse(res, data[0], "Sekolah updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// 🟢 Hanya superadmin yang boleh hapus sekolah
export const deleteSekolah = async (req, res) => {
  try {
    const { role } = req.user || req.body;
    const { id } = req.params;

    if (role !== "superadmin") {
      return errorResponse(
        res,
        "Hanya superadmin yang dapat menghapus sekolah",
        403
      );
    }

    // Verify sekolah exists
    const { data: existingSekolah, error: checkError } = await supabase
      .from("sekolah")
      .select("id, nama_sekolah")
      .eq("id", id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!existingSekolah) {
      return errorResponse(res, "Sekolah tidak ditemukan", 404);
    }
    
    // Get count of related data before deletion
    const { count: guruCount } = await supabase
      .from("pengguna")
      .select("*", { count: "exact", head: true })
      .eq("sekolah_id", id)
      .eq("role", "guru");

    const { count: siswaCount } = await supabase
      .from("pengguna")
      .select("*", { count: "exact", head: true })
      .eq("sekolah_id", id)
      .eq("role", "siswa");

    const { count: kelasCount } = await supabase
      .from("kelas")
      .select("*", { count: "exact", head: true })
      .eq("sekolah_id", id);

    console.log(`
      🗑️ Deleting sekolah: ${existingSekolah.nama_sekolah}
      📊 Related data that will have sekolah_id set to NULL:
         - ${guruCount || 0} guru(s)
         - ${siswaCount || 0} siswa(s)
         - ${kelasCount || 0} kelas(es)
    `);

    // Delete sekolah (database akan otomatis set NULL ke relasi)
    const { data, error } = await supabase
      .from("sekolah")
      .delete()
      .eq("id", id)
      .select();

    if (error) throw error;

    return successResponse(
      res, 
      {
        ...data[0],
        affected: {
          guru: guruCount || 0,
          siswa: siswaCount || 0,
          kelas: kelasCount || 0,
        }
      }, 
      `Sekolah berhasil dihapus. ${guruCount || 0} guru, ${siswaCount || 0} siswa, dan ${kelasCount || 0} kelas telah dilepaskan dari sekolah ini.`
    );
  } catch (error) {
    console.error("❌ deleteSekolah error:", error);
    return errorResponse(res, error.message, 400);
  }
};
