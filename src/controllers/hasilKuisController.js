import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

/**
 * Controller untuk mengelola hasil kuis siswa
 */

/**
 * Membuat hasil kuis baru (saat siswa mulai kuis)
 * POST /api/hasil-kuis
 */
export const createHasilKuis = async (req, res) => {
  try {
    const { kuis_id } = req.body;
    const siswa_id = req.user.id;

    // Validasi input
    if (!kuis_id) {
      return errorResponse(res, "kuis_id wajib diisi", 400);
    }

    // Cek apakah kuis exists
    const { data: kuis, error: kuisError } = await supabaseAdmin
      .from("kuis")
      .select("id, judul")
      .eq("id", kuis_id)
      .single();

    if (kuisError || !kuis) {
      return errorResponse(res, "Kuis tidak ditemukan", 404);
    }

    // Cek apakah siswa sudah pernah mengerjakan kuis ini
    const { data: existingHasil } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("id, selesai, created_at")
      .eq("kuis_id", kuis_id)
      .eq("siswa_id", siswa_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // PERBAIKAN: Hanya resume jika belum selesai
    // Jika sudah selesai, buat sesi baru (allow retry)
    if (existingHasil && !existingHasil.selesai) {
      console.log("✅ Resuming existing quiz session:", existingHasil.id);
      return successResponse(
        res,
        existingHasil,
        "Melanjutkan kuis yang belum selesai",
        200
      );
    }

    // Buat hasil kuis baru jika belum ada
    console.log(
      "🆕 Creating new quiz session for siswa:",
      siswa_id,
      "kuis:",
      kuis_id
    );
    const { data: hasilKuis, error: hasilError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .insert({
        kuis_id,
        siswa_id,
        total_benar: 0,
        total_salah: 0,
        total_waktu: 0,
        poin_akumulatif: 0,
        selesai: false,
      })
      .select()
      .single();

    if (hasilError) {
      console.error("Error creating hasil kuis:", hasilError);
      return errorResponse(res, "Gagal membuat hasil kuis", 500);
    }

    return successResponse(
      res,
      hasilKuis,
      "Hasil kuis berhasil dibuat. Kuis dimulai!",
      201
    );
  } catch (error) {
    console.error("Error in createHasilKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Menandai kuis selesai dan update total hasil
 * PUT /api/hasil-kuis/:id/selesai
 */
export const finishHasilKuis = async (req, res) => {
  try {
    const { id } = req.params;
    const siswa_id = req.user.id;

    // Cek apakah hasil kuis exists dan milik siswa ini
    const { data: existingHasil, error: checkError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("*")
      .eq("id", id)
      .eq("siswa_id", siswa_id)
      .single();

    if (checkError || !existingHasil) {
      return errorResponse(res, "Hasil kuis tidak ditemukan", 404);
    }

    if (existingHasil.selesai) {
      return errorResponse(res, "Kuis sudah selesai sebelumnya", 400);
    }

    // Hitung total dari detail jawaban
    const { data: detailJawaban, error: detailError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select("benar, waktu_dijawab")
      .eq("hasil_kuis_id", id);

    if (detailError) {
      console.error("Error fetching detail jawaban:", detailError);
      return errorResponse(res, "Gagal menghitung hasil", 500);
    }

    const totalBenar = detailJawaban.filter((j) => j.benar).length;
    const totalSalah = detailJawaban.filter((j) => !j.benar).length;
    const totalWaktu = detailJawaban.reduce(
      (sum, j) => sum + j.waktu_dijawab,
      0
    );

    // Update hasil kuis
    const { data: updatedHasil, error: updateError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .update({
        total_benar: totalBenar,
        total_salah: totalSalah,
        total_waktu: totalWaktu,
        selesai: true,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating hasil kuis:", updateError);
      return errorResponse(res, "Gagal menyelesaikan kuis", 500);
    }

    return successResponse(res, updatedHasil, "Kuis berhasil diselesaikan!");
  } catch (error) {
    console.error("Error in finishHasilKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan detail hasil kuis
 * GET /api/hasil-kuis/:id
 */
export const getHasilKuisById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: hasilKuis, error } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        *,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          id,
          judul,
          jumlah_soal,
          materi:materi!kuis_materi_id_fkey(
            id,
            judul_materi,
            deskripsi
          )
        ),
        siswa:pengguna!hasil_kuis_siswa_siswa_id_fkey(
          id,
          nama_lengkap
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !hasilKuis) {
      return errorResponse(res, "Hasil kuis tidak ditemukan", 404);
    }

    return successResponse(
      res,
      hasilKuis,
      "Detail hasil kuis berhasil diambil"
    );
  } catch (error) {
    console.error("Error in getHasilKuisById:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan semua hasil kuis milik siswa tertentu
 * GET /api/hasil-kuis/siswa/:siswaId
 */
export const getHasilKuisBySiswa = async (req, res) => {
  try {
    const { siswaId } = req.params;

    const { data: hasilKuis, error } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        *,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          id,
          judul,
          jumlah_soal,
          materi:materi!kuis_materi_id_fkey(
            id,
            judul_materi
          )
        )
      `
      )
      .eq("siswa_id", siswaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching hasil kuis:", error);
      return errorResponse(res, "Gagal mengambil hasil kuis", 500);
    }

    return successResponse(res, hasilKuis, "Data hasil kuis berhasil diambil");
  } catch (error) {
    console.error("Error in getHasilKuisBySiswa:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Check apakah siswa sudah pernah mengerjakan kuis ini
 * GET /api/hasil-kuis/check/:kuisId
 */
export const checkKuisStatus = async (req, res) => {
  try {
    const { kuisId } = req.params;
    const siswa_id = req.user.id;

    // Cek apakah siswa sudah pernah mengerjakan kuis ini (selesai)
    const { data: completedKuis } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("id, created_at, total_benar, total_salah, total_waktu")
      .eq("kuis_id", kuisId)
      .eq("siswa_id", siswa_id)
      .eq("selesai", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return successResponse(
      res,
      {
        hasPreviousAttempt: !!completedKuis,
        previousAttempt: completedKuis,
      },
      "Status kuis berhasil diambil"
    );
  } catch (error) {
    console.error("Error in checkKuisStatus:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan semua hasil kuis (untuk guru/admin)
 * GET /api/hasil-kuis
 * Query params: kuis_id, siswa_id
 */
export const getAllHasilKuis = async (req, res) => {
  try {
    const { kuis_id, siswa_id } = req.query;

    let query = supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        *,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          id,
          judul,
          jumlah_soal,
          materi:materi!kuis_materi_id_fkey(
            id,
            judul_materi
          )
        ),
        siswa:pengguna!hasil_kuis_siswa_siswa_id_fkey(
          id,
          nama_lengkap
        )
      `
      )
      .order("created_at", { ascending: false });

    if (kuis_id) {
      query = query.eq("kuis_id", kuis_id);
    }

    if (siswa_id) {
      query = query.eq("siswa_id", siswa_id);
    }

    const { data: hasilKuis, error } = await query;

    if (error) {
      console.error("Error fetching hasil kuis:", error);
      return errorResponse(res, "Gagal mengambil hasil kuis", 500);
    }

    return successResponse(res, hasilKuis, "Data hasil kuis berhasil diambil");
  } catch (error) {
    console.error("Error in getAllHasilKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Get riwayat kuis siswa berdasarkan materi_id
 * GET /api/hasil-kuis/riwayat/materi/:materiId
 */
export const getRiwayatKuisByMateri = async (req, res) => {
  try {
    const { materiId } = req.params;
    const siswa_id = req.user.id;

    // Validasi input
    if (!materiId) {
      return errorResponse(res, "materiId wajib diisi", 400);
    }

    // Ambil riwayat kuis yang sudah selesai untuk materi ini
    const { data: hasilKuis, error } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        id,
        kuis_id,
        siswa_id,
        total_benar,
        total_salah,
        total_waktu,
        selesai,
        poin_akumulatif,
        created_at,
        updated_at,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          materi_id
        )
      `
      )
      .eq("siswa_id", siswa_id)
      .eq("selesai", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching riwayat kuis:", error);
      return errorResponse(res, "Gagal mengambil riwayat kuis", 500);
    }

    // Filter by materi_id (karena kita tidak bisa filter langsung di nested relation)
    const filteredHasil = (hasilKuis || []).filter(
      (hasil) => hasil.kuis?.materi_id === materiId
    );

    // Remove nested kuis object before sending
    const cleanedHasil = filteredHasil.map(({ kuis, ...rest }) => rest);

    return successResponse(res, cleanedHasil, "Riwayat kuis berhasil diambil");
  } catch (error) {
    console.error("Error in getRiwayatKuisByMateri:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};
