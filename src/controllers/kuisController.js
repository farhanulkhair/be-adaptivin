import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

/**
 * Membuat kuis baru
 * POST /api/kuis
 */
export const createKuis = async (req, res) => {
  try {
    const { materi_id, judul, jumlah_soal } = req.body;
    const guru_id = req.user.id;

    // Validasi input
    if (!materi_id || !judul || !jumlah_soal) {
      return errorResponse(
        res,
        "materi_id, judul, dan jumlah_soal wajib diisi",
        400
      );
    }

    if (jumlah_soal <= 0) {
      return errorResponse(res, "jumlah_soal harus lebih dari 0", 400);
    }

    // Cek apakah materi exists
    const { data: materi, error: materiError } = await supabaseAdmin
      .from("materi")
      .select("id")
      .eq("id", materi_id)
      .single();

    if (materiError || !materi) {
      return errorResponse(res, "Materi tidak ditemukan", 404);
    }

    // PENTING: Cek apakah materi ini sudah memiliki kuis
    const { data: existingKuis, error: existingError } = await supabaseAdmin
      .from("kuis")
      .select("id, judul")
      .eq("materi_id", materi_id)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing kuis:", existingError);
      return errorResponse(res, "Gagal mengecek kuis yang ada", 500);
    }

    if (existingKuis) {
      return errorResponse(
        res,
        `Materi ini sudah memiliki kuis "${existingKuis.judul}". Silakan edit kuis yang sudah ada.`,
        400
      );
    }

    // Cek apakah ada cukup soal di bank_soal untuk materi ini
    const { count: totalSoal, error: countError } = await supabaseAdmin
      .from("bank_soal")
      .select("*", { count: "exact", head: true })
      .eq("materi_id", materi_id);

    if (countError) {
      return errorResponse(res, "Gagal mengecek jumlah soal", 500);
    }

    if (totalSoal < jumlah_soal) {
      return errorResponse(
        res,
        `Jumlah soal tidak mencukupi. Tersedia: ${totalSoal}, Diminta: ${jumlah_soal}`,
        400
      );
    }

    // Buat kuis baru
    const { data: kuis, error: kuisError } = await supabaseAdmin
      .from("kuis")
      .insert({
        materi_id,
        guru_id,
        judul,
        jumlah_soal,
      })
      .select()
      .single();

    if (kuisError) {
      console.error("Error creating kuis:", kuisError);
      return errorResponse(res, "Gagal membuat kuis", 500);
    }

    return successResponse(res, kuis, "Kuis berhasil dibuat", 201);
  } catch (error) {
    console.error("Error in createKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan semua kuis
 * GET /api/kuis
 * Query params: guru_id, materi_id
 */
export const getAllKuis = async (req, res) => {
  try {
    const { guru_id, materi_id } = req.query;

    let query = supabaseAdmin
      .from("kuis")
      .select(
        `
        *,
        materi:materi!kuis_materi_id_fkey(
          id,
          judul_materi,
          deskripsi
        ),
        guru:pengguna!kuis_guru_id_fkey(
          id,
          nama_lengkap
        )
      `
      )
      .order("created_at", { ascending: false });

    // Filter by guru_id
    if (guru_id) {
      query = query.eq("guru_id", guru_id);
    }

    // Filter by materi_id
    if (materi_id) {
      query = query.eq("materi_id", materi_id);
    }

    const { data: kuis, error } = await query;

    if (error) {
      console.error("Error fetching kuis:", error);
      return errorResponse(res, "Gagal mengambil data kuis", 500);
    }

    return successResponse(res, kuis, "Data kuis berhasil diambil");
  } catch (error) {
    console.error("Error in getAllKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan detail satu kuis
 * GET /api/kuis/:id
 */
export const getKuisById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: kuis, error } = await supabaseAdmin
      .from("kuis")
      .select(
        `
        *,
        materi:materi!kuis_materi_id_fkey(
          id,
          judul_materi,
          deskripsi
        ),
        guru:pengguna!kuis_guru_id_fkey(
          id,
          nama_lengkap
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !kuis) {
      return errorResponse(res, "Kuis tidak ditemukan", 404);
    }

    return successResponse(res, kuis, "Detail kuis berhasil diambil");
  } catch (error) {
    console.error("Error in getKuisById:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Update kuis
 * PUT /api/kuis/:id
 */
export const updateKuis = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, jumlah_soal } = req.body;
    const guru_id = req.user.id;

    // Cek apakah kuis exists dan milik guru ini
    const { data: existingKuis, error: checkError } = await supabaseAdmin
      .from("kuis")
      .select("*")
      .eq("id", id)
      .eq("guru_id", guru_id)
      .single();

    if (checkError || !existingKuis) {
      return errorResponse(
        res,
        "Kuis tidak ditemukan atau Anda tidak memiliki akses",
        404
      );
    }

    // Prepare update data
    const updateData = {};
    if (judul) updateData.judul = judul;
    if (jumlah_soal) {
      if (jumlah_soal <= 0) {
        return errorResponse(res, "jumlah_soal harus lebih dari 0", 400);
      }

      // Cek ketersediaan soal
      const { count: totalSoal } = await supabaseAdmin
        .from("bank_soal")
        .select("*", { count: "exact", head: true })
        .eq("materi_id", existingKuis.materi_id);

      if (totalSoal < jumlah_soal) {
        return errorResponse(
          res,
          `Jumlah soal tidak mencukupi. Tersedia: ${totalSoal}, Diminta: ${jumlah_soal}`,
          400
        );
      }

      updateData.jumlah_soal = jumlah_soal;
    }

    updateData.updated_at = new Date().toISOString();

    // Update kuis
    const { data: updatedKuis, error: updateError } = await supabaseAdmin
      .from("kuis")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating kuis:", updateError);
      return errorResponse(res, "Gagal mengupdate kuis", 500);
    }

    return successResponse(res, updatedKuis, "Kuis berhasil diupdate");
  } catch (error) {
    console.error("Error in updateKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Delete kuis
 * DELETE /api/kuis/:id
 */
export const deleteKuis = async (req, res) => {
  try {
    const { id } = req.params;
    const guru_id = req.user.id;

    // Cek apakah kuis exists dan milik guru ini
    const { data: existingKuis, error: checkError } = await supabaseAdmin
      .from("kuis")
      .select("*")
      .eq("id", id)
      .eq("guru_id", guru_id)
      .single();

    if (checkError || !existingKuis) {
      return errorResponse(
        res,
        "Kuis tidak ditemukan atau Anda tidak memiliki akses",
        404
      );
    }

    // Delete kuis (CASCADE akan menghapus hasil_kuis_siswa dan detail_jawaban_siswa)
    const { error: deleteError } = await supabaseAdmin
      .from("kuis")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting kuis:", deleteError);
      return errorResponse(res, "Gagal menghapus kuis", 500);
    }

    return successResponse(res, null, "Kuis berhasil dihapus");
  } catch (error) {
    console.error("Error in deleteKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Mendapatkan soal untuk kuis (adaptif)
 * GET /api/kuis/:id/soal
 * Query params: current_level (optional, default: level3)
 */
export const getSoalForKuis = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_level, hasil_kuis_id } = req.query;

    console.log("📖 getSoalForKuis called:", {
      kuis_id: id,
      current_level,
      hasil_kuis_id,
    });

    // Ambil info kuis
    const { data: kuis, error: kuisError } = await supabaseAdmin
      .from("kuis")
      .select("materi_id, jumlah_soal")
      .eq("id", id)
      .single();

    if (kuisError || !kuis) {
      return errorResponse(res, "Kuis tidak ditemukan", 404);
    }

    // Tentukan level soal yang akan diambil
    const levelSoal = current_level || "level3"; // Default level 3 untuk soal pertama

    // Ambil list soal_id yang sudah pernah ditampilkan (sudah dijawab)
    let excludedSoalIds = [];
    if (hasil_kuis_id) {
      const { data: answeredSoals } = await supabaseAdmin
        .from("detail_jawaban_siswa")
        .select("soal_id")
        .eq("hasil_kuis_id", hasil_kuis_id);

      if (answeredSoals && answeredSoals.length > 0) {
        excludedSoalIds = answeredSoals.map((a) => a.soal_id);
        console.log(
          "🚫 Excluding already answered soals:",
          excludedSoalIds.length
        );
      }
    }

    // Build query untuk ambil soal
    let query = supabaseAdmin
      .from("bank_soal")
      .select(
        `
        id,
        soal_teks,
        soal_gambar,
        level_soal,
        tipe_jawaban,
        durasi_soal,
        penjelasan,
        gambar_pendukung_jawaban
      `
      )
      .eq("materi_id", kuis.materi_id)
      .eq("level_soal", levelSoal);

    // Exclude soal yang sudah pernah muncul
    if (excludedSoalIds.length > 0) {
      query = query.not("id", "in", `(${excludedSoalIds.join(",")})`);
    }

    // Fetch all available soals
    const { data: availableSoals, error: soalError } = await query;

    if (soalError) {
      console.error("❌ Error fetching soal:", soalError);
      return errorResponse(res, "Gagal mengambil soal", 500);
    }

    if (!availableSoals || availableSoals.length === 0) {
      console.log("⚠️ No soal available for level:", levelSoal);
      return errorResponse(
        res,
        `Tidak ada soal dengan level ${levelSoal} untuk materi ini`,
        404
      );
    }

    console.log(
      `✅ Found ${availableSoals.length} available soals (level: ${levelSoal})`
    );

    // RANDOM selection untuk prevent pola yang sama
    const randomIndex = Math.floor(Math.random() * availableSoals.length);
    const selectedSoal = availableSoals[randomIndex];

    console.log("🎲 Randomly selected soal:", {
      id: selectedSoal.id,
      tipe: selectedSoal.tipe_jawaban,
      level: selectedSoal.level_soal,
    });

    // Ambil jawaban untuk soal ini (jika pilihan ganda)
    let jawaban = [];
    if (
      selectedSoal.tipe_jawaban === "pilihan_ganda" ||
      selectedSoal.tipe_jawaban === "pilihan_ganda_kompleks"
    ) {
      const { data: jawabanData, error: jawabanError } = await supabaseAdmin
        .from("jawaban_soal")
        .select("*")
        .eq("soal_id", selectedSoal.id)
        .order("created_at", { ascending: true });

      if (jawabanError) {
        console.error("❌ Error fetching jawaban:", jawabanError);
      } else {
        jawaban = jawabanData || [];
        console.log(`📝 Loaded ${jawaban.length} jawaban options`);
      }
    }

    const result = {
      ...selectedSoal,
      jawaban,
    };

    return successResponse(res, result, "Soal berhasil diambil");
  } catch (error) {
    console.error("❌ Error in getSoalForKuis:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};
