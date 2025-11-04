import { supabaseAdmin } from "../config/supabaseAdmin.js";

export const getAllAdmins = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Hanya superadmin yang bisa mengakses data admin" });
    }
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .select(
        `
        *,
        sekolah:sekolah_id (
          id,
          nama_sekolah
        )
      `
      )
      .eq("role", "admin");
    if (error) throw error;
    const adminsWithEmail = await Promise.all(
      (data || []).map(async (adminRow) => {
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.getUserById(adminRow.id);
        if (authError) {
          console.error(
            "❌ Gagal mengambil email admin dari Supabase Auth:",
            adminRow.id,
            authError
          );
        }

        return {
          ...adminRow,
          email: authData?.user?.email ?? null,
          sekolah_name: adminRow.sekolah?.nama_sekolah ?? null,
        };
      })
    );

    res.json({
      message: "Admins retrieved successfully",
      admins: adminsWithEmail,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({
        error: "Hanya superadmin yang bisa menambah admin",
      });
    }

    const { email, password, nama_lengkap, jenis_kelamin, sekolah_id } =
      req.body;

    // Validasi field wajib
    if (!email || !password || !nama_lengkap || !sekolah_id) {
      return res.status(400).json({
        error:
          "Field email, password, nama_lengkap, dan sekolah_id wajib diisi",
      });
    }

    // Validasi ENUM jenis_kelamin
    if (jenis_kelamin && !["laki-laki", "perempuan"].includes(jenis_kelamin)) {
      return res.status(400).json({
        error: "jenis_kelamin harus 'laki-laki' atau 'perempuan'",
      });
    }

    // 1️⃣ STEP 1: Register user ke Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm email (skip verification)
        user_metadata: {
          nama_lengkap: nama_lengkap,
          role: "admin",
        },
      });

    if (authError) {
      console.error("❌ Supabase Auth error:", authError);
      return res.status(400).json({
        error: "Gagal membuat akun auth",
        details: authError.message,
      });
    }

    // 2️⃣ STEP 2: Insert ke tabel pengguna dengan ID dari auth.users
    const { data: userData, error: userError } = await supabaseAdmin
      .from("pengguna")
      .insert([
        {
          id: authData.user.id,
          nama_lengkap: nama_lengkap,
          jenis_kelamin: jenis_kelamin,
          role: "admin",
          sekolah_id: sekolah_id,
          creator_id: req.user.id,
        },
      ])
      .select();

    if (userError) {
      console.error("❌ Supabase pengguna error:", userError);

      // Rollback: Hapus user dari auth jika insert ke pengguna gagal
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return res.status(400).json({
        error: "Gagal menyimpan data pengguna",
        details: userError.message,
      });
    }

    res.status(201).json({
      message: "Admin berhasil ditambahkan",
      admin: {
        id: userData[0].id,
        nama_lengkap: userData[0].nama_lengkap,
        jenis_kelamin: userData[0].jenis_kelamin,
        sekolah_id: userData[0].sekolah_id,
        role: userData[0].role,
        created_at: userData[0].created_at,
        email: authData.user?.email ?? email,
      },
    });
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.params;
    const { nama_lengkap, jenis_kelamin, sekolah_id, email, password } =
      req.body;

    // Update di tabel pengguna
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .update({ nama_lengkap, jenis_kelamin, sekolah_id })
      .eq("id", id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Optional: Update email/password di auth.users juga
    const authUpdatePayload = {};
    if (email) authUpdatePayload.email = email;
    if (password) authUpdatePayload.password = password;

    if (Object.keys(authUpdatePayload).length > 0) {
      await supabaseAdmin.auth.admin.updateUserById(id, authUpdatePayload);
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(id);
    if (authError) {
      console.error(
        "❌ Gagal mengambil data email admin setelah update:",
        id,
        authError
      );
    }

    res.json({
      message: "Admin updated successfully",
      admin: {
        ...data[0],
        email: authData?.user?.email ?? email ?? null,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAdminById = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Hanya superadmin yang bisa mengakses data admin" });
    }

    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .select("*")
      .eq("id", id)
      .eq("role", "admin")
      .single();
    if (error) throw error;
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(id);
    if (authError) {
      console.error(
        "❌ Gagal mengambil email admin dari Supabase Auth:",
        id,
        authError
      );
    }

    res.json({
      message: "Admin retrieved successfully",
      user: {
        ...data,
        email: authData?.user?.email ?? null,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.params;

    // Hapus dari auth.users (otomatis hapus dari pengguna via CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Admin deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get current admin profile (for own profile)
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get data from pengguna table
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .select("*")
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

    res.json({
      message: "Profile retrieved successfully",
      admin: {
        ...data,
        email: authData?.user?.email ?? null,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update current admin profile (for own profile)
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nama_lengkap, jenis_kelamin, alamat } = req.body;

    // Build update object
    const updateData = {};
    if (nama_lengkap !== undefined) updateData.nama_lengkap = nama_lengkap;
    if (jenis_kelamin !== undefined) updateData.jenis_kelamin = jenis_kelamin;
    if (alamat !== undefined) updateData.alamat = alamat;

    // Update di tabel pengguna
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .update(updateData)
      .eq("id", userId)
      .select();

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

    res.json({
      message: "Profile updated successfully",
      admin: {
        ...data[0],
        email: authData?.user?.email ?? null,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update password for current admin
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
    console.error("❌ Error updating password:", error);
    res.status(500).json({ error: error.message });
  }
};
