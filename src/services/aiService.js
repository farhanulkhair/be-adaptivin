import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Service untuk komunikasi dengan Google Gemini AI
 * Menganalisis hasil kuis siswa dan memberikan rekomendasi pembelajaran
 */

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.API_AI_KEY);
// Gunakan model gemini-pro (stable) atau gemini-1.5-pro
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * Mengumpulkan data untuk analisis AI
 * @param {string} hasilKuisId - ID hasil kuis siswa
 * @returns {Object} Data yang siap dikirim ke AI
 */
async function prepareDataForAI(hasilKuisId) {
  try {
    // 1. Ambil data hasil kuis
    const { data: hasilKuis, error: hasilError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        *,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          id,
          judul,
          materi:materi!kuis_materi_id_fkey(
            id,
            judul_materi,
            deskripsi
          )
        ),
        siswa:pengguna!hasil_kuis_siswa_siswa_id_fkey(
          nama_lengkap
        )
      `
      )
      .eq("id", hasilKuisId)
      .single();

    if (hasilError) throw hasilError;
    if (!hasilKuis) throw new Error("Hasil kuis tidak ditemukan");

    // 2. Ambil semua detail jawaban siswa
    const { data: detailJawaban, error: detailError } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select(
        `
        *,
        soal:bank_soal!detail_jawaban_siswa_soal_id_fkey(
          soal_teks,
          level_soal,
          durasi_soal
        )
      `
      )
      .eq("hasil_kuis_id", hasilKuisId)
      .order("created_at", { ascending: true });

    if (detailError) throw detailError;

    // 3. Kategorisasi jawaban
    const jawabanBenar = detailJawaban.filter((j) => j.benar);
    const jawabanSalah = detailJawaban.filter((j) => !j.benar);

    // 4. Hitung statistik level
    const levelBenar = jawabanBenar.map((j) => j.level_soal);
    const levelSalah = jawabanSalah.map((j) => j.level_soal);

    // 5. Hitung waktu
    const waktuData = detailJawaban.map((j) => ({
      waktu_ditentukan: j.soal?.durasi_soal || 0,
      waktu_dijawab: j.waktu_dijawab,
      cepat: j.waktu_dijawab < (j.soal?.durasi_soal || 0),
    }));

    // 6. Susun data untuk AI
    return {
      materiInfo: {
        judul: hasilKuis.kuis?.materi?.judul_materi || "",
        deskripsi: hasilKuis.kuis?.materi?.deskripsi || "",
      },
      kuisInfo: {
        judul: hasilKuis.kuis?.judul || "",
        total_soal: detailJawaban.length,
      },
      hasilStatistik: {
        total_benar: hasilKuis.total_benar,
        total_salah: hasilKuis.total_salah,
        total_waktu: hasilKuis.total_waktu,
        persentase: (hasilKuis.total_benar / detailJawaban.length) * 100,
      },
      levelAnalisis: {
        level_benar: levelBenar,
        level_salah: levelSalah,
      },
      waktuAnalisis: waktuData,
      detailSoal: detailJawaban.map((j) => ({
        soal_teks: j.soal?.soal_teks || "",
        level_soal: j.level_soal,
        jawaban_siswa: j.jawaban_siswa,
        benar: j.benar,
        waktu_dijawab: j.waktu_dijawab,
        waktu_ditentukan: j.soal?.durasi_soal || 0,
      })),
    };
  } catch (error) {
    console.error("Error preparing data for AI:", error);
    throw error;
  }
}

/**
 * Memanggil Gemini AI untuk analisis hasil kuis
 * @param {Object} data - Data yang sudah disiapkan
 * @returns {Object} Hasil analisis dari Gemini AI
 */
async function callAIAPI(data) {
  try {
    // Buat prompt yang terstruktur untuk Gemini AI
    const prompt = `
Kamu adalah seorang guru ahli yang menganalisis hasil kuis siswa. Berikan analisis mendalam dan rekomendasi pembelajaran.

📊 DATA HASIL KUIS:

Materi: ${data.materiInfo.judul}
Deskripsi Materi: ${data.materiInfo.deskripsi}
Judul Kuis: ${data.kuisInfo.judul}
Total Soal: ${data.kuisInfo.total_soal}

STATISTIK:
- Total Benar: ${data.hasilStatistik.total_benar} soal
- Total Salah: ${data.hasilStatistik.total_salah} soal
- Persentase Benar: ${data.hasilStatistik.persentase.toFixed(1)}%
- Total Waktu: ${data.hasilStatistik.total_waktu} detik

ANALISIS LEVEL:
- Level soal yang berhasil dijawab benar: ${data.levelAnalisis.level_benar.join(
      ", "
    )}
- Level soal yang dijawab salah: ${data.levelAnalisis.level_salah.join(", ")}

ANALISIS WAKTU:
${data.waktuAnalisis
  .map(
    (w, i) =>
      `Soal ${i + 1}: ${w.waktu_dijawab}s dari ${w.waktu_ditentukan}s (${
        w.cepat ? "CEPAT" : "LAMBAT"
      })`
  )
  .join("\n")}

DETAIL JAWABAN:
${data.detailSoal
  .map(
    (s, i) =>
      `${i + 1}. Level: ${s.level_soal} | Status: ${
        s.benar ? "✅ BENAR" : "❌ SALAH"
      } | Waktu: ${s.waktu_dijawab}/${s.waktu_ditentukan}s`
  )
  .join("\n")}

---

Berdasarkan data di atas, berikan analisis dalam format JSON berikut (HANYA JSON, tanpa markdown atau text tambahan):

{
  "analisis": "Ringkasan analisis lengkap tentang pemahaman siswa terhadap materi (2-3 kalimat)",
  "level_tertinggi": "levelX (level tertinggi yang BERHASIL dijawab BENAR)",
  "level_terendah": "levelX (level terendah yang dijawab SALAH)",
  "kelebihan": "Daftar kelebihan siswa berdasarkan data (2-3 poin spesifik)",
  "kelemahan": "Daftar kelemahan siswa berdasarkan data (2-3 poin spesifik)",
  "rekomendasi_belajar": "Saran konkret untuk meningkatkan pemahaman (3-4 langkah spesifik)",
  "rekomendasi_video": [
    {"judul": "Judul video pembelajaran yang relevan 1", "url": "https://youtube.com/search?q=topik+materi+1"},
    {"judul": "Judul video pembelajaran yang relevan 2", "url": "https://youtube.com/search?q=topik+materi+2"},
    {"judul": "Judul video pembelajaran yang relevan 3", "url": "https://youtube.com/search?q=topik+materi+3"}
  ]
}

PENTING: 
- Berikan HANYA JSON yang valid, tanpa markdown code blocks atau text lainnya
- Pastikan level_tertinggi dan level_terendah sesuai dengan data (format: level1, level2, ..., level6)
- Rekomendasi video harus spesifik dan relevan dengan materi "${
      data.materiInfo.judul
    }"
- URL video gunakan format YouTube search dengan keyword yang relevan
`.trim();

    console.log("🤖 Calling Gemini AI for analysis...");

    // Call Gemini AI
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("📝 Gemini AI Response:", text);

    // Parse JSON response
    let analysisData;
    try {
      // Clean response jika ada markdown code blocks
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      analysisData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("❌ Error parsing AI response:", parseError);
      console.log("Raw response:", text);

      // Fallback: extract data dengan regex jika JSON parsing gagal
      analysisData = extractDataFromText(text, data);
    }

    // Validasi dan normalisasi data
    analysisData = normalizeAnalysisData(analysisData, data);

    console.log("✅ AI Analysis completed successfully");
    return analysisData;
  } catch (error) {
    console.error("❌ Error calling Gemini AI:", error);

    // Fallback ke mock data jika AI gagal
    console.log("⚠️ Falling back to mock analysis...");
    return generateMockAnalysis(data);
  }
}

/**
 * Extract data dari text response jika JSON parsing gagal
 */
function extractDataFromText(text, data) {
  // Implementasi fallback sederhana
  return {
    analisis: text.substring(0, 200) + "...",
    level_tertinggi:
      data.levelAnalisis.level_benar.length > 0
        ? `level${Math.max(
            ...data.levelAnalisis.level_benar.map((l) =>
              parseInt(l.replace("level", ""))
            )
          )}`
        : "level1",
    level_terendah:
      data.levelAnalisis.level_salah.length > 0
        ? `level${Math.min(
            ...data.levelAnalisis.level_salah.map((l) =>
              parseInt(l.replace("level", ""))
            )
          )}`
        : "level1",
    kelebihan: "Mampu menyelesaikan soal dengan baik.",
    kelemahan: "Perlu meningkatkan kecepatan dan akurasi.",
    rekomendasi_belajar:
      "Latihan soal secara teratur dan fokus pada konsep dasar.",
    rekomendasi_video: [],
  };
}

/**
 * Normalisasi dan validasi data analisis
 */
function normalizeAnalysisData(analysisData, originalData) {
  // Pastikan level_tertinggi valid
  if (
    !analysisData.level_tertinggi ||
    !analysisData.level_tertinggi.startsWith("level")
  ) {
    analysisData.level_tertinggi =
      originalData.levelAnalisis.level_benar.length > 0
        ? `level${Math.max(
            ...originalData.levelAnalisis.level_benar.map((l) =>
              parseInt(l.replace("level", ""))
            )
          )}`
        : "level1";
  }

  // Pastikan level_terendah valid
  if (
    !analysisData.level_terendah ||
    !analysisData.level_terendah.startsWith("level")
  ) {
    analysisData.level_terendah =
      originalData.levelAnalisis.level_salah.length > 0
        ? `level${Math.min(
            ...originalData.levelAnalisis.level_salah.map((l) =>
              parseInt(l.replace("level", ""))
            )
          )}`
        : "level1";
  }

  // Convert array ke string jika diperlukan (untuk backward compatibility)
  if (Array.isArray(analysisData.kelebihan)) {
    analysisData.kelebihan = analysisData.kelebihan.join(" ");
  }

  if (Array.isArray(analysisData.kelemahan)) {
    analysisData.kelemahan = analysisData.kelemahan.join(" ");
  }

  if (Array.isArray(analysisData.rekomendasi_belajar)) {
    analysisData.rekomendasi_belajar =
      analysisData.rekomendasi_belajar.join(" ");
  }

  // Pastikan rekomendasi_video adalah string JSON
  if (Array.isArray(analysisData.rekomendasi_video)) {
    analysisData.rekomendasi_video = JSON.stringify(
      analysisData.rekomendasi_video
    );
  }

  return analysisData;
}

/**
 * Generate mock analysis sebagai fallback
 */
function generateMockAnalysis(data) {
  const persentase = data.hasilStatistik.persentase;

  return {
    analisis: `Berdasarkan hasil kuis "${data.kuisInfo.judul}" pada materi "${
      data.materiInfo.judul
    }", siswa menunjukkan pemahaman yang ${
      persentase >= 80
        ? "sangat baik"
        : persentase >= 70
        ? "baik"
        : persentase >= 60
        ? "cukup"
        : "perlu ditingkatkan"
    }. Dari ${data.kuisInfo.total_soal} soal, siswa berhasil menjawab ${
      data.hasilStatistik.total_benar
    } soal dengan benar (${persentase.toFixed(1)}%).`,
    level_tertinggi:
      data.levelAnalisis.level_benar.length > 0
        ? `level${Math.max(
            ...data.levelAnalisis.level_benar.map((l) =>
              parseInt(l.replace("level", ""))
            )
          )}`
        : "level1",
    level_terendah:
      data.levelAnalisis.level_salah.length > 0
        ? `level${Math.min(
            ...data.levelAnalisis.level_salah.map((l) =>
              parseInt(l.replace("level", ""))
            )
          )}`
        : "level1",
    kelebihan:
      persentase >= 70
        ? "Mampu menjawab soal dengan cepat dan akurat pada level menengah. Menunjukkan pemahaman konsep dasar yang kuat."
        : "Menunjukkan usaha dalam menyelesaikan kuis.",
    kelemahan:
      persentase < 70
        ? "Perlu meningkatkan pemahaman pada konsep dasar. Kecepatan menjawab perlu ditingkatkan."
        : "Perlu lebih konsisten dalam menjawab soal level tinggi.",
    rekomendasi_belajar:
      persentase >= 70
        ? "Tingkatkan ke level soal yang lebih sulit. Latihan soal bertahap dari mudah ke sulit. Review kembali materi yang kurang dipahami."
        : "Fokus pada pemahaman konsep dasar dengan latihan soal bertahap. Perbanyak latihan soal dengan berbagai variasi. Diskusi dengan guru atau teman untuk materi yang sulit.",
    rekomendasi_video: JSON.stringify([
      {
        judul: `Tutorial ${data.materiInfo.judul} - Dasar`,
        url: `https://youtube.com/results?search_query=${encodeURIComponent(
          data.materiInfo.judul + " dasar"
        )}`,
      },
      {
        judul: `Pendalaman Materi ${data.materiInfo.judul}`,
        url: `https://youtube.com/results?search_query=${encodeURIComponent(
          data.materiInfo.judul + " lengkap"
        )}`,
      },
      {
        judul: `Latihan Soal ${data.materiInfo.judul}`,
        url: `https://youtube.com/results?search_query=${encodeURIComponent(
          data.materiInfo.judul + " latihan soal"
        )}`,
      },
    ]),
  };
}

/**
 * Menyimpan hasil analisis AI ke database
 * @param {string} hasilKuisId - ID hasil kuis
 * @param {string} materiId - ID materi
 * @param {string} siswaId - ID siswa
 * @param {Object} analisisData - Data hasil analisis AI
 * @returns {Object} Data analisis yang tersimpan
 */
async function saveAnalysisResult(
  hasilKuisId,
  materiId,
  siswaId,
  analisisData
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("analisis_ai")
      .insert({
        hasil_kuis_id: hasilKuisId,
        materi_id: materiId,
        siswa_id: siswaId,
        analisis: analisisData.analisis,
        level_tertinggi: analisisData.level_tertinggi,
        level_terendah: analisisData.level_terendah,
        kelebihan: analisisData.kelebihan,
        kelemahan: analisisData.kelemahan,
        rekomendasi_belajar: analisisData.rekomendasi_belajar,
        rekomendasi_video: analisisData.rekomendasi_video,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error saving analysis result:", error);
    throw error;
  }
}

export { prepareDataForAI, callAIAPI, saveAnalysisResult };
