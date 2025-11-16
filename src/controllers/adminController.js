import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

export const getAllAdmins = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return errorResponse(
        res,
        "Hanya superadmin yang bisa mengakses data admin",
        403
      );
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

    return successResponse(
      res,
      adminsWithEmail,
      "Admins retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return errorResponse(
        res,
        "Hanya superadmin yang bisa menambah admin",
        403
      );
    }

    const { email, password, nama_lengkap, jenis_kelamin, sekolah_id } =
      req.body;

    // Validasi field wajib
    if (!email || !password || !nama_lengkap || !sekolah_id) {
      return errorResponse(
        res,
        "Field email, password, nama_lengkap, dan sekolah_id wajib diisi",
        400
      );
    }

    // Validasi ENUM jenis_kelamin
    if (jenis_kelamin && !["laki-laki", "perempuan"].includes(jenis_kelamin)) {
      return errorResponse(
        res,
        "jenis_kelamin harus 'laki-laki' atau 'perempuan'",
        400
      );
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
      return errorResponse(
        res,
        `Gagal membuat akun auth: ${authError.message}`,
        400
      );
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

      return errorResponse(
        res,
        `Gagal menyimpan data pengguna: ${userError.message}`,
        400
      );
    }

    return successResponse(
      res,
      {
        id: userData[0].id,
        nama_lengkap: userData[0].nama_lengkap,
        jenis_kelamin: userData[0].jenis_kelamin,
        sekolah_id: userData[0].sekolah_id,
        role: userData[0].role,
        created_at: userData[0].created_at,
        email: authData.user?.email ?? email,
      },
      "Admin berhasil ditambahkan",
      201
    );
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    return errorResponse(res, error.message, 500);
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return errorResponse(res, "Forbidden", 403);
    }

    const { id } = req.params;
    const { nama_lengkap, jenis_kelamin, sekolah_id, email, password } =
      req.body;

    // Update di tabel pengguna
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .update({ nama_lengkap, jenis_kelamin, sekolah_id })
      .eq("id", id)
      .select(
        `
        *,
        sekolah:sekolah_id (
          id,
          nama_sekolah
        )
      `
      );

    if (error) {
      return errorResponse(res, error.message, 400);
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

    return successResponse(
      res,
      {
        ...data[0],
        email: authData?.user?.email ?? email ?? null,
        sekolah_name: data[0]?.sekolah?.nama_sekolah ?? null,
      },
      "Admin updated successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

export const getAdminById = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return errorResponse(
        res,
        "Hanya superadmin yang bisa mengakses data admin",
        403
      );
    }

    const { id } = req.params;
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

    return successResponse(
      res,
      {
        ...data,
        email: authData?.user?.email ?? null,
        sekolah_name: data?.sekolah?.nama_sekolah ?? null,
      },
      "Admin retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return errorResponse(res, "Forbidden", 403);
    }

    const { id } = req.params;

    // Hapus dari auth.users (otomatis hapus dari pengguna via CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      return errorResponse(res, error.message, 400);
    }

    return successResponse(res, null, "Admin deleted successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Get current admin profile (for own profile)
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get data from pengguna table with sekolah info
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

    return successResponse(
      res,
      {
        ...data,
        email: authData?.user?.email ?? null,
        sekolah_name: data?.sekolah?.nama_sekolah ?? null,
      },
      "Profile retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
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
      .select(
        `
        *,
        sekolah:sekolah_id (
          id,
          nama_sekolah
        )
      `
      );

    if (error) {
      return errorResponse(res, error.message, 400);
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

    return successResponse(
      res,
      {
        ...data[0],
        email: authData?.user?.email ?? null,
        sekolah_name: data[0]?.sekolah?.nama_sekolah ?? null,
      },
      "Profile updated successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

// Update password for current admin
export const updateMyPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validasi input
    if (!currentPassword || !newPassword) {
      return errorResponse(
        res,
        "currentPassword dan newPassword wajib diisi",
        400
      );
    }

    if (newPassword.length < 8) {
      return errorResponse(res, "Password baru minimal 8 karakter", 400);
    }

    // Get user email first
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authData?.user?.email) {
      return errorResponse(res, "Gagal mendapatkan informasi user", 400);
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authData.user.email,
      password: currentPassword,
    });

    if (signInError) {
      return errorResponse(res, "Password saat ini salah", 401);
    }

    // Update password via admin API
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

    if (updateError) {
      return errorResponse(
        res,
        `Gagal mengubah password: ${updateError.message}`,
        400
      );
    }

    return successResponse(res, null, "Password berhasil diubah");
  } catch (error) {
    console.error("❌ Error updating password:", error);
    return errorResponse(res, error.message, 500);
  }
};
