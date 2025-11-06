import { supabaseAdmin } from "../config/supabaseAdmin.js";

const kelasColumns = `
  id,
  sekolah_id,
  creator_id,
  nama_kelas,
  tingkat_kelas,
  rombel,
  mata_pelajaran,
  tahun_ajaran,
  created_at,
  updated_at
`;

const sanitizeRequiredString = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const sanitizeOptionalString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

export const getAllKelas = async (req, res) => {
  try {
    const { role, id: userId, sekolah_id: userSekolahId } = req.user;
    const { sekolah_id: sekolahIdQuery } = req.query;

    if (role === "guru" || role === "siswa") {
      const { data, error } = await supabaseAdmin
        .from("kelas_users")
        .select(
          `role_dalam_kelas,
          kelas:kelas (${kelasColumns})`
        )
        .eq("pengguna_id", userId);

      if (error) throw error;

      const kelasData = (data || []).map((row) => ({
        ...(row.kelas ?? {}),
        role_dalam_kelas: row.role_dalam_kelas,
      }));

      // Enrich dengan jumlah siswa dan foto profil siswa untuk setiap kelas
      const kelasIds = kelasData.map((k) => k.id).filter(Boolean);
      let studentCounts = {};
      let studentProfiles = {};

      if (kelasIds.length > 0) {
        // Get student data dengan foto profil (limit 3 per kelas untuk preview)
        const { data: siswaData, error: siswaError } = await supabaseAdmin
          .from("kelas_users")
          .select(`
            kelas_id,
            pengguna:pengguna!kelas_users_pengguna_id_fkey (
              id,
              karakter:pilih_karakter!pengguna_karakter_id_fkey (
                poto_profil_url
              )
            )
          `)
          .in("kelas_id", kelasIds)
          .eq("role_dalam_kelas", "siswa");

        if (siswaError) {
          console.error("Error fetching student data:", siswaError);
        } else {
          // Count students per kelas
          studentCounts = (siswaData || []).reduce((acc, row) => {
            acc[row.kelas_id] = (acc[row.kelas_id] || 0) + 1;
            return acc;
          }, {});

          // Get first 3 student profile photos per kelas
          studentProfiles = (siswaData || []).reduce((acc, row) => {
            if (!acc[row.kelas_id]) {
              acc[row.kelas_id] = [];
            }
            if (acc[row.kelas_id].length < 3) {
              const profileUrl = row.pengguna?.karakter?.poto_profil_url || "/siswa/foto-profil/kocheng-oren.svg";
              acc[row.kelas_id].push(profileUrl);
            }
            return acc;
          }, {});
        }
      }

      const enrichedKelas = kelasData.map((kelas) => ({
        ...kelas,
        jumlah_siswa: studentCounts[kelas.id] || 0,
        student_profiles: studentProfiles[kelas.id] || [],
      }));

      return res.json({
        message: "Kelas retrieved successfully",
        kelas: enrichedKelas,
      });
    }

    let query = supabaseAdmin
      .from("kelas")
      .select(kelasColumns)
      .order("created_at", { ascending: false });

    if (role === "admin") {
      if (!userSekolahId) {
        return res
          .status(400)
          .json({ error: "Admin belum terhubung dengan sekolah manapun" });
      }
      query = query.eq("sekolah_id", userSekolahId);
    } else if (sekolahIdQuery) {
      query = query.eq("sekolah_id", sekolahIdQuery);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich each kelas with student count and profile photos
    const kelasIds = (data || []).map((kelas) => kelas.id);
    let studentCounts = {};
    let studentProfiles = {};

    if (kelasIds.length > 0) {
      // Get student data dengan foto profil (limit 3 per kelas untuk preview)
      const { data: siswaData, error: siswaError } = await supabaseAdmin
        .from("kelas_users")
        .select(`
          kelas_id,
          pengguna:pengguna!kelas_users_pengguna_id_fkey (
            id,
            karakter:pilih_karakter!pengguna_karakter_id_fkey (
              poto_profil_url
            )
          )
        `)
        .in("kelas_id", kelasIds)
        .eq("role_dalam_kelas", "siswa");

      if (siswaError) {
        console.error("Error fetching student data:", siswaError);
      } else {
        // Count students per kelas
        studentCounts = (siswaData || []).reduce((acc, row) => {
          acc[row.kelas_id] = (acc[row.kelas_id] || 0) + 1;
          return acc;
        }, {});

        // Get first 3 student profile photos per kelas
        studentProfiles = (siswaData || []).reduce((acc, row) => {
          if (!acc[row.kelas_id]) {
            acc[row.kelas_id] = [];
          }
          if (acc[row.kelas_id].length < 3) {
            const profileUrl = row.pengguna?.karakter?.poto_profil_url || "/siswa/foto-profil/kocheng-oren.svg";
            acc[row.kelas_id].push(profileUrl);
          }
          return acc;
        }, {});
      }
    }

    const enrichedKelas = (data || []).map((kelas) => ({
      ...kelas,
      jumlah_siswa: studentCounts[kelas.id] || 0,
      student_profiles: studentProfiles[kelas.id] || [],
    }));

    res.json({
      message: "Kelas retrieved successfully",
      kelas: enrichedKelas,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createKelas = async (req, res) => {
  try {
    const { role, id: userId, sekolah_id: userSekolahId } = req.user;

    const {
      nama_kelas,
      sekolah_id,
      tingkat_kelas,
      rombel,
      mata_pelajaran,
      tahun_ajaran,
    } = req.body;

    const sanitizedNama = sanitizeRequiredString(nama_kelas);
    const sanitizedTingkat = sanitizeRequiredString(tingkat_kelas);
    const sanitizedRombel = sanitizeOptionalString(rombel);
    const sanitizedMapel = sanitizeOptionalString(mata_pelajaran);
    const sanitizedTahunAjaran = sanitizeOptionalString(tahun_ajaran);

    const resolvedSekolahId = role === "admin" ? userSekolahId : sekolah_id;

    if (!sanitizedNama || !sanitizedTingkat || !resolvedSekolahId) {
      return res.status(400).json({
        error: "Field nama_kelas, tingkat_kelas, dan sekolah_id wajib",
      });
    }

    if (role === "admin" && !userSekolahId) {
      return res
        .status(400)
        .json({ error: "Admin belum terhubung dengan sekolah manapun" });
    }

    const { data, error } = await supabaseAdmin
      .from("kelas")
      .insert([
        {
          nama_kelas: sanitizedNama,
          sekolah_id: resolvedSekolahId,
          creator_id: userId,
          tingkat_kelas: sanitizedTingkat,
          rombel: sanitizedRombel ?? null,
          mata_pelajaran: sanitizedMapel ?? null,
          tahun_ajaran: sanitizedTahunAjaran ?? null,
        },
      ])
      .select(kelasColumns)
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Kelas created successfully",
      kelas: data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getKelasById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId, sekolah_id: userSekolahId } = req.user;

    const { data, error } = await supabaseAdmin
      .from("kelas")
      .select(kelasColumns)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Kelas tidak ditemukan" });
    }

    if (role === "admin" && data.sekolah_id !== userSekolahId) {
      return res
        .status(403)
        .json({ error: "Anda tidak memiliki akses ke kelas ini" });
    }

    if (role === "guru" || role === "siswa") {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", id)
        .eq("pengguna_id", userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        return res
          .status(403)
          .json({ error: "Anda tidak terdaftar pada kelas ini" });
      }
    }

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
    const { role, sekolah_id: userSekolahId } = req.user;
    const {
      nama_kelas,
      sekolah_id,
      tingkat_kelas,
      rombel,
      mata_pelajaran,
      tahun_ajaran,
    } = req.body;

    const { data: existingKelas, error: existingError } = await supabaseAdmin
      .from("kelas")
      .select("sekolah_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingKelas) {
      return res.status(404).json({ error: "Kelas tidak ditemukan" });
    }

    if (role === "admin") {
      if (!userSekolahId || existingKelas.sekolah_id !== userSekolahId) {
        return res.status(403).json({
          error: "Anda tidak memiliki akses untuk mengubah kelas ini",
        });
      }
    }

    const payload = {};

    const sanitizedNama = sanitizeOptionalString(nama_kelas);
    if (sanitizedNama !== undefined) {
      if (sanitizedNama === null) {
        return res.status(400).json({ error: "nama_kelas tidak boleh kosong" });
      }
      payload.nama_kelas = sanitizedNama;
    }

    if (tingkat_kelas !== undefined) {
      const sanitizedTingkat = sanitizeRequiredString(tingkat_kelas);
      if (!sanitizedTingkat) {
        return res
          .status(400)
          .json({ error: "tingkat_kelas tidak boleh kosong" });
      }
      payload.tingkat_kelas = sanitizedTingkat;
    }

    const sanitizedRombel = sanitizeOptionalString(rombel);
    if (sanitizedRombel !== undefined) payload.rombel = sanitizedRombel;

    const sanitizedMapel = sanitizeOptionalString(mata_pelajaran);
    if (sanitizedMapel !== undefined) payload.mata_pelajaran = sanitizedMapel;

    const sanitizedTahun = sanitizeOptionalString(tahun_ajaran);
    if (sanitizedTahun !== undefined) payload.tahun_ajaran = sanitizedTahun;

    if (role === "superadmin" && sekolah_id !== undefined) {
      const sanitizedSekolah = sanitizeRequiredString(sekolah_id);
      if (!sanitizedSekolah) {
        return res.status(400).json({ error: "sekolah_id tidak boleh kosong" });
      }
      payload.sekolah_id = sanitizedSekolah;
    }

    if (role === "admin") {
      payload.sekolah_id = existingKelas.sekolah_id;
    }

    if (Object.keys(payload).length === 0) {
      return res
        .status(400)
        .json({ error: "Tidak ada perubahan yang dikirim" });
    }

    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("kelas")
      .update(payload)
      .eq("id", id)
      .select(kelasColumns)
      .single();

    if (error) throw error;

    res.json({
      message: "Kelas updated successfully",
      kelas: data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteKelas = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, sekolah_id: userSekolahId } = req.user;

    const { data: existingKelas, error: existingError } = await supabaseAdmin
      .from("kelas")
      .select("sekolah_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingKelas) {
      return res.status(404).json({ error: "Kelas tidak ditemukan" });
    }

    if (role === "admin") {
      if (!userSekolahId || existingKelas.sekolah_id !== userSekolahId) {
        return res.status(403).json({
          error: "Anda tidak memiliki akses untuk menghapus kelas ini",
        });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("kelas")
      .delete()
      .eq("id", id)
      .select(kelasColumns)
      .single();

    if (error) throw error;

    res.json({
      message: "Kelas deleted successfully",
      kelas: data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
