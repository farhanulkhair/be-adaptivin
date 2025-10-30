import { supabase } from '../config/SupabaseClient.js';

export const getAllUsers = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let query = supabase.from('pengguna').select('*');

    if (role === 'admin') {
      query = query.in('role', ['guru', 'siswa']).eq('creator_id', userId);
    } else if (role !== 'superadmin') {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ message: 'Users retrieved successfully', users: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    let query = supabase.from('pengguna').select('*').eq('id', id);
    if (role === 'admin') query = query.eq('creator_id', userId);

    if (role !== 'superadmin' && role !== 'admin') {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    const { data, error } = await query.single();
    if (error) throw error;

    res.json({ message: 'User retrieved successfully', user: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;
    const { email, nama_lengkap, role: newRole, alamat, tanggal_lahir } = req.body;

    if (role !== 'superadmin' && role !== 'admin') {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    if (role === 'admin' && ['admin', 'superadmin'].includes(newRole)) {
      return res.status(403).json({ error: 'Admin tidak boleh ubah role ke admin/superadmin' });
    }

    let query = supabase
      .from('pengguna')
      .update({
        email,
        nama_lengkap,
        role: newRole,
        alamat,
        tanggal_lahir,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select();

    if (role === 'admin') query = query.eq('creator_id', userId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ message: 'User updated successfully', user: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    if (role !== 'superadmin' && role !== 'admin') {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    let query = supabase.from('pengguna').delete().eq('id', id).select();
    if (role === 'admin') query = query.eq('creator_id', userId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    res.json({ message: 'User deleted successfully', user: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
