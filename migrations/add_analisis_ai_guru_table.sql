-- Migration: Tambah tabel analisis_ai_guru untuk menyimpan analisis strategi pembelajaran untuk guru
-- Dibuat: 2025-11-10
-- Deskripsi: Tabel ini menyimpan hasil analisis AI yang memberikan rekomendasi strategi pembelajaran untuk guru

-- Buat tabel analisis_ai_guru
CREATE TABLE IF NOT EXISTS analisis_ai_guru (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hasil_kuis_id UUID NOT NULL REFERENCES hasil_kuis_siswa(id) ON DELETE CASCADE,
  materi_id UUID NOT NULL REFERENCES materi(id) ON DELETE CASCADE,
  siswa_id UUID NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  
  -- Diagnosis dan analisis
  diagnosis_pembelajaran TEXT NOT NULL,
  pola_belajar_siswa TEXT NOT NULL,
  level_kemampuan_saat_ini VARCHAR(50) NOT NULL,
  zona_proximal_development TEXT NOT NULL,
  
  -- Rekomendasi strategi
  rekomendasi_metode_mengajar TEXT NOT NULL,
  strategi_differensiasi TEXT NOT NULL,
  
  -- Aktivitas dan tips
  aktivitas_pembelajaran JSONB NOT NULL, -- Array of objects: {nama, deskripsi, durasi, tujuan}
  tips_praktis TEXT NOT NULL,
  indikator_progress TEXT NOT NULL,
  
  -- Rekomendasi video untuk guru
  rekomendasi_video_guru JSONB NOT NULL, -- Array of objects: {judul, url, fokus, durasi, bahasa}
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buat index untuk performa query
CREATE INDEX IF NOT EXISTS idx_analisis_ai_guru_hasil_kuis_id ON analisis_ai_guru(hasil_kuis_id);
CREATE INDEX IF NOT EXISTS idx_analisis_ai_guru_materi_id ON analisis_ai_guru(materi_id);
CREATE INDEX IF NOT EXISTS idx_analisis_ai_guru_siswa_id ON analisis_ai_guru(siswa_id);
CREATE INDEX IF NOT EXISTS idx_analisis_ai_guru_created_at ON analisis_ai_guru(created_at DESC);

-- Buat unique constraint untuk mencegah duplikasi analisis untuk hasil kuis yang sama
ALTER TABLE analisis_ai_guru 
ADD CONSTRAINT unique_analisis_guru_per_hasil_kuis 
UNIQUE (hasil_kuis_id);

-- Tambahkan trigger untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_analisis_ai_guru_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analisis_ai_guru_updated_at
  BEFORE UPDATE ON analisis_ai_guru
  FOR EACH ROW
  EXECUTE FUNCTION update_analisis_ai_guru_updated_at();

-- Tambahkan comment pada tabel dan kolom
COMMENT ON TABLE analisis_ai_guru IS 'Tabel untuk menyimpan hasil analisis AI yang memberikan strategi pembelajaran untuk guru';
COMMENT ON COLUMN analisis_ai_guru.diagnosis_pembelajaran IS 'Diagnosis kondisi pembelajaran siswa berdasarkan hasil kuis';
COMMENT ON COLUMN analisis_ai_guru.pola_belajar_siswa IS 'Pola belajar yang teridentifikasi dari siswa';
COMMENT ON COLUMN analisis_ai_guru.level_kemampuan_saat_ini IS 'Level kemampuan siswa saat ini (level1, level2, dst)';
COMMENT ON COLUMN analisis_ai_guru.zona_proximal_development IS 'Zona perkembangan proksimal siswa (ZPD - Vygotsky)';
COMMENT ON COLUMN analisis_ai_guru.rekomendasi_metode_mengajar IS 'Rekomendasi metode mengajar yang sesuai untuk siswa';
COMMENT ON COLUMN analisis_ai_guru.strategi_differensiasi IS 'Strategi diferensiasi pembelajaran untuk siswa';
COMMENT ON COLUMN analisis_ai_guru.aktivitas_pembelajaran IS 'Array aktivitas pembelajaran yang disarankan dalam format JSON';
COMMENT ON COLUMN analisis_ai_guru.tips_praktis IS 'Tips praktis yang bisa langsung diterapkan guru';
COMMENT ON COLUMN analisis_ai_guru.indikator_progress IS 'Indikator untuk mengukur progress siswa';
COMMENT ON COLUMN analisis_ai_guru.rekomendasi_video_guru IS 'Array rekomendasi video pembelajaran untuk guru dalam format JSON';

-- Berikan akses ke tabel (sesuaikan dengan role yang ada)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON analisis_ai_guru TO authenticated;
-- GRANT USAGE ON SEQUENCE analisis_ai_guru_id_seq TO authenticated;
