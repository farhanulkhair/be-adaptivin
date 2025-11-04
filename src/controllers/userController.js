import { supabaseAdmin } from "../config/supabaseAdmin.js";

const managedUserBaseSelect = `
  id,
  nama_lengkap,
  role,
  jenis_kelamin,
  alamat,
  tanggal_lahir,
  nisn,
  nip,
  sekolah_id,
  creator_id,
  created_at,
  updated_at,
  sekolah:sekolah!pengguna_sekolah_id_fkey (
    id,
    nama_sekolah
  )
`;

const serializeManagedUser = (row) => {
  if (!row) return null;

  const kelasUsers = Array.isArray(row.kelas_users) ? row.kelas_users : [];
  const primaryAssignment =
    kelasUsers.find((assignment) => assignment?.kelas) ?? null;

  const mapKelas = (kelas) =>
    kelas
      ? {
          id: kelas.id,
          nama_kelas: kelas.nama_kelas ?? null,
          tingkat_kelas: kelas.tingkat_kelas ?? null,
          rombel: kelas.rombel ?? null,
          sekolah_id: kelas.sekolah_id ?? null,
        }
      : null;

  return {
    id: row.id,
    email: row.email ?? null,
    nama_lengkap: row.nama_lengkap ?? null,
    role: row.role ?? null,
    jenis_kelamin: row.jenis_kelamin ?? null,
    alamat: row.alamat ?? null,
    tanggal_lahir: row.tanggal_lahir ?? null,
    nisn: row.nisn ?? null,
    nip: row.nip ?? null,
    sekolah_id: row.sekolah_id ?? null,
    sekolah: row.sekolah
      ? {
          id: row.sekolah.id,
          nama_sekolah: row.sekolah.nama_sekolah ?? null,
        }
      : null,
    kelas: primaryAssignment?.kelas ? mapKelas(primaryAssignment.kelas) : null,
    kelas_assignments: kelasUsers.map((assignment) => ({
      id: assignment.id,
      role_dalam_kelas: assignment.role_dalam_kelas ?? null,
      kelas: mapKelas(assignment.kelas ?? null),
    })),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
};

const buildManagedUsersQuery = () =>
  supabaseAdmin
    .from("pengguna")
    .select(managedUserBaseSelect)
    .in("role", ["guru", "siswa"])
    .order("created_at", { ascending: false });

const enrichUsersWithEmails = async (users) => {
  if (!Array.isArray(users) || users.length === 0) {
    return users ?? [];
  }

  const emailPromises = users.map(async (user) => {
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(
        user.id
      );
      return { ...user, email: authData?.user?.email ?? null };
    } catch (error) {
      console.error(`Failed to fetch email for user ${user.id}:`, error);
      return { ...user, email: null };
    }
  });

  return await Promise.all(emailPromises);
};

const enrichUsersWithKelasAssignments = async (users) => {
  if (!Array.isArray(users) || users.length === 0) {
    return users ?? [];
  }

  const userIds = users
    .map((user) => user?.id)
    .filter((id) => typeof id === "string" && id.length > 0);

  if (userIds.length === 0) {
    return users.map((user) => ({ ...user, kelas_users: [] }));
  }

  const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
    .from("kelas_users")
    .select("id, pengguna_id, role_dalam_kelas, kelas_id")
    .in("pengguna_id", userIds);

  if (assignmentError) throw assignmentError;

  const kelasIds = [
    ...new Set(
      (assignmentRows ?? [])
        .map((assignment) => assignment.kelas_id)
        .filter((kelasId) => typeof kelasId === "string" && kelasId.length > 0)
    ),
  ];

  let kelasMap = {};
  if (kelasIds.length > 0) {
    const { data: kelasRows, error: kelasError } = await supabaseAdmin
      .from("kelas")
      .select("id, nama_kelas, tingkat_kelas, rombel, sekolah_id")
      .in("id", kelasIds);

    if (kelasError) throw kelasError;

    kelasMap = (kelasRows ?? []).reduce((acc, kelas) => {
      acc[kelas.id] = kelas;
      return acc;
    }, {});
  }

  const assignmentsByUser = (assignmentRows ?? []).reduce((acc, assignment) => {
    if (!assignment?.pengguna_id) {
      return acc;
    }
    const list = acc[assignment.pengguna_id] ?? [];
    list.push({
      id: assignment.id,
      role_dalam_kelas: assignment.role_dalam_kelas ?? null,
      kelas: assignment.kelas_id ? kelasMap[assignment.kelas_id] ?? null : null,
    });
    acc[assignment.pengguna_id] = list;
    return acc;
  }, {});

  return users.map((user) => ({
    ...user,
    kelas_users: assignmentsByUser[user.id] ?? [],
  }));
};

export const getAllUsers = async (req, res) => {
  try {
    const { role: requesterRole, sekolah_id: requesterSchoolId } = req.user;
    const { role: roleFilter, sekolah_id: sekolahFilter } = req.query;

    console.log("🔍 getAllUsers called:", {
      requesterRole,
      requesterSchoolId,
      roleFilter,
      sekolahFilter,
    });

    if (!["superadmin", "admin"].includes(requesterRole)) {
      return res.status(403).json({ error: "Akses ditolak" });
    }

    let query = buildManagedUsersQuery();

    if (roleFilter) {
      query = query.eq("role", roleFilter.toLowerCase());
    }

    if (requesterRole === "admin") {
      if (!requesterSchoolId) {
        console.log(
          "⚠️ Admin tidak memiliki sekolah_id, mengembalikan array kosong"
        );
        return res.json({
          message: "Admin belum terhubung dengan sekolah manapun",
          users: [],
        });
      }
      query = query.eq("sekolah_id", requesterSchoolId);
    } else if (sekolahFilter) {
      query = query.eq("sekolah_id", sekolahFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("❌ Supabase query error:", error);
      throw error;
    }

    console.log(`✅ Found ${data?.length ?? 0} users from database`);

    let enrichedUsers = data ?? [];
    try {
      enrichedUsers = await enrichUsersWithEmails(data ?? []);
      enrichedUsers = await enrichUsersWithKelasAssignments(enrichedUsers);
    } catch (enrichError) {
      console.error("enrichUsersWithKelasAssignments failed:", enrichError);
    }

    res.json({
      message: "Users retrieved successfully",
      users: enrichedUsers.map(serializeManagedUser),
    });
  } catch (error) {
    console.error("getAllUsers error:", error);
    res.status(400).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role: requesterRole, sekolah_id: requesterSchoolId } = req.user;

    if (!["superadmin", "admin"].includes(requesterRole)) {
      return res.status(403).json({ error: "Akses ditolak" });
    }

    const { data, error } = await buildManagedUsersQuery()
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "User tidak ditemukan" });
    }

    let enrichedUser = data;
    try {
      [enrichedUser] = await enrichUsersWithEmails([data]);
      [enrichedUser] = await enrichUsersWithKelasAssignments([enrichedUser]);
    } catch (enrichError) {
      console.error("enrich user detail failed:", enrichError);
    }

    if (
      requesterRole === "admin" &&
      requesterSchoolId &&
      enrichedUser?.sekolah_id !== requesterSchoolId
    ) {
      return res.status(403).json({ error: "Akses ditolak" });
    }

    res.json({
      message: "User retrieved successfully",
      user: serializeManagedUser(enrichedUser),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role: requesterRole, sekolah_id: requesterSchoolId } = req.user;
    const {
      nama_lengkap,
      role: newRole,
      alamat,
      tanggal_lahir,
      jenis_kelamin,
      nisn,
      nip,
      sekolah_id,
      kelas_id,
      kelas_ids, // For guru multi-class assignment
    } = req.body;
    const { data: existingUser, error: existingError } = await supabaseAdmin
      .from("pengguna")
      .select("id, role, sekolah_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingUser) {
      return res.status(404).json({ error: "User tidak ditemukan" });
    }

    if (
      requesterRole === "admin" &&
      (!requesterSchoolId || existingUser.sekolah_id !== requesterSchoolId)
    ) {
      return res.status(403).json({ error: "Akses ditolak" });
    }

    const normalizedRole = (newRole ?? existingUser.role)?.toLowerCase();
    if (newRole) {
      if (["admin", "superadmin"].includes(normalizedRole)) {
        return res.status(403).json({
          error: "Admin tidak boleh ubah role ke admin/superadmin",
        });
      }
      if (!["guru", "siswa"].includes(normalizedRole)) {
        return res.status(400).json({ error: "Role tidak valid" });
      }
    }

    const payload = {};

    if (nama_lengkap !== undefined) payload.nama_lengkap = nama_lengkap;
    if (alamat !== undefined) payload.alamat = alamat;
    if (tanggal_lahir !== undefined) {
      payload.tanggal_lahir = tanggal_lahir || null;
    }
    if (jenis_kelamin !== undefined) {
      const normalizedJenisKelamin = jenis_kelamin
        ? String(jenis_kelamin).toLowerCase()
        : null;
      if (
        normalizedJenisKelamin &&
        !["laki-laki", "perempuan"].includes(normalizedJenisKelamin)
      ) {
        return res.status(400).json({
          error: "Jenis kelamin harus 'laki-laki' atau 'perempuan'",
        });
      }
      payload.jenis_kelamin = normalizedJenisKelamin;
    }
    if (newRole !== undefined) {
      payload.role = normalizedRole;
    }

    if (normalizedRole === "siswa") {
      if (nisn !== undefined) payload.nisn = nisn;
      if (nip !== undefined) payload.nip = null;
    } else if (normalizedRole === "guru") {
      if (nip !== undefined) payload.nip = nip;
      if (nisn !== undefined) payload.nisn = null;
    }

    if (requesterRole === "superadmin" && sekolah_id !== undefined) {
      payload.sekolah_id = sekolah_id;
    }
    if (requesterRole === "admin") {
      payload.sekolah_id = existingUser.sekolah_id;
    }

    if (Object.keys(payload).length > 0) {
      payload.updated_at = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("pengguna")
        .update(payload)
        .eq("id", id);
      if (updateError) throw updateError;
    }

    // Handle class assignments
    if (kelas_id !== undefined || kelas_ids !== undefined) {
      // Determine classes to assign
      const classesToAssign = [];

      // For guru with multiple classes
      if (normalizedRole === "guru" && Array.isArray(kelas_ids)) {
        classesToAssign.push(...kelas_ids);
      }
      // For siswa or guru with single class
      else if (kelas_id !== undefined) {
        if (kelas_id) {
          classesToAssign.push(kelas_id);
        }
      }

      // Validate classes exist and belong to correct school
      if (classesToAssign.length > 0) {
        const { data: kelasDataList, error: kelasFetchError } =
          await supabaseAdmin
            .from("kelas")
            .select("id, sekolah_id")
            .in("id", classesToAssign);

        if (kelasFetchError) throw kelasFetchError;

        if (kelasDataList.length !== classesToAssign.length) {
          return res
            .status(400)
            .json({ error: "Beberapa kelas tidak ditemukan" });
        }

        if (requesterRole === "admin" && requesterSchoolId) {
          const invalidKelas = kelasDataList.find(
            (k) => k.sekolah_id !== requesterSchoolId
          );
          if (invalidKelas) {
            return res.status(403).json({
              error: "Beberapa kelas tidak tersedia untuk sekolah Anda",
            });
          }
        }
      }

      // Remove existing assignments
      const { error: removeError } = await supabaseAdmin
        .from("kelas_users")
        .delete()
        .eq("pengguna_id", id);
      if (removeError) throw removeError;

      // Add new assignments
      if (classesToAssign.length > 0) {
        const roleDalamKelas = normalizedRole === "guru" ? "guru" : "siswa";
        const insertData = classesToAssign.map((kelasId) => ({
          kelas_id: kelasId,
          pengguna_id: id,
          role_dalam_kelas: roleDalamKelas,
        }));

        const { error: assignError } = await supabaseAdmin
          .from("kelas_users")
          .insert(insertData);
        if (assignError) throw assignError;
      }
    }

    const { data: refreshed, error: refreshError } =
      await buildManagedUsersQuery().eq("id", id).maybeSingle();
    if (refreshError) throw refreshError;

    let enrichedUser = refreshed;
    try {
      const withEmails = await enrichUsersWithEmails(
        refreshed ? [refreshed] : []
      );
      [enrichedUser] = await enrichUsersWithKelasAssignments(withEmails);
    } catch (enrichError) {
      console.error("enrich user after update failed:", enrichError);
    }

    res.json({
      message: "User updated successfully",
      user: serializeManagedUser(enrichedUser ?? null),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role: requesterRole, sekolah_id: requesterSchoolId } = req.user;

    if (!["superadmin", "admin"].includes(requesterRole)) {
      return res.status(403).json({ error: "Akses ditolak" });
    }

    const { data: existingUser, error: existingError } = await supabaseAdmin
      .from("pengguna")
      .select("id, sekolah_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingUser) {
      return res.status(404).json({ error: "User tidak ditemukan" });
    }

    if (
      requesterRole === "admin" &&
      (!requesterSchoolId || existingUser.sekolah_id !== requesterSchoolId)
    ) {
      return res.status(403).json({ error: "Akses ditolak" });
    }

    const { error: detachError } = await supabaseAdmin
      .from("kelas_users")
      .delete()
      .eq("pengguna_id", id);
    if (detachError) throw detachError;

    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .delete()
      .eq("id", id)
      .select(managedUserBaseSelect)
      .maybeSingle();
    if (error) throw error;

    let enrichedUser = data;
    try {
      const withEmails = await enrichUsersWithEmails(data ? [data] : []);
      [enrichedUser] = await enrichUsersWithKelasAssignments(withEmails);
    } catch (enrichError) {
      console.error("enrich user after delete failed:", enrichError);
    }

    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (authError) {
      console.error("Delete auth user warning:", authError.message);
    }

    res.json({
      message: "User deleted successfully",
      user: serializeManagedUser(enrichedUser ?? null),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get my own profile (for guru/siswa)
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get data from pengguna table
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .select(managedUserBaseSelect)
      .eq("id", userId)
      .single();

    if (error) throw error;

    // Get email from auth.users
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError) {
      console.error(
        "❌ Gagal mengambil email dari Supabase Auth:",
        userId,
        authError
      );
    }

    // Enrich with kelas assignments
    let enrichedUser = { ...data, email: authData?.user?.email ?? null };
    try {
      [enrichedUser] = await enrichUsersWithKelasAssignments([enrichedUser]);
    } catch (enrichError) {
      console.error("enrich user detail failed:", enrichError);
    }

    res.json({
      message: "Profile retrieved successfully",
      user: serializeManagedUser(enrichedUser),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update password for current user (guru/siswa)
export const updateMyPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validasi input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "currentPassword dan newPassword wajib diisi",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Password baru minimal 8 karakter",
      });
    }

    // Get user email first
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authData?.user?.email) {
      return res.status(400).json({
        error: "Gagal mendapatkan informasi user",
      });
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authData.user.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(401).json({
        error: "Password saat ini salah",
      });
    }

    // Update password via admin API
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

    if (updateError) {
      return res.status(400).json({
        error: "Gagal mengubah password",
        details: updateError.message,
      });
    }

    res.json({
      message: "Password berhasil diubah",
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update my own profile (for guru/siswa)
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      nama_lengkap,
      alamat,
      tanggal_lahir,
      jenis_kelamin,
      profil_siswa_index,
    } = req.body;

    // Build update object
    const updateData = {};
    if (nama_lengkap !== undefined) updateData.nama_lengkap = nama_lengkap;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (tanggal_lahir !== undefined)
      updateData.tanggal_lahir = tanggal_lahir || null;

    if (jenis_kelamin !== undefined) {
      const normalizedJenisKelamin = jenis_kelamin
        ? String(jenis_kelamin).toLowerCase()
        : null;
      if (
        normalizedJenisKelamin &&
        !["laki-laki", "perempuan"].includes(normalizedJenisKelamin)
      ) {
        return res.status(400).json({
          error: "Jenis kelamin harus 'laki-laki' atau 'perempuan'",
        });
      }
      updateData.jenis_kelamin = normalizedJenisKelamin;
    }

    // Update profil siswa index (untuk ganti avatar)
    if (profil_siswa_index !== undefined) {
      // Validate: must be integer between 0-4 (5 avatars available)
      const index = parseInt(profil_siswa_index);
      if (isNaN(index) || index < 0 || index > 4) {
        return res.status(400).json({
          error: "profil_siswa_index harus angka 0-4",
        });
      }
      updateData.profil_siswa_index = index;
    }

    // Update di tabel pengguna
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .update(updateData)
      .eq("id", userId)
      .select(managedUserBaseSelect);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get email from auth.users
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError) {
      console.error(
        "❌ Gagal mengambil email setelah update:",
        userId,
        authError
      );
    }

    // Enrich with kelas assignments
    let enrichedUser = { ...data[0], email: authData?.user?.email ?? null };
    try {
      [enrichedUser] = await enrichUsersWithKelasAssignments([enrichedUser]);
    } catch (enrichError) {
      console.error("enrich user after update failed:", enrichError);
    }

    res.json({
      message: "Profile updated successfully",
      user: serializeManagedUser(enrichedUser),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const {
      role: requesterRole,
      id: requesterId,
      sekolah_id: requesterSchoolId,
    } = req.user;

    console.log("🔍 createUser called:", {
      requesterRole,
      requesterId,
      requesterSchoolId,
      body: req.body,
    });

    if (!["superadmin", "admin"].includes(requesterRole)) {
      return res.status(403).json({ error: "Akses ditolak" });
    }

    const {
      email,
      password,
      nama_lengkap,
      role,
      jenis_kelamin,
      alamat,
      tanggal_lahir,
      nisn,
      nip,
      sekolah_id,
      kelas_id,
      kelas_ids, // For guru multi-class assignment
    } = req.body;

    if (!email || !password || !nama_lengkap || !role) {
      return res
        .status(400)
        .json({ error: "Field email, password, nama_lengkap, dan role wajib" });
    }

    const normalizedRole = String(role).toLowerCase();
    if (!["guru", "siswa"].includes(normalizedRole)) {
      return res.status(400).json({ error: "Role tidak valid" });
    }

    // Normalize jenis_kelamin to match database enum
    const normalizedJenisKelamin = jenis_kelamin
      ? String(jenis_kelamin).toLowerCase()
      : null;
    if (
      normalizedJenisKelamin &&
      !["laki-laki", "perempuan"].includes(normalizedJenisKelamin)
    ) {
      return res.status(400).json({
        error: "Jenis kelamin harus 'laki-laki' atau 'perempuan'",
      });
    }

    if (normalizedRole === "guru" && !nip) {
      return res.status(400).json({ error: "NIP wajib diisi untuk guru" });
    }

    if (normalizedRole === "siswa" && !nisn) {
      return res.status(400).json({ error: "NISN wajib diisi untuk siswa" });
    }

    const resolvedSchoolId =
      requesterRole === "admin" ? requesterSchoolId : sekolah_id;
    if (!resolvedSchoolId) {
      return res
        .status(400)
        .json({ error: "Sekolah belum ditentukan untuk pengguna baru" });
    }

    if (kelas_id) {
      const { data: kelasData, error: kelasError } = await supabaseAdmin
        .from("kelas")
        .select("id, sekolah_id")
        .eq("id", kelas_id)
        .maybeSingle();

      if (kelasError) throw kelasError;
      if (!kelasData) {
        return res.status(400).json({ error: "Kelas tidak ditemukan" });
      }

      if (
        requesterRole === "admin" &&
        kelasData.sekolah_id !== resolvedSchoolId
      ) {
        return res
          .status(403)
          .json({ error: "Kelas tidak tersedia untuk sekolah Anda" });
      }
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nama_lengkap,
          role: normalizedRole,
        },
      });

    if (authError || !authData?.user) {
      throw new Error(authError?.message || "Gagal membuat akun Auth");
    }

    const userId = authData.user.id;

    const insertPayload = {
      id: userId,
      nama_lengkap,
      role: normalizedRole,
      jenis_kelamin: normalizedJenisKelamin,
      alamat: alamat ?? null,
      tanggal_lahir: tanggal_lahir ?? null,
      nisn: normalizedRole === "siswa" ? nisn : null,
      nip: normalizedRole === "guru" ? nip : null,
      sekolah_id: resolvedSchoolId,
      creator_id: requesterId,
    };

    const { data: insertedUser, error: insertError } = await supabaseAdmin
      .from("pengguna")
      .insert(insertPayload)
      .select(managedUserBaseSelect)
      .single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw insertError;
    }

    // Handle class assignments
    const classesToAssign = [];

    // For guru with multiple classes
    if (
      normalizedRole === "guru" &&
      Array.isArray(kelas_ids) &&
      kelas_ids.length > 0
    ) {
      classesToAssign.push(...kelas_ids);
    }
    // For siswa or guru with single class
    else if (kelas_id) {
      classesToAssign.push(kelas_id);
    }

    if (classesToAssign.length > 0) {
      const roleDalamKelas = normalizedRole === "guru" ? "guru" : "siswa";
      const insertData = classesToAssign.map((kelasId) => ({
        kelas_id: kelasId,
        pengguna_id: userId,
        role_dalam_kelas: roleDalamKelas,
      }));

      const { error: kelasAssignError } = await supabaseAdmin
        .from("kelas_users")
        .insert(insertData);

      if (kelasAssignError) {
        await supabaseAdmin.from("pengguna").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw kelasAssignError;
      }
    }

    const { data: hydratedUser, error: hydrateError } =
      await buildManagedUsersQuery().eq("id", userId).maybeSingle();
    if (hydrateError) throw hydrateError;

    let enrichedUser = hydratedUser;
    try {
      const withEmails = await enrichUsersWithEmails(
        hydratedUser ? [hydratedUser] : []
      );
      [enrichedUser] = await enrichUsersWithKelasAssignments(withEmails);
    } catch (enrichError) {
      console.error("enrich user after create failed:", enrichError);
    }

    res.status(201).json({
      message: "User created successfully",
      user: serializeManagedUser(enrichedUser ?? null),
    });
  } catch (error) {
    console.error("❌ createUser error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Get siswa list by kelas (for guru to see their students)
export const getSiswaByKelas = async (req, res) => {
  try {
    const { kelasId } = req.params;
    const { role: requesterRole, id: requesterId } = req.user;

    console.log("🔍 getSiswaByKelas called:", {
      kelasId,
      requesterRole,
      requesterId,
    });

    // Check if user has access to this kelas
    if (requesterRole === "guru") {
      // Verify guru teaches this class
      const { data: guruKelas, error: guruKelasError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", kelasId)
        .eq("pengguna_id", requesterId)
        .eq("role_dalam_kelas", "guru")
        .maybeSingle();

      if (guruKelasError) throw guruKelasError;
      if (!guruKelas) {
        return res.status(403).json({
          error: "Anda tidak memiliki akses ke kelas ini",
        });
      }
    } else if (requesterRole === "siswa") {
      // Siswa can only see classmates
      const { data: siswaKelas, error: siswaKelasError } = await supabaseAdmin
        .from("kelas_users")
        .select("id")
        .eq("kelas_id", kelasId)
        .eq("pengguna_id", requesterId)
        .eq("role_dalam_kelas", "siswa")
        .maybeSingle();

      if (siswaKelasError) throw siswaKelasError;
      if (!siswaKelas) {
        return res.status(403).json({
          error: "Anda tidak terdaftar di kelas ini",
        });
      }
    }
    // Admin and superadmin can access all classes

    // Get all siswa in this kelas
    const { data: kelasUsersData, error: kelasUsersError } =
      await supabaseAdmin
        .from("kelas_users")
        .select("pengguna_id")
        .eq("kelas_id", kelasId)
        .eq("role_dalam_kelas", "siswa");

    if (kelasUsersError) throw kelasUsersError;

    const siswaIds = (kelasUsersData || [])
      .map((ku) => ku.pengguna_id)
      .filter(Boolean);

    if (siswaIds.length === 0) {
      return res.json({
        message: "Siswa retrieved successfully",
        siswa: [],
        total: 0,
      });
    }

    // Get siswa details
    const { data: siswaData, error: siswaError } = await supabaseAdmin
      .from("pengguna")
      .select(
        `
        id,
        nama_lengkap,
        nisn,
        jenis_kelamin,
        tanggal_lahir,
        alamat,
        profil_siswa_index,
        created_at,
        updated_at
      `
      )
      .in("id", siswaIds)
      .eq("role", "siswa")
      .order("nama_lengkap", { ascending: true });

    if (siswaError) throw siswaError;

    // Get emails from auth
    const enrichedSiswa = await Promise.all(
      (siswaData || []).map(async (siswa) => {
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(
            siswa.id
          );
          return {
            ...siswa,
            email: authData?.user?.email ?? null,
          };
        } catch (error) {
          console.error(`Failed to fetch email for siswa ${siswa.id}:`, error);
          return {
            ...siswa,
            email: null,
          };
        }
      })
    );

    res.json({
      message: "Siswa retrieved successfully",
      siswa: enrichedSiswa,
      total: enrichedSiswa.length,
    });
  } catch (error) {
    console.error("❌ getSiswaByKelas error:", error);
    res.status(400).json({ error: error.message });
  }
};
