import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import {
  prepareDataForAI,
  callAIAPI,
  saveAnalysisResult,
} from "../services/aiService.js";

/**
 * Menganalisis hasil kuis dengan AI dan menyimpannya
 * POST /api/analisis/:hasilKuisId
 */
export const createAnalisis = async (req, res) => {
  try {
    const { hasilKuisId } = req.params;

    // Cek apakah hasil kuis exists dan sudah selesai
    const { data: hasilKuis, error: hasilError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        *,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          materi_id
        )
      `
      )
      .eq("id", hasilKuisId)
      .single();

    if (hasilError || !hasilKuis) {
      return errorResponse(res, "Hasil kuis tidak ditemukan", 404);
    }

    if (!hasilKuis.selesai) {
      return errorResponse(
        res,
        "Kuis belum selesai, tidak bisa dianalisis",
        400
      );
    }

    // Cek apakah sudah ada analisis sebelumnya
    const { data: existingAnalisis } = await supabaseAdmin
      .from("analisis_ai")
      .select("id")
      .eq("hasil_kuis_id", hasilKuisId)
      .maybeSingle();

    if (existingAnalisis) {
      return errorResponse(res, "Hasil kuis ini sudah pernah dianalisis", 400);
    }

    // 1. Siapkan data untuk AI
    const dataForAI = await prepareDataForAI(hasilKuisId);

    // 2. Panggil AI API
    const aiResponse = await callAIAPI(dataForAI);

    // 3. Simpan hasil analisis ke database
    const savedAnalisis = await saveAnalysisResult(
      hasilKuisId,
      hasilKuis.kuis.materi_id,
      aiResponse
    );

    return successResponse(
      res,
      savedAnalisis,
      "Analisis AI berhasil dibuat",
      201
    );
  } catch (error) {
    console.error("Error in createAnalisis:", error);
    return errorResponse(res, error.message || "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan hasil analisis AI untuk satu kuis siswa
 * GET /api/analisis/:hasilKuisId
 */
export const getAnalisisByHasilKuis = async (req, res) => {
  try {
    const { hasilKuisId } = req.params;

    const { data: analisis, error } = await supabaseAdmin
      .from("analisis_ai")
      .select(
        `
        *,
        hasil_kuis:hasil_kuis_siswa!analisis_ai_hasil_kuis_id_fkey(
          id,
          total_benar,
          total_salah,
          total_waktu,
          kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
            id,
            judul
          ),
          siswa:pengguna!hasil_kuis_siswa_siswa_id_fkey(
            id,
            nama_lengkap
          )
        ),
        materi:materi!analisis_ai_materi_id_fkey(
          id,
          judul_materi,
          deskripsi
        )
      `
      )
      .eq("hasil_kuis_id", hasilKuisId)
      .single();

    if (error || !analisis) {
      return errorResponse(res, "Analisis tidak ditemukan", 404);
    }

    // Parse rekomendasi_video jika berupa JSON string
    if (analisis.rekomendasi_video) {
      try {
        analisis.rekomendasi_video = JSON.parse(analisis.rekomendasi_video);
      } catch (e) {
        // Jika bukan JSON, biarkan sebagai string
      }
    }

    return successResponse(res, analisis, "Analisis berhasil diambil");
  } catch (error) {
    console.error("Error in getAnalisisByHasilKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan semua analisis berdasarkan materi (untuk guru)
 * GET /api/analisis/materi/:materiId
 */
export const getAnalisisByMateri = async (req, res) => {
  try {
    const { materiId } = req.params;

    const { data: analisisList, error } = await supabaseAdmin
      .from("analisis_ai")
      .select(
        `
        *,
        hasil_kuis:hasil_kuis_siswa!analisis_ai_hasil_kuis_id_fkey(
          id,
          total_benar,
          total_salah,
          total_waktu,
          kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
            id,
            judul
          ),
          siswa:pengguna!hasil_kuis_siswa_siswa_id_fkey(
            id,
            nama_lengkap,
            email
          )
        ),
        materi:materi!analisis_ai_materi_id_fkey(
          id,
          judul_materi
        )
      `
      )
      .eq("materi_id", materiId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching analisis by materi:", error);
      return errorResponse(res, "Gagal mengambil analisis", 500);
    }

    // Parse rekomendasi_video untuk setiap analisis
    const parsedAnalisis = analisisList.map((analisis) => {
      if (analisis.rekomendasi_video) {
        try {
          analisis.rekomendasi_video = JSON.parse(analisis.rekomendasi_video);
        } catch (e) {
          // Jika bukan JSON, biarkan sebagai string
        }
      }
      return analisis;
    });

    return successResponse(res, parsedAnalisis, "Analisis berhasil diambil");
  } catch (error) {
    console.error("Error in getAnalisisByMateri:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan semua analisis (untuk admin/guru)
 * GET /api/analisis
 * Query params: siswa_id, kuis_id
 */
export const getAllAnalisis = async (req, res) => {
  try {
    const { siswa_id, kuis_id } = req.query;

    let query = supabaseAdmin
      .from("analisis_ai")
      .select(
        `
        *,
        hasil_kuis:hasil_kuis_siswa!analisis_ai_hasil_kuis_id_fkey(
          id,
          total_benar,
          total_salah,
          total_waktu,
          siswa_id,
          kuis_id,
          kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
            id,
            judul
          ),
          siswa:pengguna!hasil_kuis_siswa_siswa_id_fkey(
            id,
            nama_lengkap,
            email
          )
        ),
        materi:materi!analisis_ai_materi_id_fkey(
          id,
          judul_materi
        )
      `
      )
      .order("created_at", { ascending: false });

    const { data: analisisList, error } = await query;

    if (error) {
      console.error("Error fetching all analisis:", error);
      return errorResponse(res, "Gagal mengambil analisis", 500);
    }

    // Filter berdasarkan siswa_id atau kuis_id jika ada
    let filteredAnalisis = analisisList;

    if (siswa_id) {
      filteredAnalisis = filteredAnalisis.filter(
        (a) => a.hasil_kuis?.siswa_id === siswa_id
      );
    }

    if (kuis_id) {
      filteredAnalisis = filteredAnalisis.filter(
        (a) => a.hasil_kuis?.kuis_id === kuis_id
      );
    }

    // Parse rekomendasi_video untuk setiap analisis
    const parsedAnalisis = filteredAnalisis.map((analisis) => {
      if (analisis.rekomendasi_video) {
        try {
          analisis.rekomendasi_video = JSON.parse(analisis.rekomendasi_video);
        } catch (e) {
          // Jika bukan JSON, biarkan sebagai string
        }
      }
      return analisis;
    });

    return successResponse(res, parsedAnalisis, "Analisis berhasil diambil");
  } catch (error) {
    console.error("Error in getAllAnalisis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Delete analisis (untuk admin)
 * DELETE /api/analisis/:id
 */
export const deleteAnalisis = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah analisis exists
    const { data: existingAnalisis, error: checkError } = await supabaseAdmin
      .from("analisis_ai")
      .select("*")
      .eq("id", id)
      .single();

    if (checkError || !existingAnalisis) {
      return errorResponse(res, "Analisis tidak ditemukan", 404);
    }

    // Delete analisis
    const { error: deleteError } = await supabaseAdmin
      .from("analisis_ai")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting analisis:", deleteError);
      return errorResponse(res, "Gagal menghapus analisis", 500);
    }

    return successResponse(res, null, "Analisis berhasil dihapus");
  } catch (error) {
    console.error("Error in deleteAnalisis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};
