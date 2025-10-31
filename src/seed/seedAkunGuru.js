import { supabase } from '../config/supabaseClient.js';
import bcrypt from 'bcrypt';

const seedGuru = async () => {
  try {
    // Daftarkan user guru ke sistem auth Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'guru@gmail.com',
      password: 'Guru123!',
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Masukkan ke tabel pengguna
    const { error: insertError } = await supabase.from('pengguna').insert([
      {
        id: userId,
        email: 'guru@gmail.com',
        password: await bcrypt.hash('Guru123!', 10),
        nama_lengkap: 'Guru',
        role: 'guru',
        creator_id: 'd5b8c182-5186-43de-be40-20e911951ab7',
        alamat: 'Kantor Pusat',
        nip: '1987654321',
        jenis_kelamin: 'laki-laki',
        tanggal_lahir: '1990-01-01',
        created_at: new Date(),
      },
    ]);

    if (insertError) throw insertError;

    console.log('✅ Guru berhasil dibuat!');
  } catch (error) {
    console.error('❌ Gagal membuat guru:', error.message);
  }
};

seedGuru();
