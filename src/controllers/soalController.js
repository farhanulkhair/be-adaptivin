import { supabaseAdmin } from "../config/supabaseAdmin.js";
import multer from "multer";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

// ==================== STORAGE HELPERS ====================

/**
 * Upload gambar soal ke Supabase Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} folder - Folder in bucket ('soal' atau 'jawaban')
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} - Public URL of uploaded file
 */
const uploadGambarSoal = async (
  fileBuffer,
  fileName,
  folder = "soal",
  mimeType = "image/jpeg"
) => {
  try {
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;
    const filePath = `${folder}/${uniqueFileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from("soal")
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("[UPLOAD ERROR]", error);
      if (error.statusCode === "403" || error.status === 403) {
        throw new Error(
          "Storage upload forbidden. Please check RLS policies in Supabase."
        );
      }
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("soal").getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Error uploading gambar soal:", error);
    throw error;
  }
};

/**
 * Delete gambar from Supabase Storage
 * @param {string} url - Public URL of the file
 */
const deleteGambarSoal = async (url) => {
  try {
    if (!url) return;

    const urlParts = url.split("/storage/v1/object/public/soal/");
    if (urlParts.length < 2) return;

    const filePath = urlParts[1];
    await supabaseAdmin.storage.from("soal").remove([filePath]);
  } catch (error) {
    console.error("Error deleting gambar soal:", error);
  }
};

// ==================== MULTER CONFIG ====================

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, JPG, and PNG images are allowed"));
    }
  },
});

// ==================== SOAL COLUMNS ====================

const soalColumns = `
  id,
  materi_id,
  level_soal,
  tipe_jawaban,
  soal_teks,
  soal_gambar,
  penjelasan,
  gambar_pendukung_jawaban,
  durasi_soal,
  created_at,
  updated_at
`;

const jawabanColumns = `
  id,
  soal_id,
  isi_jawaban,
  is_benar
`;

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * GET /api/soal
 * Get all soal (grouped by materi)
 * Query params: materi_id, level_soal, tipe_jawaban
 */
export const getAllSoal = async (req, res) => {
  try {
    const { materi_id, level_soal, tipe_jawaban } = req.query;

    let query = supabaseAdmin
      .from("bank_soal")
      .select(
        `
        ${soalColumns},
        materi:materi_id (
          id,
          judul_materi,
          kelas_id
        ),
        jawaban:jawaban_soal (
          ${jawabanColumns}
        )
      `
      )
      .order("created_at", { ascending: false });

    // Filter by materi_id
    if (materi_id) {
      query = query.eq("materi_id", materi_id);
    }

    // Filter by level_soal
    if (level_soal) {
      query = query.eq("level_soal", level_soal);
    }

    // Filter by tipe_jawaban
    if (tipe_jawaban) {
      query = query.eq("tipe_jawaban", tipe_jawaban);
    }

    const { data, error } = await query;

    if (error) throw error;

    return successResponse(
      res,
      { data: data || [] },
      "Berhasil mengambil data soal"
    );
  } catch (error) {
    console.error("Error getting all soal:", error);
    return errorResponse(
      res,
      `Gagal mengambil data soal: ${error.message}`,
      500
    );
  }
};

/**
 * GET /api/soal/:id
 * Get soal by ID with jawaban
 */
export const getSoalById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("bank_soal")
      .select(
        `
        ${soalColumns},
        materi:materi_id (
          id,
          judul_materi,
          kelas_id
        ),
        jawaban:jawaban_soal (
          ${jawabanColumns}
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse(res, "Soal tidak ditemukan", 404);
      }
      throw error;
    }

    return successResponse(
      res,
      { data },
      "Berhasil mengambil data soal"
    );
  } catch (error) {
    console.error("Error getting soal by ID:", error);
    return errorResponse(
      res,
      `Gagal mengambil data soal: ${error.message}`,
      500
    );
  }
};

/**
 * GET /api/soal/materi/:materi_id/count
 * Get count soal per level by materi_id
 */
export const getSoalCountByMateri = async (req, res) => {
  try {
    const { materi_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("bank_soal")
      .select("level_soal")
      .eq("materi_id", materi_id);

    if (error) throw error;

    // Count per level
    const counts = {
      c1: 0,
      c2: 0,
      c3: 0,
      c4: 0,
      c5: 0,
      c6: 0,
      total: data?.length || 0,
    };

    data?.forEach((soal) => {
      if (counts.hasOwnProperty(soal.level_soal)) {
        counts[soal.level_soal]++;
      }
    });

    return successResponse(
      res,
      { data: counts },
      "Berhasil menghitung soal"
    );
  } catch (error) {
    console.error("Error counting soal:", error);
    return errorResponse(
      res,
      `Gagal menghitung soal: ${error.message}`,
      500
    );
  }
};

/**
 * POST /api/soal
 * Create new soal with jawaban
 * Supports image upload for soal_gambar and gambar_pendukung_jawaban
 */
export const createSoal = async (req, res) => {
  try {
    const {
      materi_id,
      level_soal,
      tipe_jawaban,
      soal_teks,
      penjelasan,
      durasi_soal,
    } = req.body;

    // Parse jawaban from JSON string (sent via FormData)
    let jawaban;
    try {
      jawaban = req.body.jawaban ? JSON.parse(req.body.jawaban) : null;
    } catch (parseError) {
      return errorResponse(
        res,
        "Format jawaban tidak valid. Harus berupa JSON array.",
        400
      );
    }

    // Validasi required fields
    if (
      !materi_id ||
      !level_soal ||
      !tipe_jawaban ||
      !soal_teks ||
      !durasi_soal
    ) {
      return errorResponse(
        res,
        "Field wajib: materi_id, level_soal, tipe_jawaban, soal_teks, durasi_soal",
        400
      );
    }

    // Validasi level_soal
    const validLevels = [
      "level1",
      "level2",
      "level3",
      "level4",
      "level5",
      "level6",
    ];
    if (!validLevels.includes(level_soal)) {
      return errorResponse(
        res,
        "level_soal harus salah satu dari: level1, level2, level3, level4, level5, level6",
        400
      );
    }

    // Validasi tipe_jawaban
    const validTypes = [
      "pilihan_ganda",
      "pilihan_ganda_kompleks",
      "isian_singkat",
    ];
    if (!validTypes.includes(tipe_jawaban)) {
      return errorResponse(
        res,
        "tipe_jawaban harus salah satu dari: pilihan_ganda, pilihan_ganda_kompleks, isian_singkat",
        400
      );
    }

    // Validasi jawaban array
    if (!jawaban || !Array.isArray(jawaban) || jawaban.length === 0) {
      return errorResponse(
        res,
        "jawaban harus berupa array dan tidak boleh kosong",
        400
      );
    }

    // Validasi harus ada minimal 1 jawaban benar
    const jawabanBenar = jawaban.filter((j) => j.is_benar === true);
    if (jawabanBenar.length < 1) {
      return errorResponse(
        res,
        "Harus ada minimal 1 jawaban yang benar (is_benar: true)",
        400
      );
    }

    // Validasi berdasarkan tipe jawaban
    if (tipe_jawaban === "pilihan_ganda") {
      // Untuk pilihan ganda, harus ada tepat 1 jawaban yang benar
      if (jawabanBenar.length !== 1) {
        return errorResponse(
          res,
          "Untuk pilihan ganda, harus ada tepat 1 jawaban yang benar",
          400
        );
      }
    } else if (tipe_jawaban === "pilihan_ganda_kompleks") {
      // Untuk pilihan ganda kompleks, minimal 1 jawaban benar (bisa lebih dari 1)
      if (jawabanBenar.length < 1) {
        return errorResponse(
          res,
          "Untuk pilihan ganda kompleks, harus ada minimal 1 jawaban yang benar",
          400
        );
      }
    } else if (tipe_jawaban === "isian_singkat") {
      // Untuk isian singkat, hanya 1 jawaban yang benar
      if (jawabanBenar.length !== 1) {
        return errorResponse(
          res,
          "Untuk isian singkat, harus ada tepat 1 jawaban yang benar",
          400
        );
      }
    }

    // Upload images if provided
    let soal_gambar_url = null;
    let gambar_pendukung_url = null;

    if (req.files?.soal_gambar?.[0]) {
      soal_gambar_url = await uploadGambarSoal(
        req.files.soal_gambar[0].buffer,
        req.files.soal_gambar[0].originalname,
        "soal",
        req.files.soal_gambar[0].mimetype
      );
    }

    if (req.files?.gambar_pendukung_jawaban?.[0]) {
      gambar_pendukung_url = await uploadGambarSoal(
        req.files.gambar_pendukung_jawaban[0].buffer,
        req.files.gambar_pendukung_jawaban[0].originalname,
        "jawaban",
        req.files.gambar_pendukung_jawaban[0].mimetype
      );
    }

    // Convert durasi dari menit ke detik
    const durasiDetik = parseInt(durasi_soal) * 60;

    // Insert soal
    const { data: soalData, error: soalError } = await supabaseAdmin
      .from("bank_soal")
      .insert({
        materi_id,
        level_soal,
        tipe_jawaban,
        soal_teks,
        soal_gambar: soal_gambar_url,
        penjelasan: penjelasan || null,
        gambar_pendukung_jawaban: gambar_pendukung_url,
        durasi_soal: durasiDetik,
      })
      .select(soalColumns)
      .single();

    if (soalError) throw soalError;

    // Insert jawaban
    const jawabanToInsert = jawaban.map((j) => ({
      soal_id: soalData.id,
      isi_jawaban: j.isi_jawaban,
      is_benar: j.is_benar || false,
    }));

    const { data: jawabanData, error: jawabanError } = await supabaseAdmin
      .from("jawaban_soal")
      .insert(jawabanToInsert)
      .select(jawabanColumns);

    if (jawabanError) {
      // Rollback: delete soal if jawaban failed
      await supabaseAdmin.from("bank_soal").delete().eq("id", soalData.id);
      if (soal_gambar_url) await deleteGambarSoal(soal_gambar_url);
      if (gambar_pendukung_url) await deleteGambarSoal(gambar_pendukung_url);
      throw jawabanError;
    }

    return successResponse(
      res,
      {
        data: {
          ...soalData,
          jawaban: jawabanData,
        },
      },
      "Berhasil membuat soal",
      201
    );
  } catch (error) {
    console.error("Error creating soal:", error);
    return errorResponse(
      res,
      `Gagal membuat soal: ${error.message}`,
      500
    );
  }
};

/**
 * PUT /api/soal/:id
 * Update soal and jawaban
 */
export const updateSoal = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      materi_id,
      level_soal,
      tipe_jawaban,
      soal_teks,
      penjelasan,
      durasi_soal,
      hapus_soal_gambar, // "true" untuk hapus gambar soal
      hapus_gambar_pendukung, // "true" untuk hapus gambar pendukung
    } = req.body;

    // Parse jawaban from JSON string (sent via FormData)
    let jawaban;
    if (req.body.jawaban) {
      try {
        jawaban = JSON.parse(req.body.jawaban);
      } catch (parseError) {
        return errorResponse(
          res,
          "Format jawaban tidak valid. Harus berupa JSON array.",
          400
        );
      }
    }

    // Check if soal exists
    const { data: existingSoal, error: checkError } = await supabaseAdmin
      .from("bank_soal")
      .select(soalColumns)
      .eq("id", id)
      .single();

    if (checkError || !existingSoal) {
      return errorResponse(res, "Soal tidak ditemukan", 404);
    }

    // Prepare update object
    const updateData = {};

    if (materi_id) updateData.materi_id = materi_id;
    if (level_soal) {
      const validLevels = [
        "level1",
        "level2",
        "level3",
        "level4",
        "level5",
        "level6",
      ];
      if (!validLevels.includes(level_soal)) {
        return errorResponse(res, "level_soal tidak valid", 400);
      }
      updateData.level_soal = level_soal;
    }
    if (tipe_jawaban) {
      const validTypes = [
        "pilihan_ganda",
        "pilihan_ganda_kompleks",
        "isian_singkat",
      ];
      if (!validTypes.includes(tipe_jawaban)) {
        return errorResponse(res, "tipe_jawaban tidak valid", 400);
      }
      updateData.tipe_jawaban = tipe_jawaban;
    }
    if (soal_teks) updateData.soal_teks = soal_teks;
    if (penjelasan !== undefined) updateData.penjelasan = penjelasan;
    if (durasi_soal) updateData.durasi_soal = parseInt(durasi_soal) * 60;

    // Handle image updates
    if (req.files?.soal_gambar?.[0]) {
      // Delete old image if exists
      if (existingSoal.soal_gambar) {
        await deleteGambarSoal(existingSoal.soal_gambar);
      }
      // Upload new image
      updateData.soal_gambar = await uploadGambarSoal(
        req.files.soal_gambar[0].buffer,
        req.files.soal_gambar[0].originalname,
        "soal",
        req.files.soal_gambar[0].mimetype
      );
    } else if (hapus_soal_gambar === "true") {
      if (existingSoal.soal_gambar) {
        await deleteGambarSoal(existingSoal.soal_gambar);
      }
      updateData.soal_gambar = null;
    }

    if (req.files?.gambar_pendukung_jawaban?.[0]) {
      if (existingSoal.gambar_pendukung_jawaban) {
        await deleteGambarSoal(existingSoal.gambar_pendukung_jawaban);
      }
      updateData.gambar_pendukung_jawaban = await uploadGambarSoal(
        req.files.gambar_pendukung_jawaban[0].buffer,
        req.files.gambar_pendukung_jawaban[0].originalname,
        "jawaban",
        req.files.gambar_pendukung_jawaban[0].mimetype
      );
    } else if (hapus_gambar_pendukung === "true") {
      if (existingSoal.gambar_pendukung_jawaban) {
        await deleteGambarSoal(existingSoal.gambar_pendukung_jawaban);
      }
      updateData.gambar_pendukung_jawaban = null;
    }

    updateData.updated_at = new Date().toISOString();

    // Update soal
    const { data: soalData, error: soalError } = await supabaseAdmin
      .from("bank_soal")
      .update(updateData)
      .eq("id", id)
      .select(soalColumns)
      .single();

    if (soalError) throw soalError;

    // Update jawaban if provided
    let jawabanData = null;
    if (jawaban && Array.isArray(jawaban)) {
      // Validasi harus ada minimal 1 jawaban benar
      const jawabanBenar = jawaban.filter((j) => j.is_benar === true);
      if (jawabanBenar.length < 1) {
        return errorResponse(
          res,
          "Harus ada minimal 1 jawaban yang benar",
          400
        );
      }

      // Validasi berdasarkan tipe jawaban
      const currentTipeJawaban =
        updateData.tipe_jawaban || existingSoal.tipe_jawaban;

      if (currentTipeJawaban === "pilihan_ganda") {
        // Untuk pilihan ganda, harus ada tepat 1 jawaban yang benar
        if (jawabanBenar.length !== 1) {
          return errorResponse(
            res,
            "Untuk pilihan ganda, harus ada tepat 1 jawaban yang benar",
            400
          );
        }
      } else if (currentTipeJawaban === "pilihan_ganda_kompleks") {
        // Untuk pilihan ganda kompleks, minimal 1 jawaban benar (bisa lebih dari 1)
        if (jawabanBenar.length < 1) {
          return errorResponse(
            res,
            "Untuk pilihan ganda kompleks, harus ada minimal 1 jawaban yang benar",
            400
          );
        }
      } else if (currentTipeJawaban === "isian_singkat") {
        // Untuk isian singkat, hanya 1 jawaban yang benar
        if (jawabanBenar.length !== 1) {
          return errorResponse(
            res,
            "Untuk isian singkat, harus ada tepat 1 jawaban yang benar",
            400
          );
        }
      }

      // Delete old jawaban
      await supabaseAdmin.from("jawaban_soal").delete().eq("soal_id", id);

      // Insert new jawaban
      const jawabanToInsert = jawaban.map((j) => ({
        soal_id: id,
        isi_jawaban: j.isi_jawaban,
        is_benar: j.is_benar || false,
      }));

      const { data: newJawaban, error: jawabanError } = await supabaseAdmin
        .from("jawaban_soal")
        .insert(jawabanToInsert)
        .select(jawabanColumns);

      if (jawabanError) throw jawabanError;
      jawabanData = newJawaban;
    }

    return successResponse(
      res,
      {
        data: {
          ...soalData,
          jawaban: jawabanData,
        },
      },
      "Berhasil update soal"
    );
  } catch (error) {
    console.error("Error updating soal:", error);
    return errorResponse(
      res,
      `Gagal update soal: ${error.message}`,
      500
    );
  }
};

/**
 * DELETE /api/soal/:id
 * Delete soal (cascade delete jawaban)
 */
export const deleteSoal = async (req, res) => {
  try {
    const { id } = req.params;

    // Get soal data first to delete images
    const { data: soalData, error: getError } = await supabaseAdmin
      .from("bank_soal")
      .select(soalColumns)
      .eq("id", id)
      .single();

    if (getError || !soalData) {
      return errorResponse(res, "Soal tidak ditemukan", 404);
    }

    // Delete images from storage
    if (soalData.soal_gambar) {
      await deleteGambarSoal(soalData.soal_gambar);
    }
    if (soalData.gambar_pendukung_jawaban) {
      await deleteGambarSoal(soalData.gambar_pendukung_jawaban);
    }

    // Delete soal (cascade will delete jawaban)
    const { error: deleteError } = await supabaseAdmin
      .from("bank_soal")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return successResponse(res, null, "Berhasil menghapus soal");
  } catch (error) {
    console.error("Error deleting soal:", error);
    return errorResponse(
      res,
      `Gagal menghapus soal: ${error.message}`,
      500
    );
  }
};

/**
 * GET /api/soal/materi-dropdown
 * Get list materi for dropdown
 */
export const getMateriDropdown = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("materi")
      .select(
        `
        id,
        judul_materi,
        kelas_id,
        kelas:kelas_id (
          id,
          nama_kelas,
          tingkat_kelas
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format untuk dropdown
    const formatted = data?.map((m) => ({
      value: m.id,
      label: `${m.judul_materi} - ${m.kelas?.nama_kelas || ""}`,
      materi_id: m.id,
      judul_materi: m.judul_materi,
      kelas: m.kelas,
    }));

    return successResponse(
      res,
      { data: formatted || [] },
      "Berhasil mengambil data materi"
    );
  } catch (error) {
    console.error("Error getting materi dropdown:", error);
    return errorResponse(
      res,
      `Gagal mengambil data materi: ${error.message}`,
      500
    );
  }
};

// Export multer upload
export { upload };
