import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import {
  calculateLevelProgress,
  categorizeSpeed,
  isFastAnswer,
} from "../services/ruleBasedServices.js";

/**
 * Levenshtein Distance Algorithm
 * Menghitung jumlah karakter yang berbeda antara dua string
 * @param {string} str1 - String pertama
 * @param {string} str2 - String kedua
 * @returns {number} Jarak/distance antara kedua string
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Menyimpan jawaban siswa untuk satu soal
 * POST /api/jawaban
 */
export const createJawaban = async (req, res) => {
  try {
    const { hasil_kuis_id, soal_id, jawaban_id, jawaban_siswa, waktu_dijawab } =
      req.body;

    console.log("📝 Received payload:", {
      hasil_kuis_id,
      soal_id,
      jawaban_id,
      jawaban_siswa,
      waktu_dijawab,
      bodyKeys: Object.keys(req.body),
    });

    // Validasi input
    if (
      !hasil_kuis_id ||
      !soal_id ||
      !jawaban_siswa ||
      waktu_dijawab === undefined
    ) {
      console.log("❌ Validation failed:", {
        hasil_kuis_id: !!hasil_kuis_id,
        soal_id: !!soal_id,
        jawaban_siswa: !!jawaban_siswa,
        waktu_dijawab: waktu_dijawab !== undefined,
      });
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

    if (soal.tipe_jawaban === "pilihan_ganda") {
      // PILIHAN GANDA (single choice): Cek dari jawaban_id
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
    } else if (soal.tipe_jawaban === "pilihan_ganda_kompleks") {
      // PILIHAN GANDA KOMPLEKS (multiple choice): Cek SEMUA jawaban harus benar
      // jawaban_siswa format: "id1,id2,id3" (comma-separated)
      const selectedIds = jawaban_siswa.split(",").map((id) => id.trim());

      if (selectedIds.length === 0) {
        return errorResponse(res, "Minimal satu jawaban harus dipilih", 400);
      }

      // Ambil SEMUA jawaban yang benar untuk soal ini
      const { data: correctAnswers, error: correctError } = await supabaseAdmin
        .from("jawaban_soal")
        .select("id")
        .eq("soal_id", soal_id)
        .eq("is_benar", true);

      if (correctError || !correctAnswers || correctAnswers.length === 0) {
        return errorResponse(res, "Jawaban benar tidak ditemukan", 404);
      }

      const correctIds = correctAnswers.map((a) => a.id);

      // Validasi: Siswa harus pilih SEMUA jawaban yang benar (tidak lebih, tidak kurang)
      const isAllCorrect =
        selectedIds.length === correctIds.length &&
        selectedIds.every((id) => correctIds.includes(id)) &&
        correctIds.every((id) => selectedIds.includes(id));

      isCorrect = isAllCorrect;

      console.log("🔍 Pilihan Ganda Kompleks Validation:", {
        selectedIds,
        correctIds,
        isAllCorrect,
      });
    } else if (soal.tipe_jawaban === "isian_singkat") {
      // ISIAN SINGKAT: Cek dengan similarity checker
      const { data: jawabanBenar, error: jawabanError } = await supabaseAdmin
        .from("jawaban_soal")
        .select("isi_jawaban")
        .eq("soal_id", soal_id)
        .eq("is_benar", true)
        .single();

      if (jawabanError || !jawabanBenar) {
        return errorResponse(res, "Jawaban benar tidak ditemukan", 404);
      }

      // Normalize answers untuk perbandingan
      const normalizedUserAnswer = jawaban_siswa.trim().toLowerCase();
      const normalizedCorrectAnswer = jawabanBenar.isi_jawaban
        .trim()
        .toLowerCase();

      // 1. Exact match (case-insensitive)
      if (normalizedUserAnswer === normalizedCorrectAnswer) {
        isCorrect = true;
      } else {
        // 2. Number conversion: "tiga" vs "3", "sepuluh" vs "10"
        const numberWords = {
          nol: "0",
          kosong: "0",
          satu: "1",
          se: "1",
          dua: "2",
          tiga: "3",
          empat: "4",
          lima: "5",
          enam: "6",
          tujuh: "7",
          delapan: "8",
          sembilan: "9",
          sepuluh: "10",
          sebelas: "11",
          "dua belas": "12",
          duabelas: "12",
          "tiga belas": "13",
          tigabelas: "13",
          "empat belas": "14",
          empatbelas: "14",
          "lima belas": "15",
          limabelas: "15",
          "enam belas": "16",
          enambelas: "16",
          "tujuh belas": "17",
          tujuhbelas: "17",
          "delapan belas": "18",
          delapanbelas: "18",
          "sembilan belas": "19",
          sembilanabelas: "19",
          "dua puluh": "20",
          duapuluh: "20",
        };

        const userAsNumber =
          numberWords[normalizedUserAnswer] || normalizedUserAnswer;
        const correctAsNumber =
          numberWords[normalizedCorrectAnswer] || normalizedCorrectAnswer;

        if (userAsNumber === correctAsNumber) {
          isCorrect = true;
        } else {
          // 3. Levenshtein distance untuk typo tolerance (max 1-2 karakter beda)
          const distance = levenshteinDistance(
            normalizedUserAnswer,
            normalizedCorrectAnswer
          );
          const maxAllowedDistance = Math.max(
            1,
            Math.floor(normalizedCorrectAnswer.length * 0.2)
          ); // 20% toleransi

          if (
            distance <= maxAllowedDistance &&
            normalizedCorrectAnswer.length > 2
          ) {
            isCorrect = true;
            console.log(
              `✅ Accepted with typo tolerance: "${jawaban_siswa}" ≈ "${jawabanBenar.isi_jawaban}" (distance: ${distance})`
            );
          }
        }
      }

      console.log("🔍 Isian Singkat Validation:", {
        userAnswer: jawaban_siswa,
        correctAnswer: jawabanBenar.isi_jawaban,
        isCorrect,
      });
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
    // Tidak pakai join ke bank_soal untuk menghindari ambiguitas created_at
    const { data: previousAnswers, error: historyError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select("id, benar, waktu_dijawab, level_soal, soal_id, created_at")
      .eq("hasil_kuis_id", hasil_kuis_id)
      .order("created_at", { ascending: true });

    if (historyError) {
      console.error("Error fetching answer history:", historyError);
    }

    // 2. Untuk setiap jawaban, ambil durasi_soal dari bank_soal
    const answersWithDuration = await Promise.all(
      (previousAnswers || []).map(async (item) => {
        const { data: soalData } = await supabaseAdmin
          .from("bank_soal")
          .select("durasi_soal")
          .eq("id", item.soal_id)
          .single();

        return {
          ...item,
          durasi_soal: soalData?.durasi_soal || 60,
        };
      })
    );

    // 3. Ambil poin akumulatif dari hasil_kuis_siswa (tambahkan kolom 'poin_akumulatif' jika belum ada)
    const { data: hasilKuisData } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("poin_akumulatif")
      .eq("id", hasil_kuis_id)
      .single();

    const currentPoints = hasilKuisData?.poin_akumulatif || 0;

    // 4. Transform data untuk calculateLevelProgress
    const answersForCalculation = answersWithDuration.map((item) => ({
      correct: item.benar,
      timeTaken: item.waktu_dijawab,
      medianTime: item.durasi_soal,
      questionLevel: parseInt(item.level_soal.replace("level", "")),
    }));

    // 5. Hitung level berikutnya dengan sistem poin baru
    const currentLevel = parseInt(soal.level_soal.replace("level", ""));
    const ruleBasedResult = calculateLevelProgress({
      currentLevel,
      answers: answersForCalculation,
      currentPoints,
    });

    // 6. Update poin akumulatif di hasil_kuis_siswa
    await supabaseAdmin
      .from("hasil_kuis_siswa")
      .update({ poin_akumulatif: ruleBasedResult.points })
      .eq("id", hasil_kuis_id);

    // 7. Hitung kecepatan untuk feedback
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

    // Query tanpa join untuk menghindari ambiguitas created_at
    const { data: jawaban, error } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select("*")
      .eq("hasil_kuis_id", hasilKuisId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching jawaban:", error);
      return errorResponse(res, "Gagal mengambil jawaban", 500);
    }

    // Jika butuh data soal dan jawaban, fetch terpisah
    const jawabanWithDetails = await Promise.all(
      (jawaban || []).map(async (item) => {
        // Fetch soal
        const { data: soal } = await supabaseAdmin
          .from("bank_soal")
          .select(
            "id, soal_teks, soal_gambar, level_soal, durasi_soal, tipe_jawaban"
          )
          .eq("id", item.soal_id)
          .maybeSingle();

        // Fetch SEMUA jawaban untuk soal ini (untuk pilihan ganda)
        const { data: allJawaban } = await supabaseAdmin
          .from("jawaban_soal")
          .select("id, isi_jawaban, is_benar")
          .eq("soal_id", item.soal_id)
          .order("created_at", { ascending: true });

        // Fetch jawaban siswa yang dipilih (jika ada jawaban_id)
        let jawabanSiswa = null;
        if (item.jawaban_id) {
          // Untuk pilihan_ganda_kompleks, jawaban_id berisi comma-separated IDs
          if (soal?.tipe_jawaban === "pilihan_ganda_kompleks") {
            const jawabanIds = item.jawaban_id
              .split(",")
              .map((id) => id.trim());
            const { data } = await supabaseAdmin
              .from("jawaban_soal")
              .select("id, isi_jawaban, is_benar")
              .in("id", jawabanIds);
            jawabanSiswa = data; // Array of selected answers
          } else {
            // Single choice
            const { data } = await supabaseAdmin
              .from("jawaban_soal")
              .select("id, isi_jawaban, is_benar")
              .eq("id", item.jawaban_id)
              .maybeSingle();
            jawabanSiswa = data;
          }
        }

        return {
          ...item,
          soal,
          all_jawaban: allJawaban || [], // Semua opsi jawaban
          jawaban_siswa_object: jawabanSiswa, // Jawaban yang dipilih siswa (renamed to avoid confusion)
        };
      })
    );

    return successResponse(
      res,
      jawabanWithDetails,
      "Data jawaban berhasil diambil"
    );
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
