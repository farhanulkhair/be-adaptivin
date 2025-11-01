import { supabaseAdmin } from "../config/supabaseAdmin.js"; // ✅ Pakai admin client!

const seedSuperAdmin = async () => {
  try {
    console.log("🔄 Checking for existing superadmin...");

    // Cek apakah sudah ada superadmin
    const { data: existingSuperAdmin, error: checkError } = await supabaseAdmin
      .from("pengguna")
      .select("*")
      .eq("role", "superadmin")
      .limit(1);

    if (checkError) throw checkError;

    if (existingSuperAdmin.length > 0) {
      console.log("⚠️ Superadmin sudah ada, tidak perlu seed lagi.");
      console.log("📧 Email:", existingSuperAdmin[0].email);
      return;
    }

    console.log("📝 Creating superadmin in Supabase Auth...");

    // ✅ Daftarkan user superadmin menggunakan admin.createUser
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: "superadmin@gmail.com",
        password: "Superadmin123!",
        email_confirm: true, // ✅ Auto-confirm
        user_metadata: {
          nama_lengkap: "Super Administrator",
          role: "superadmin",
        },
      });

    if (authError) {
      console.error("❌ Auth error:", authError);
      throw authError;
    }

    const userId = authData.user.id;
    console.log("✅ Auth user created with ID:", userId);

    console.log("📝 Inserting to pengguna table...");

    // ✅ Masukkan ke tabel pengguna (TANPA password!)
    const { error: insertError } = await supabaseAdmin.from("pengguna").insert([
      {
        id: userId,
        nama_lengkap: "Super Administrator",
        role: "superadmin",
        alamat: "Kantor Pusat",
        jenis_kelamin: "laki-laki",
        tanggal_lahir: "1990-01-01",
      },
    ]);

    if (insertError) {
      console.error("❌ Insert error:", insertError);
      // Rollback: hapus dari auth jika insert gagal
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw insertError;
    }

    console.log("✅ Superadmin berhasil dibuat!");
    console.log("📧 Email: superadmin@gmail.com");
    console.log("🔑 Password: Superadmin123!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Gagal membuat superadmin:", error.message);
    process.exit(1);
  }
};

seedSuperAdmin();