import { supabaseAdmin } from "../config/supabaseAdmin.js";

const seedTestGuru = async () => {
  try {
    console.log("🔄 Checking for existing test guru...");

    const testEmail = "guru@test.com";
    const testPassword = "Guru123!";

    // Cek apakah sudah ada guru dengan email ini
    const { data: existingAuth, error: checkAuthError } =
      await supabaseAdmin.auth.admin.listUsers();

    const existingUser = existingAuth?.users?.find(
      (u) => u.email === testEmail
    );

    if (existingUser) {
      console.log("⚠️ Test guru sudah ada.");
      console.log("📧 Email:", testEmail);
      console.log("🔑 Password:", testPassword);
      return;
    }

    console.log("📝 Creating test guru in Supabase Auth...");

    // ✅ Daftarkan user guru menggunakan admin.createUser
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true, // ✅ Auto-confirm
        user_metadata: {
          nama_lengkap: "Guru Test",
          role: "guru",
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
        nama_lengkap: "Guru Test",
        role: "guru",
        nip: "1234567890",
        jenis_kelamin: "laki-laki",
        alamat: "Jl. Test No. 123",
        tanggal_lahir: "1990-01-01",
      },
    ]);

    if (insertError) {
      console.error("❌ Insert error:", insertError);
      // Rollback: hapus dari auth jika insert gagal
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw insertError;
    }

    console.log("✅ Test guru berhasil dibuat!");
    console.log("📧 Email:", testEmail);
    console.log("🔑 Password:", testPassword);
    console.log("");
    console.log("ℹ️ Gunakan kredensial ini untuk login sebagai guru");
    process.exit(0);
  } catch (error) {
    console.error("❌ Gagal membuat test guru:", error.message);
    process.exit(1);
  }
};

seedTestGuru();
