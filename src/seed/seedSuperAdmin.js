import { supabase } from '../config/SupabaseClient.js';
import bcrypt from 'bcrypt';

const seedSuperAdmin = async () => {
  try {
    // Cek apakah sudah ada superadmin
    const { data: existingSuperAdmin, error: checkError } = await supabase
      .from('pengguna')
      .select('*')
      .eq('role', 'superadmin')
      .limit(1);

    if (checkError) throw checkError;

    if (existingSuperAdmin.length > 0) {
      console.log('⚠️ Superadmin sudah ada, tidak perlu seed lagi.');
      return;
    }

    // Daftarkan user superadmin ke sistem auth Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'superadmin@gmail.com',
      password: 'Superadmin123!',
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Masukkan ke tabel pengguna
    const { error: insertError } = await supabase.from('pengguna').insert([
      {
        id: userId,
        email: 'superadmin@gmail.com',
        password: await bcrypt.hash('Superadmin123!', 10),
        nama_lengkap: 'Super Administrator',
        role: 'superadmin',
        creator_id: null,
        alamat: 'Kantor Pusat',
        jenis_kelamin: 'laki-laki',
        tanggal_lahir: '1990-01-01',
        created_at: new Date(),
      },
    ]);

    if (insertError) throw insertError;

    console.log('✅ Superadmin berhasil dibuat!');
  } catch (error) {
    console.error('❌ Gagal membuat superadmin:', error.message);
  }
};

seedSuperAdmin();
