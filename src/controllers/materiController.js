import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

// ==================== STORAGE HELPERS ====================

/**
 * Upload file to Supabase Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} folder - Folder in bucket (e.g., 'pdf', 'video', 'gambar')
 * @param {string} tipeMedia - Type of media ('pdf', 'video', 'gambar')
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export const uploadToStorage = async (
  fileBuffer,
  fileName,
  folder,
  tipeMedia
) => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;
    const filePath = `${folder}/${uniqueFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from("materi")
      .upload(filePath, fileBuffer, {
        contentType: getContentType(tipeMedia, fileName),
        upsert: false,
      });

    if (error) {
      // Better error handling for RLS policy errors
      if (error.statusCode === "403" || error.status === 403) {
        console.error(
          "❌ RLS Policy Error - Run SQL policies in Supabase Dashboard!"
        );
        console.error("📖 See STORAGE-FIX-README.md for instructions");
        throw new Error(
          "Storage upload forbidden. Please check RLS policies in Supabase."
        );
      }
      throw error;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("materi").getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Error uploading to storage:", error);
    throw error;
  }
};

/**
 * Delete file from Supabase Storage
 * @param {string} url - Public URL of the file
 */
export const deleteFromStorage = async (url) => {
  try {
    // Extract file path from URL
    // URL format: https://<project>.supabase.co/storage/v1/object/public/materi/<path>
    const urlParts = url.split("/storage/v1/object/public/materi/");
    if (urlParts.length < 2) {
      console.warn("Invalid storage URL format:", url);
      return;
    }

    const filePath = urlParts[1];

    // Delete from storage
    const { error } = await supabaseAdmin.storage
      .from("materi")
      .remove([filePath]);

    if (error) {
      console.error("Error deleting from storage:", error);
    }
  } catch (error) {
    console.error("Error in deleteFromStorage:", error);
  }
};

/**
 * Get content type based on media type and file name
 */
export const getContentType = (tipeMedia, fileName) => {
  const extension = fileName.split(".").pop().toLowerCase();

  if (tipeMedia === "pdf") {
    return "application/pdf";
  } else if (tipeMedia === "video") {
    const videoTypes = {
      mp4: "video/mp4",
      webm: "video/webm",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
    };
    return videoTypes[extension] || "video/mp4";
  } else if (tipeMedia === "gambar") {
    const imageTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    return imageTypes[extension] || "image/jpeg";
  }

  return "application/octet-stream";
};

/**
 * Validate file type matches tipe_media
 */
export const validateFileType = (fileName, tipeMedia) => {
  const extension = fileName.split(".").pop().toLowerCase();

  const validExtensions = {
    pdf: ["pdf"],
    video: ["mp4", "webm", "avi", "mov", "mkv"],
    gambar: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
  };

  const allowedExtensions = validExtensions[tipeMedia] || [];
  return allowedExtensions.includes(extension);
};

// ==================== MATERI (Parent) ====================

/**
 * Get all materi by kelas_id
 * Guru can only see materi from classes they teach
 */
export const getMateriByKelas = async (req, res) => {
  try {
    const { kelasId } = req.params;
    const { role, id: userId } = req.user;

    // Verify access to kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", kelasId)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses ke kelas ini",
          403
        );
      }
    }

    // Get all materi for this kelas with sub_materi count
    const { data, error } = await supabaseAdmin
      .from("materi")
      .select(
        `
        id,
        kelas_id,
        judul_materi,
        deskripsi,
        created_at,
        updated_at,
        sub_materi (count)
      `
      )
      .eq("kelas_id", kelasId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Transform data to include sub_materi count
    const materiWithCount = (data || []).map((m) => ({
      id: m.id,
      kelas_id: m.kelas_id,
      judul_materi: m.judul_materi,
      deskripsi: m.deskripsi,
      jumlah_sub_materi: m.sub_materi?.[0]?.count || 0,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));

    return successResponse(
      res,
      materiWithCount,
      "Materi retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get single materi by ID with all sub_materi
 */
export const getMateriById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Get materi with sub_materi
    const { data: materi, error } = await supabaseAdmin
      .from("materi")
      .select(
        `
        id,
        kelas_id,
        judul_materi,
        deskripsi,
        created_at,
        updated_at,
        sub_materi (
          id,
          judul_sub_materi,
          isi_materi,
          urutan,
          created_at,
          updated_at,
          sub_materi_media (
            id,
            tipe_media,
            url,
            created_at
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!materi) {
      return errorResponse(res, "Materi tidak ditemukan", 404);
    }

    // Verify access if guru
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses ke materi ini",
          403
        );
      }
    }

    // Sort sub_materi by urutan
    if (materi.sub_materi) {
      materi.sub_materi.sort((a, b) => a.urutan - b.urutan);
    }

    return successResponse(res, { materi }, "Materi retrieved successfully");
  } catch (error) {
    console.error("Error fetching materi by ID:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Create new materi for a kelas
 */
export const createMateri = async (req, res) => {
  try {
    const { kelas_id, judul_materi, deskripsi } = req.body;
    const { role, id: userId } = req.user;

    // Validation
    if (!kelas_id || !judul_materi) {
      return errorResponse(res, "kelas_id dan judul_materi wajib diisi", 400);
    }

    // Verify kelas exists
    const { data: kelas, error: kelasError } = await supabaseAdmin
      .from("kelas")
      .select("id")
      .eq("id", kelas_id)
      .single();

    if (kelasError || !kelas) {
      return errorResponse(res, "Kelas tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(res, "Anda tidak mengajar di kelas ini", 403);
      }
    }

    // Create materi
    const { data: materi, error: insertError } = await supabaseAdmin
      .from("materi")
      .insert([
        {
          kelas_id,
          judul_materi,
          deskripsi: deskripsi || null,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return successResponse(res, { materi }, "Materi created successfully", 201);
  } catch (error) {
    console.error("Error creating materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update materi
 */
export const updateMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul_materi, deskripsi } = req.body;
    const { role, id: userId } = req.user;

    // Validation
    if (!judul_materi) {
      return errorResponse(res, "judul_materi wajib diisi", 400);
    }

    // Get materi to check access
    const { data: materi, error: fetchError } = await supabaseAdmin
      .from("materi")
      .select("kelas_id")
      .eq("id", id)
      .single();

    if (fetchError || !materi) {
      return errorResponse(res, "Materi tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses untuk mengubah materi ini",
          403
        );
      }
    }

    // Update materi
    const { data: updatedMateri, error: updateError } = await supabaseAdmin
      .from("materi")
      .update({
        judul_materi,
        deskripsi: deskripsi || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return successResponse(
      res,
      { materi: updatedMateri },
      "Materi updated successfully"
    );
  } catch (error) {
    console.error("Error updating materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Delete materi (cascades to sub_materi and sub_materi_media)
 */
export const deleteMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Get materi to check access
    const { data: materi, error: fetchError } = await supabaseAdmin
      .from("materi")
      .select("kelas_id")
      .eq("id", id)
      .single();

    if (fetchError || !materi) {
      return errorResponse(res, "Materi tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses untuk menghapus materi ini",
          403
        );
      }
    }

    // Get all media URLs to delete from storage
    const { data: subMateriList, error: subError } = await supabaseAdmin
      .from("sub_materi")
      .select(
        `
        id,
        sub_materi_media (url)
      `
      )
      .eq("materi_id", id);

    if (subError) throw subError;

    // Delete all media files from storage
    if (subMateriList && subMateriList.length > 0) {
      for (const sub of subMateriList) {
        if (sub.sub_materi_media && sub.sub_materi_media.length > 0) {
          for (const media of sub.sub_materi_media) {
            await deleteFromStorage(media.url);
          }
        }
      }
    }

    // Delete materi (cascade deletes sub_materi and sub_materi_media)
    const { error: deleteError } = await supabaseAdmin
      .from("materi")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return successResponse(res, null, "Materi deleted successfully");
  } catch (error) {
    console.error("Error deleting materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==================== SUB_MATERI (Children) ====================

/**
 * Get all sub_materi for a materi (ordered by urutan)
 */
export const getSubMateriByMateri = async (req, res) => {
  try {
    const { materiId } = req.params;
    const { role, id: userId } = req.user;

    // Get materi to verify access
    const { data: materi, error: materiError } = await supabaseAdmin
      .from("materi")
      .select("kelas_id")
      .eq("id", materiId)
      .single();

    if (materiError || !materi) {
      return errorResponse(res, "Materi tidak ditemukan", 404);
    }

    // Verify access if guru
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses ke materi ini",
          403
        );
      }
    }

    // Get sub_materi with media
    const { data: subMateri, error: subError } = await supabaseAdmin
      .from("sub_materi")
      .select(
        `
        id,
        materi_id,
        judul_sub_materi,
        isi_materi,
        urutan,
        created_at,
        updated_at,
        sub_materi_media (
          id,
          tipe_media,
          url,
          created_at
        )
      `
      )
      .eq("materi_id", materiId)
      .order("urutan", { ascending: true });

    if (subError) throw subError;

    return successResponse(
      res,
      { sub_materi: subMateri || [] },
      "Sub materi retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching sub materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get single sub_materi by ID with media
 */
export const getSubMateriById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Get sub_materi with materi and media
    const { data: subMateri, error } = await supabaseAdmin
      .from("sub_materi")
      .select(
        `
        id,
        materi_id,
        judul_sub_materi,
        isi_materi,
        urutan,
        created_at,
        updated_at,
        materi (
          kelas_id
        ),
        sub_materi_media (
          id,
          tipe_media,
          url,
          created_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!subMateri) {
      return errorResponse(res, "Sub materi tidak ditemukan", 404);
    }

    // Verify access if guru
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", subMateri.materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses ke sub materi ini",
          403
        );
      }
    }

    return successResponse(
      res,
      { sub_materi: subMateri },
      "Sub materi retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching sub materi by ID:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Create sub_materi with optional media upload
 * Expects multipart/form-data with fields:
 * - materi_id, judul_sub_materi, isi_materi, urutan
 * - files: array of files with metadata (tipe_media)
 */
export const createSubMateri = async (req, res) => {
  try {
    const { materi_id, judul_sub_materi, isi_materi, urutan } = req.body;
    const { role, id: userId } = req.user;
    const files = req.files; // from multer

    // Validation
    const parsedUrutan = Number.parseInt(urutan, 10);
    if (!materi_id || !judul_sub_materi || Number.isNaN(parsedUrutan)) {
      return errorResponse(
        res,
        "materi_id, judul_sub_materi, dan urutan wajib diisi",
        400
      );
    }

    const normalizedIsiMateri =
      typeof isi_materi === "string" ? isi_materi : "";

    // Get materi to verify access
    const { data: materi, error: materiError } = await supabaseAdmin
      .from("materi")
      .select("kelas_id")
      .eq("id", materi_id)
      .single();

    if (materiError || !materi) {
      return errorResponse(res, "Materi tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(res, "Anda tidak mengajar di kelas ini", 403);
      }
    }

    // Create sub_materi
    const { data: subMateri, error: insertError } = await supabaseAdmin
      .from("sub_materi")
      .insert([
        {
          materi_id,
          judul_sub_materi,
          isi_materi: normalizedIsiMateri,
          urutan: parsedUrutan,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // Upload media files if provided
    const uploadedMedia = [];
    if (files && files.length > 0) {
      for (const file of files) {
        let tipeMedia = file.fieldname.split("_")[0];

        if (![`pdf`, `video`, `gambar`].includes(tipeMedia)) {
          if (file.mimetype?.startsWith("image/")) {
            tipeMedia = "gambar";
          } else if (file.mimetype?.startsWith("video/")) {
            tipeMedia = "video";
          } else {
            tipeMedia = "pdf";
          }
        }

        // Validate file type
        if (!validateFileType(file.originalname, tipeMedia)) {
          // Skip invalid files
          console.warn(
            `Invalid file type: ${file.originalname} for ${tipeMedia}`
          );
          continue;
        }

        // Upload to storage
        const publicUrl = await uploadToStorage(
          file.buffer,
          file.originalname,
          tipeMedia,
          tipeMedia
        );

        // Save to sub_materi_media table
        const { data: media, error: mediaError } = await supabaseAdmin
          .from("sub_materi_media")
          .insert([
            {
              sub_materi_id: subMateri.id,
              tipe_media: tipeMedia,
              url: publicUrl,
            },
          ])
          .select()
          .single();

        if (mediaError) throw mediaError;
        uploadedMedia.push(media);
      }
    }

    return successResponse(
      res,
      {
        sub_materi: {
          ...subMateri,
          sub_materi_media: uploadedMedia,
        },
      },
      "Sub materi created successfully",
      201
    );
  } catch (error) {
    console.error("Error creating sub materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update sub_materi (text only, use separate endpoint for media)
 */
export const updateSubMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul_sub_materi, isi_materi, urutan } = req.body;
    const { role, id: userId } = req.user;

    // Validation
    if (!judul_sub_materi && !isi_materi && !urutan) {
      return errorResponse(res, "Minimal satu field harus diisi", 400);
    }

    // Get sub_materi to check access
    const { data: subMateri, error: fetchError } = await supabaseAdmin
      .from("sub_materi")
      .select(
        `
        id,
        materi (
          kelas_id
        )
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !subMateri) {
      return errorResponse(res, "Sub materi tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", subMateri.materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses untuk mengubah sub materi ini",
          403
        );
      }
    }

    // Build update object
    const updates = {};
    if (judul_sub_materi) updates.judul_sub_materi = judul_sub_materi;
    if (isi_materi !== undefined)
      updates.isi_materi = typeof isi_materi === "string" ? isi_materi : "";
    if (urutan !== undefined && urutan !== null && urutan !== "")
      updates.urutan = Number.parseInt(urutan, 10);

    // Update sub_materi
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("sub_materi")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return successResponse(
      res,
      { sub_materi: updated },
      "Sub materi updated successfully"
    );
  } catch (error) {
    console.error("Error updating sub materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Delete sub_materi (cascades to sub_materi_media)
 */
export const deleteSubMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Get sub_materi to check access
    const { data: subMateri, error: fetchError } = await supabaseAdmin
      .from("sub_materi")
      .select(
        `
        id,
        materi (
          kelas_id
        ),
        sub_materi_media (url)
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !subMateri) {
      return errorResponse(res, "Sub materi tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", subMateri.materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses untuk menghapus sub materi ini",
          403
        );
      }
    }

    // Delete all media files from storage
    if (subMateri.sub_materi_media && subMateri.sub_materi_media.length > 0) {
      for (const media of subMateri.sub_materi_media) {
        await deleteFromStorage(media.url);
      }
    }

    // Delete sub_materi (cascade deletes sub_materi_media)
    const { error: deleteError } = await supabaseAdmin
      .from("sub_materi")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return successResponse(res, null, "Sub materi deleted successfully");
  } catch (error) {
    console.error("Error deleting sub materi:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ==================== SUB_MATERI_MEDIA ====================

/**
 * Upload media for sub_materi
 * Expects multipart/form-data with file and tipe_media
 */
export const uploadMedia = async (req, res) => {
  try {
    const { subMateriId } = req.params;
    const { tipe_media } = req.body;
    const { role, id: userId } = req.user;
    const file = req.file; // from multer

    // Validation
    if (!file) {
      return errorResponse(res, "File wajib diupload", 400);
    }

    if (!["pdf", "video", "gambar"].includes(tipe_media)) {
      return errorResponse(
        res,
        "tipe_media harus pdf, video, atau gambar",
        400
      );
    }

    // Validate file type
    if (!validateFileType(file.originalname, tipe_media)) {
      return errorResponse(
        res,
        `File type tidak sesuai dengan tipe_media ${tipe_media}`,
        400
      );
    }

    // Get sub_materi to verify access
    const { data: subMateri, error: subError } = await supabaseAdmin
      .from("sub_materi")
      .select(
        `
        id,
        materi (
          kelas_id
        )
      `
      )
      .eq("id", subMateriId)
      .single();

    if (subError || !subMateri) {
      return errorResponse(res, "Sub materi tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", subMateri.materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(res, "Anda tidak mengajar di kelas ini", 403);
      }
    }

    // Upload to storage
    const publicUrl = await uploadToStorage(
      file.buffer,
      file.originalname,
      tipe_media,
      tipe_media
    );

    // Save to sub_materi_media table
    const { data: media, error: mediaError } = await supabaseAdmin
      .from("sub_materi_media")
      .insert([
        {
          sub_materi_id: subMateriId,
          tipe_media,
          url: publicUrl,
        },
      ])
      .select()
      .single();

    if (mediaError) throw mediaError;

    return successResponse(res, { media }, "Media uploaded successfully", 201);
  } catch (error) {
    console.error("Error uploading media:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Delete media from sub_materi
 */
export const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { role, id: userId } = req.user;

    // Get media with sub_materi to verify access
    const { data: media, error: mediaError } = await supabaseAdmin
      .from("sub_materi_media")
      .select(
        `
        id,
        url,
        sub_materi (
          id,
          materi (
            kelas_id
          )
        )
      `
      )
      .eq("id", mediaId)
      .single();

    if (mediaError || !media) {
      return errorResponse(res, "Media tidak ditemukan", 404);
    }

    // Verify guru teaches this kelas
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", media.sub_materi.materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses untuk menghapus media ini",
          403
        );
      }
    }

    // Delete from storage
    await deleteFromStorage(media.url);

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from("sub_materi_media")
      .delete()
      .eq("id", mediaId);

    if (deleteError) throw deleteError;

    return successResponse(res, null, "Media deleted successfully");
  } catch (error) {
    console.error("Error deleting media:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get all media for a sub_materi
 */
export const getMediaBySubMateri = async (req, res) => {
  try {
    const { subMateriId } = req.params;
    const { role, id: userId } = req.user;

    // Get sub_materi to verify access
    const { data: subMateri, error: subError } = await supabaseAdmin
      .from("sub_materi")
      .select(
        `
        id,
        materi (
          kelas_id
        )
      `
      )
      .eq("id", subMateriId)
      .single();

    if (subError || !subMateri) {
      return errorResponse(res, "Sub materi tidak ditemukan", 404);
    }

    // Verify access if guru
    if (role === "guru") {
      const { data: guruKelas, error: guruError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", subMateri.materi.kelas_id)
        .eq("pengguna_id", userId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruError) throw guruError;
      if (!guruKelas) {
        return errorResponse(
          res,
          "Anda tidak memiliki akses ke media ini",
          403
        );
      }
    }

    // Get all media
    const { data: media, error: mediaError } = await supabaseAdmin
      .from("sub_materi_media")
      .select("*")
      .eq("sub_materi_id", subMateriId)
      .order("created_at", { ascending: true });

    if (mediaError) throw mediaError;

    return successResponse(
      res,
      { media: media || [] },
      "Media retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching media:", error);
    return errorResponse(res, error.message, 500);
  }
};
