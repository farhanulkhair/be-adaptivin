# 🎓 Fitur Analisis AI untuk Guru - Mbah Adaptivin

## 📋 Deskripsi

Fitur ini memberikan analisis mendalam hasil kuis siswa dan rekomendasi strategi pembelajaran untuk **GURU**. Berbeda dengan analisis untuk siswa yang berfokus pada motivasi dan pembelajaran personal, analisis untuk guru memberikan insight pedagogis, strategi differensiasi, dan metode mengajar yang efektif.

## 🎯 Tujuan

1. **Membantu guru memahami** pola belajar dan kesulitan siswa secara mendalam
2. **Memberikan strategi pembelajaran** yang spesifik dan actionable
3. **Menyediakan rekomendasi metode mengajar** yang sesuai dengan karakteristik siswa
4. **Memberikan aktivitas pembelajaran** yang bisa langsung diterapkan di kelas
5. **Merekomendasikan video pembelajaran** untuk meningkatkan kompetensi guru

## 🏗️ Arsitektur

### Database Schema

Tabel baru: `analisis_ai_guru`

```sql
CREATE TABLE analisis_ai_guru (
  id UUID PRIMARY KEY,
  hasil_kuis_id UUID REFERENCES hasil_kuis_siswa(id),
  materi_id UUID REFERENCES materi(id),
  siswa_id UUID REFERENCES pengguna(id),

  -- Diagnosis & Analisis
  diagnosis_pembelajaran TEXT,
  pola_belajar_siswa TEXT,
  level_kemampuan_saat_ini VARCHAR(50),
  zona_proximal_development TEXT,

  -- Rekomendasi Strategi
  rekomendasi_metode_mengajar TEXT,
  strategi_differensiasi TEXT,

  -- Aktivitas & Tips
  aktivitas_pembelajaran JSONB,
  tips_praktis TEXT,
  indikator_progress TEXT,

  -- Video Rekomendasi
  rekomendasi_video_guru JSONB,

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### API Endpoints

#### 1. **Create Teacher Analysis**

```
POST /api/analisis/guru/:hasilKuisId
```

**Request:**

```bash
curl -X POST http://localhost:5000/api/analisis/guru/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Analisis strategi pembelajaran untuk guru berhasil dibuat",
  "data": {
    "id": "...",
    "hasil_kuis_id": "...",
    "diagnosis_pembelajaran": "...",
    "pola_belajar_siswa": "...",
    "rekomendasi_metode_mengajar": "...",
    ...
  }
}
```

#### 2. **Get Teacher Analysis by Hasil Kuis**

```
GET /api/analisis/guru/:hasilKuisId
```

#### 3. **Get Teacher Analysis by Materi**

```
GET /api/analisis/guru/materi/:materiId
```

#### 4. **Get Teacher Analysis by Siswa**

```
GET /api/analisis/guru/siswa/:siswaId
```

#### 5. **Check Teacher Analysis Status**

```
GET /api/analisis/guru/check/:hasilKuisId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "hasil_kuis_id": "...",
    "is_analyzed": true,
    "analisis_id": "...",
    "is_completed": true
  }
}
```

#### 6. **Delete Teacher Analysis**

```
DELETE /api/analisis/guru/:id
```

## 🤖 AI Prompt Strategy

### Karakteristik Prompt untuk Guru

1. **Profesional namun Accessible**: Menggunakan istilah pedagogi tapi dijelaskan dengan sederhana
2. **Evidence-Based**: Berdasarkan data hasil kuis yang konkret
3. **Actionable**: Semua rekomendasi bisa langsung diterapkan
4. **Comprehensive**: Mencakup diagnosis, strategi, aktivitas, dan evaluasi
5. **Research-Informed**: Menggunakan teori pembelajaran (Vygotsky, Bloom, dll)

### Struktur Analisis AI

```json
{
  "diagnosis_pembelajaran": "Analisis mendalam kondisi pembelajaran siswa",
  "pola_belajar_siswa": "Identifikasi pola dan gaya belajar siswa",
  "level_kemampuan_saat_ini": "level3",
  "zona_proximal_development": "ZPD siswa (Vygotsky)",

  "rekomendasi_metode_mengajar": "5-6 metode dengan cara implementasi",
  "strategi_differensiasi": "Strategi diferensiasi spesifik",

  "aktivitas_pembelajaran": [
    {
      "nama": "Nama Aktivitas",
      "deskripsi": "Detail cara melakukan",
      "durasi": "20 menit",
      "tujuan": "Tujuan pedagogis"
    }
  ],

  "tips_praktis": "Tips yang bisa langsung diterapkan",
  "indikator_progress": "Indikator untuk tracking kemajuan",

  "rekomendasi_video_guru": [
    {
      "judul": "Judul Video",
      "url": "https://youtube.com/...",
      "fokus": "Metode mengajar / Strategi",
      "durasi": "15 menit",
      "bahasa": "Indonesia/English"
    }
  ]
}
```

## 📊 Data yang Dianalisis

Sistem mengumpulkan dan menganalisis:

1. **Hasil Kuis Siswa**:
   - Total benar/salah
   - Persentase nilai
   - Waktu pengerjaan
2. **Tingkat Kesulitan**:
   - Level yang dikuasai
   - Level yang belum dikuasai
   - Pola kesalahan per level
3. **Pola Waktu**:
   - Kecepatan per soal
   - Kecepatan vs target
   - Tren tempo pengerjaan
4. **Detail Jawaban**:
   - Soal yang benar/salah
   - Waktu per soal
   - Teks soal dan jawaban

## 🎥 Rekomendasi Video untuk Guru

AI akan merekomendasikan 3 jenis video:

### 1. Video Metode Mengajar

- Fokus: Teknik pedagogis untuk materi tertentu
- Contoh: "Scaffolding Strategies for Math"
- Target: Meningkatkan skill mengajar guru

### 2. Video Strategi Differensiasi

- Fokus: Cara mengajar siswa dengan kebutuhan berbeda
- Contoh: "Differentiated Instruction in Elementary"
- Target: Mengakomodasi diversity siswa

### 3. Video Assessment & Feedback

- Fokus: Teknik evaluasi dan pemberian feedback
- Contoh: "Formative Assessment Techniques"
- Target: Meningkatkan kualitas assessment

### Sumber Video

- YouTube Indonesia (misal: Pelatihan Guru Penggerak, Zenius untuk Guru)
- YouTube International (misal: Edutopia, Teaching Channel)
- Platform lain yang relevan

## 💡 Implementasi di Frontend

### Untuk Admin Dashboard

```typescript
// 1. Cek status analisis guru
const checkStatus = async (hasilKuisId: string) => {
  const response = await fetch(`/api/analisis/guru/check/${hasilKuisId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
};

// 2. Generate analisis guru
const generateAnalysis = async (hasilKuisId: string) => {
  const response = await fetch(`/api/analisis/guru/${hasilKuisId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
};

// 3. Get analisis guru
const getAnalysis = async (hasilKuisId: string) => {
  const response = await fetch(`/api/analisis/guru/${hasilKuisId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
};

// 4. Get semua analisis untuk siswa tertentu
const getAnalysisBySiswa = async (siswaId: string) => {
  const response = await fetch(`/api/analisis/guru/siswa/${siswaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
};
```

### Komponen UI Suggestion

#### 1. Button Generate Analisis Guru

```tsx
<Button
  onClick={handleGenerateTeacherAnalysis}
  disabled={!isCompleted || isAnalyzing}
>
  {isAnalyzing ? "Mbah sedang menganalisis..." : "Analisis untuk Guru"}
</Button>
```

#### 2. Teacher Analysis Dashboard

```tsx
<div className="teacher-analysis">
  {/* Diagnosis */}
  <Section title="Diagnosis Pembelajaran">
    <p>{analysis.diagnosis_pembelajaran}</p>
  </Section>

  {/* Pola Belajar */}
  <Section title="Pola Belajar Siswa">
    <p>{analysis.pola_belajar_siswa}</p>
  </Section>

  {/* Rekomendasi Metode */}
  <Section title="Rekomendasi Metode Mengajar">
    <Markdown>{analysis.rekomendasi_metode_mengajar}</Markdown>
  </Section>

  {/* Strategi Differensiasi */}
  <Section title="Strategi Differensiasi">
    <Markdown>{analysis.strategi_differensiasi}</Markdown>
  </Section>

  {/* Aktivitas Pembelajaran */}
  <Section title="Aktivitas Pembelajaran">
    {analysis.aktivitas_pembelajaran.map((aktivitas) => (
      <ActivityCard key={aktivitas.nama} aktivitas={aktivitas} />
    ))}
  </Section>

  {/* Tips Praktis */}
  <Section title="Tips Praktis">
    <Markdown>{analysis.tips_praktis}</Markdown>
  </Section>

  {/* Video Rekomendasi */}
  <Section title="Video Rekomendasi untuk Guru">
    <VideoGrid videos={analysis.rekomendasi_video_guru} />
  </Section>
</div>
```

## 🔄 Flow Penggunaan

### Flow 1: Generate Analisis Baru

```
1. Siswa selesai kuis
2. Guru/Admin melihat hasil kuis
3. Klik "Analisis untuk Guru"
4. System call API POST /api/analisis/guru/:hasilKuisId
5. Mbah Adaptivin (AI) menganalisis (15-30 detik)
6. Analisis tersimpan di database
7. Tampilkan hasil analisis lengkap
```

### Flow 2: Lihat Analisis yang Sudah Ada

```
1. Guru/Admin buka halaman hasil kuis
2. System check status: GET /api/analisis/guru/check/:hasilKuisId
3. Jika sudah ada analisis, tampilkan tombol "Lihat Analisis Guru"
4. Klik tombol
5. System fetch: GET /api/analisis/guru/:hasilKuisId
6. Tampilkan hasil analisis
```

### Flow 3: Lihat Semua Analisis Siswa

```
1. Guru buka profil siswa tertentu
2. System fetch: GET /api/analisis/guru/siswa/:siswaId
3. Tampilkan list semua analisis guru untuk siswa tersebut
4. Guru bisa lihat progress pembelajaran siswa dari waktu ke waktu
```

## 🎨 Design Considerations

### Colors & Icons

- **Diagnosis**: 🔍 Blue - Analytical
- **Strategi**: 💡 Yellow - Ideas
- **Aktivitas**: 🎯 Green - Action
- **Video**: 🎥 Red - Learning
- **Tips**: ⭐ Orange - Important

### Layout

- **Card-based**: Setiap section dalam card terpisah
- **Collapsible**: Section bisa di-expand/collapse
- **Printable**: Guru bisa print untuk dokumentasi
- **Shareable**: Bisa dibagikan ke guru lain

## 📈 Metrics & Analytics

Track penggunaan fitur:

- Jumlah analisis guru yang di-generate
- Materi yang paling sering dianalisis
- Average time dari kuis selesai ke generate analisis
- Guru yang paling aktif menggunakan fitur ini

## 🚀 Migration & Deployment

### 1. Run Migration SQL

```bash
# Connect ke Supabase
psql -h your-db-host -U postgres -d your-database

# Run migration
\i migrations/add_analisis_ai_guru_table.sql
```

### 2. Verify Table

```sql
SELECT * FROM analisis_ai_guru LIMIT 1;
```

### 3. Test Endpoints

```bash
# Test generate analisis
curl -X POST http://localhost:5000/api/analisis/guru/HASIL_KUIS_ID \
  -H "Authorization: Bearer TOKEN"

# Test get analisis
curl http://localhost:5000/api/analisis/guru/HASIL_KUIS_ID \
  -H "Authorization: Bearer TOKEN"
```

## 🔐 Security & Permissions

### Authorization Rules

1. **Generate Analisis**: Hanya Guru dan Admin
2. **View Analisis**:
   - Guru: Hanya untuk siswa di kelasnya
   - Admin: Semua analisis
3. **Delete Analisis**: Hanya Admin

### Supabase RLS (Row Level Security)

```sql
-- Policy untuk guru: hanya bisa akses siswa di kelasnya
CREATE POLICY "Guru can view own students analysis"
  ON analisis_ai_guru
  FOR SELECT
  TO authenticated
  USING (
    siswa_id IN (
      SELECT siswa_id FROM kelas_siswa
      WHERE kelas_id IN (
        SELECT id FROM kelas WHERE guru_id = auth.uid()
      )
    )
  );

-- Policy untuk admin: bisa akses semua
CREATE POLICY "Admin can view all analysis"
  ON analisis_ai_guru
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pengguna
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## 📚 Best Practices

### 1. Caching

- Cache analisis yang sudah di-generate
- Tidak perlu re-generate jika data kuis tidak berubah

### 2. Error Handling

- Fallback ke mock data jika AI gagal
- Retry mechanism dengan exponential backoff
- User-friendly error messages

### 3. Performance

- Generate analisis secara async
- Show loading state yang informatif
- Optimize database queries dengan proper indexes

### 4. UX

- Clear CTA (Call-to-Action) buttons
- Progressive disclosure (jangan overwhelm guru dengan semua info sekaligus)
- Actionable insights (fokus pada "what to do next")

## 🐛 Troubleshooting

### Issue: JSON Parse Error

**Cause**: AI response mengandung actual newline characters
**Fix**: Sudah ditambahkan sanitization di `aiService.js`

### Issue: Video URL tidak valid

**Cause**: AI generate URL palsu
**Fix**: Validasi URL di frontend, fallback ke search YouTube

### Issue: Analisis terlalu generik

**Cause**: Prompt kurang spesifik
**Fix**: Selalu sertakan data konkret dalam prompt

## 🎓 Example Output

### Diagnosis Pembelajaran

```
Berdasarkan hasil kuis "Pecahan Sederhana" tentang Matematika, siswa Budi
menunjukkan pencapaian 65% dengan 13 jawaban benar dari 20 soal. Terdapat
gap pemahaman terutama pada level 3 dan level 4. Pola kesalahan menunjukkan
siswa memerlukan penguatan pada konsep pembilang dan penyebut, serta operasi
penjumlahan pecahan.
```

### Rekomendasi Metode Mengajar

```
1. Scaffolding Bertahap: Mulai dari pecahan sederhana (1/2, 1/4), gunakan
   benda konkret seperti potongan buah atau pizza, baru naikkan ke soal
   yang lebih kompleks.

2. Think-Aloud Strategy: Saat mengerjakan contoh soal di depan kelas,
   verbalisasikan proses berpikir Anda. "Pertama saya lihat penyebutnya..."

3. Error Analysis: Diskusikan kesalahan umum seperti menambahkan pembilang
   dan penyebut langsung. Jelaskan mengapa cara tersebut salah.
```

## 📞 Support

Jika ada pertanyaan atau issue:

1. Check dokumentasi ini terlebih dahulu
2. Lihat logs di console untuk error details
3. Contact backend team untuk masalah API
4. Contact AI team untuk masalah prompt/analisis

---

**Created**: November 2025  
**Version**: 1.0.0  
**Author**: Backend Team - Adaptivin  
**AI Model**: Google Gemini 2.5 Pro
