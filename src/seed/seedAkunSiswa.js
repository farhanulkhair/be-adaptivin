import { supabase } from '../config/SupabaseClient.js';
import bcrypt from 'bcrypt';

const seedSiswa = async () => {
  try {
    // Daftarkan user siswa ke sistem auth Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'siswa@gmail.com',
      password: 'Siswa123!',
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Masukkan ke tabel pengguna
    const { error: insertError } = await supabase.from('pengguna').insert([
      {
        id: userId,
        email: 'siswa@gmail.com',
        password: await bcrypt.hash('Siswa123!', 10),
        nama_lengkap: 'Siswa',
        role: 'siswa',
        creator_id: 'd5b8c182-5186-43de-be40-20e911951ab7',
        alamat: 'Kantor Pusat',
        nisn: '1234567890',
        jenis_kelamin: 'laki-laki',
        tanggal_lahir: '1990-01-01',
        created_at: new Date(),
      },
    ]);

    if (insertError) throw insertError;

    console.log('✅ Siswa berhasil dibuat!');
  } catch (error) {
    console.error('❌ Gagal membuat siswa:', error.message);
  }
};

seedSiswa();
