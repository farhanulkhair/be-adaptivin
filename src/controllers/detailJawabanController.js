import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import {
  calculateLevelProgress,
  categorizeSpeed,
  isFastAnswer,
} from "../services/ruleBasedServices.js";

/**
 * Menyimpan jawaban siswa untuk satu soal
 * POST /api/jawaban
 */
export const createJawaban = async (req, res) => {
  try {
    const { hasil_kuis_id, soal_id, jawaban_id, jawaban_siswa, waktu_dijawab } =
      req.body;

    // Validasi input
    if (
      !hasil_kuis_id ||
      !soal_id ||
      !jawaban_siswa ||
      waktu_dijawab === undefined
    ) {
      return errorResponse(
        res,
        "hasil_kuis_id, soal_id, jawaban_siswa, dan waktu_dijawab wajib diisi",
        400
      );
    }

    // Cek apakah hasil kuis exists
    const { data: hasilKuis, error: hasilError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("id, selesai")
      .eq("id", hasil_kuis_id)
      .single();

    if (hasilError || !hasilKuis) {
      return errorResponse(res, "Hasil kuis tidak ditemukan", 404);
    }

    if (hasilKuis.selesai) {
      return errorResponse(
        res,
        "Kuis sudah selesai, tidak bisa menambah jawaban",
        400
      );
    }

    // Ambil data soal
    const { data: soal, error: soalError } = await supabaseAdmin
      .from("bank_soal")
      .select("id, level_soal, tipe_jawaban, durasi_soal")
      .eq("id", soal_id)
      .single();

    if (soalError || !soal) {
      return errorResponse(res, "Soal tidak ditemukan", 404);
    }

    // Tentukan apakah jawaban benar
    let isCorrect = false;

    if (
      soal.tipe_jawaban === "pilihan_ganda" ||
      soal.tipe_jawaban === "pilihan_ganda_kompleks"
    ) {
      // Untuk pilihan ganda, cek dari jawaban_id
      if (!jawaban_id) {
        return errorResponse(
          res,
          "jawaban_id wajib diisi untuk pilihan ganda",
          400
        );
      }

      const { data: jawaban, error: jawabanError } = await supabaseAdmin
        .from("jawaban_soal")
        .select("is_benar")
        .eq("id", jawaban_id)
        .eq("soal_id", soal_id)
        .single();

      if (jawabanError || !jawaban) {
        return errorResponse(res, "Jawaban tidak ditemukan", 404);
      }

      isCorrect = jawaban.is_benar;
    } else if (soal.tipe_jawaban === "isian_singkat") {
      // Untuk isian singkat, cek dari jawaban_soal
      const { data: jawabanBenar, error: jawabanError } = await supabaseAdmin
        .from("jawaban_soal")
        .select("isi_jawaban")
        .eq("soal_id", soal_id)
        .eq("is_benar", true)
        .single();

      if (jawabanError || !jawabanBenar) {
        return errorResponse(res, "Jawaban benar tidak ditemukan", 404);
      }

      // Case-insensitive comparison, trim whitespace
      isCorrect =
        jawaban_siswa.trim().toLowerCase() ===
        jawabanBenar.isi_jawaban.trim().toLowerCase();
    }

    // Simpan detail jawaban
    const { data: detailJawaban, error: insertError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .insert({
        hasil_kuis_id,
        soal_id,
        jawaban_id: jawaban_id || null,
        level_soal: soal.level_soal,
        tipe_jawaban: soal.tipe_jawaban,
        jawaban_siswa,
        benar: isCorrect,
        waktu_dijawab,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating detail jawaban:", insertError);
      return errorResponse(res, "Gagal menyimpan jawaban", 500);
    }

    // ✅ IMPLEMENTASI LOGIKA RULE-BASED BARU dengan Sistem Poin & Stabilizer

    // 1. Ambil semua jawaban sebelumnya untuk sliding window (5 terakhir)
    const { data: previousAnswers, error: historyError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select(
        "benar, waktu_dijawab, level_soal, soal:bank_soal!detail_jawaban_siswa_soal_id_fkey(durasi_soal)"
      )
      .eq("hasil_kuis_id", hasil_kuis_id)
      .order("created_at", { ascending: true });

    if (historyError) {
      console.error("Error fetching answer history:", historyError);
    }

    // 2. Ambil poin akumulatif dari hasil_kuis_siswa (tambahkan kolom 'poin_akumulatif' jika belum ada)
    const { data: hasilKuisData } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("poin_akumulatif")
      .eq("id", hasil_kuis_id)
      .single();

    const currentPoints = hasilKuisData?.poin_akumulatif || 0;

    // 3. Transform data untuk calculateLevelProgress
    const answersForCalculation = (previousAnswers || []).map((item) => ({
      correct: item.benar,
      timeTaken: item.waktu_dijawab,
      medianTime: item.soal?.durasi_soal || 60, // Gunakan durasi_soal sebagai median
      questionLevel: parseInt(item.level_soal.replace("level", "")),
    }));

    // 4. Hitung level berikutnya dengan sistem poin baru
    const currentLevel = parseInt(soal.level_soal.replace("level", ""));
    const ruleBasedResult = calculateLevelProgress({
      currentLevel,
      answers: answersForCalculation,
      currentPoints,
    });

    // 5. Update poin akumulatif di hasil_kuis_siswa
    await supabaseAdmin
      .from("hasil_kuis_siswa")
      .update({ poin_akumulatif: ruleBasedResult.points })
      .eq("id", hasil_kuis_id);

    // 6. Hitung kecepatan untuk feedback
    const isFast = isFastAnswer(waktu_dijawab, soal.durasi_soal);
    const speed = categorizeSpeed(waktu_dijawab, soal.durasi_soal);

    const result = {
      detail_jawaban: detailJawaban,
      feedback: {
        is_correct: isCorrect,
        is_fast: isFast,
        speed: speed, // 'cepat' | 'sedang' | 'lambat'
        next_level: `level${ruleBasedResult.newLevel}`, // Level soal berikutnya
        level_change: ruleBasedResult.levelChange, // 'naik' | 'tetap' | 'turun'
        reasoning: ruleBasedResult.reason, // Penjelasan kenapa naik/turun/tetap
        points: ruleBasedResult.points, // Poin akumulatif setelah jawaban ini
        analysis: ruleBasedResult.analysis, // Detail analisis (consecutive, streaks, dll)
      },
    };

    return successResponse(res, result, "Jawaban berhasil disimpan", 201);
  } catch (error) {
    console.error("Error in createJawaban:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan semua jawaban dalam satu sesi kuis
 * GET /api/jawaban/:hasilKuisId
 */
export const getJawabanByHasilKuis = async (req, res) => {
  try {
    const { hasilKuisId } = req.params;

    const { data: jawaban, error } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select(
        `
        *,
        soal:bank_soal!detail_jawaban_siswa_soal_id_fkey(
          id,
          soal_teks,
          soal_gambar,
          level_soal,
          durasi_soal
        ),
        jawaban:jawaban_soal!detail_jawaban_siswa_jawaban_id_fkey(
          id,
          isi_jawaban
        )
      `
      )
      .eq("hasil_kuis_id", hasilKuisId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching jawaban:", error);
      return errorResponse(res, "Gagal mengambil jawaban", 500);
    }

    return successResponse(res, jawaban, "Data jawaban berhasil diambil");
  } catch (error) {
    console.error("Error in getJawabanByHasilKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Update jawaban (untuk retry)
 * PUT /api/jawaban/:id
 */
export const updateJawaban = async (req, res) => {
  try {
    const { id } = req.params;
    const { jawaban_siswa, waktu_dijawab } = req.body;

    // Cek apakah jawaban exists
    const { data: existingJawaban, error: checkError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select("*")
      .eq("id", id)
      .single();

    if (checkError || !existingJawaban) {
      return errorResponse(res, "Jawaban tidak ditemukan", 404);
    }

    // Cek apakah kuis sudah selesai
    const { data: hasilKuis } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("selesai")
      .eq("id", existingJawaban.hasil_kuis_id)
      .single();

    if (hasilKuis?.selesai) {
      return errorResponse(
        res,
        "Kuis sudah selesai, tidak bisa mengubah jawaban",
        400
      );
    }

    // Prepare update data
    const updateData = {};
    if (jawaban_siswa) updateData.jawaban_siswa = jawaban_siswa;
    if (waktu_dijawab !== undefined) updateData.waktu_dijawab = waktu_dijawab;

    // Update jawaban
    const { data: updatedJawaban, error: updateError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating jawaban:", updateError);
      return errorResponse(res, "Gagal mengupdate jawaban", 500);
    }

    return successResponse(res, updatedJawaban, "Jawaban berhasil diupdate");
  } catch (error) {
    console.error("Error in updateJawaban:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Delete jawaban (biasanya hanya untuk admin)
 * DELETE /api/jawaban/:id
 */
export const deleteJawaban = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah jawaban exists
    const { data: existingJawaban, error: checkError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select("*")
      .eq("id", id)
      .single();

    if (checkError || !existingJawaban) {
      return errorResponse(res, "Jawaban tidak ditemukan", 404);
    }

    // Delete jawaban
    const { error: deleteError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting jawaban:", deleteError);
      return errorResponse(res, "Gagal menghapus jawaban", 500);
    }

    return successResponse(res, null, "Jawaban berhasil dihapus");
  } catch (error) {
    console.error("Error in deleteJawaban:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};
