import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchEducationalVideos, formatVideosForAnalysis } from "./youtubeService.js";

/**
 * Service untuk komunikasi dengan Google Gemini AI
 * Menganalisis hasil kuis siswa dan memberikan rekomendasi pembelajaran
 */

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.API_AI_KEY);
// Gunakan gemini-2.0-flash-thinking-exp untuk reasoning & detail yang lebih baik
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-thinking-exp-01-21", // Model dengan thinking capability untuk analisis mendalam
  generationConfig: {
    temperature: 0.7, // Konsisten untuk rekomendasi yang reliable
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192, // Besar untuk rekomendasi detail
    responseMimeType: "application/json", // FORCE JSON output tanpa markdown
  },
  systemInstruction: "Kamu adalah Mbah Adaptivin, mentor pembelajaran yang ramah, profesional, dan terpercaya untuk siswa SD kelas 4-5. Berikan analisis mendalam dan rekomendasi belajar yang SANGAT DETAIL, terstruktur, dan actionable. Gunakan bahasa yang hangat namun profesional. Output HARUS pure JSON."
});

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
    // 1. Cari video YouTube yang relevan dengan materi
    console.log("🔍 Searching for educational videos...");
    const youtubeVideos = await searchEducationalVideos(data.materiInfo.judul);
    const formattedVideos = formatVideosForAnalysis(youtubeVideos);

    console.log("✅ Found videos:", formattedVideos);

    // 2. Buat prompt yang terstruktur untuk Gemini AI dengan karakter Mbah Adaptivin
    const prompt = `
Kamu adalah Mbah Adaptivin, mentor belajar yang ramah dan profesional untuk anak SD kelas 4-5.
Gunakan bahasa yang SANTAI tapi TERPERCAYA, POSITIF, dan MUDAH DIPAHAMI.

ATURAN:
- Pakai kata sapaan: "kamu", "wah", "hebat", "bagus"
- Hindari kata formal berlebihan: "siswa", "mengindikasikan", "signifikan"
- Pakai emoji secukupnya (2-3x per bagian)
- Bahasa ramah tapi tetap jelas dan detail
- Rekomendasi belajar harus SPESIFIK dan ACTIONABLE

📊 INI DATA YANG MBAH LIHAT DI BOLA KRISTAL:

Materi yang Dipelajari: ${data.materiInfo.judul}
Tentang Apa Sih: ${data.materiInfo.deskripsi}
Judul Kuisnya: ${data.kuisInfo.judul}
Jumlah Soal: ${data.kuisInfo.total_soal} soal

HASIL KUISNYA:
- Jawaban Benar: ${data.hasilStatistik.total_benar} soal 🎯
- Jawaban Salah: ${data.hasilStatistik.total_salah} soal
- Nilai: ${data.hasilStatistik.persentase.toFixed(1)}%
- Total Waktu: ${data.hasilStatistik.total_waktu} detik ⏱️

LEVEL KESULITAN SOAL:
- Level yang berhasil dijawab benar: ${data.levelAnalisis.level_benar.join(
      ", "
    )}
- Level yang masih salah: ${data.levelAnalisis.level_salah.join(", ")}

KECEPATAN MENJAWAB:
${data.waktuAnalisis
  .map(
    (w, i) =>
      `Soal ${i + 1}: ${w.waktu_dijawab} detik dari ${w.waktu_ditentukan} detik (${
        w.cepat ? "⚡ CEPAT BANGET!" : "🐢 Santai dulu ya"
      })`
  )
  .join("\n")}

DETAIL TIAP SOAL:
${data.detailSoal
  .map(
    (s, i) =>
      `${i + 1}. Level: ${s.level_soal} | ${
        s.benar ? "✅ BETUL!" : "❌ Belum tepat"
      } | Waktu: ${s.waktu_dijawab}/${s.waktu_ditentukan} detik`
  )
  .join("\n")}

---

Buat analisis dengan format JSON. Gunakan bahasa yang ramah, profesional, dan mudah dipahami:

CONTOH YANG BAIK:
{
  "analisis": "Hai! Mbah Adaptivin sudah menganalisis hasil kuis ${data.materiInfo.judul} kamu nih. Dari ${data.kuisInfo.total_soal} soal, kamu berhasil menjawab ${data.hasilStatistik.total_benar} soal dengan benar (${data.hasilStatistik.persentase.toFixed(1)}%). Ini pencapaian yang bagus! Mari kita lihat lebih detail ya 📊",
  "level_tertinggi": "level4",
  "level_terendah": "level4",
  "kelebihan": "Kamu punya kekuatan di beberapa area nih: (1) Pemahaman dasar ${data.materiInfo.judul} sudah cukup kuat, terbukti dari keberhasilanmu di soal-soal level menengah. (2) Kecepatan mengerjakanmu bagus, menunjukkan kamu cukup familiar dengan materinya. (3) Konsistensi menjawab benar di level tertentu menandakan pemahaman yang solid 🌟",
  "kelemahan": "Ada beberapa area yang bisa kamu tingkatkan: (1) Soal-soal dengan tingkat kesulitan lebih tinggi masih jadi tantangan. Ini normal kok, karena butuh latihan lebih. (2) Kadang terlihat kamu menjawab terburu-buru, sehingga ada soal yang sebenarnya bisa dijawab malah keliru. Pelan-pelan saja ya, ketelitian itu penting 😊",
  "rekomendasi_belajar": "Mbah sudah menyiapkan rencana belajar lengkap untukmu! Ikuti langkah-langkah ini ya:\n\n📚 TAHAP 1: PERKUAT FONDASI (Minggu 1-2)\n• Ulangi konsep dasar ${data.materiInfo.judul} yang sudah kamu kuasai dengan cara yang berbeda\n• Buat ringkasan atau mind map sendiri tentang materi ini - menulisnya akan membantu kamu mengingat lebih baik\n• Latihan rutin 15-20 menit setiap hari (lebih efektif dari belajar 2 jam sekali!)\n• Coba jelaskan materi ini ke teman/keluarga - kalau kamu bisa mengajarkan, berarti kamu sudah paham\n\n🎯 TAHAP 2: TINGKATKAN KEMAMPUAN (Minggu 3-4)\n• Mulai coba soal-soal yang levelnya lebih tinggi secara bertahap\n• Teknik membaca soal: Baca 2-3 kali, garis bawahi kata kunci, pahami apa yang ditanya sebelum jawab\n• Kalau salah, JANGAN langsung lanjut! Analisis: Kenapa salah? Bagian mana yang kurang paham? Lalu perbaiki\n• Catat jenis soal yang sering salah, fokus latihan di area itu\n\n💪 TAHAP 3: LATIHAN INTENSIF (Minggu 5-6)\n• Kerjakan soal campuran (mudah-sedang-sulit) untuk bangun stamina mental\n• Set target: misalnya \"hari ini aku mau benar minimal 8 dari 10 soal\"\n• Latihan dengan timer - ini melatih kecepatan sekaligus akurasi\n• Review error: Setiap akhir minggu, lihat lagi soal-soal yang salah dan coba ulang\n\n📖 STRATEGI BELAJAR EFEKTIF:\n• Pomodoro Technique: Belajar fokus 25 menit, istirahat 5 menit, ulangi 4x, lalu istirahat panjang 15-30 menit\n• Belajar di waktu yang sama setiap hari membantu otak membentuk kebiasaan\n• Gunakan berbagai sumber: buku, video (lihat rekomendasi Mbah di bawah), dan latihan online\n\n🤝 JANGAN LUPA:\n• Tanya guru/teman kalau ada yang membingungkan - tidak ada pertanyaan yang bodoh!\n• Bergabung dengan kelompok belajar bisa membuat belajar lebih menyenangkan\n• Istirahat cukup, makan bergizi, dan olahraga ringan - otak butuh tubuh yang sehat untuk belajar optimal\n\n✨ MINDSET JUARA:\n• Setiap kesalahan adalah kesempatan belajar, bukan kegagalan\n• Bandingkan dirimu hari ini dengan dirimu kemarin, bukan dengan orang lain\n• Percaya diri! Kamu pasti bisa menguasai ${data.materiInfo.judul} dengan latihan yang konsisten",
  "rekomendasi_video": [
    {"judul": "Video Pembelajaran 1 tentang ${data.materiInfo.judul}", "url": "https://www.youtube.com/watch?v=VIDEO_ID_1"},
    {"judul": "Video Pembelajaran 2 tentang ${data.materiInfo.judul}", "url": "https://www.youtube.com/watch?v=VIDEO_ID_2"},
    {"judul": "Video Pembelajaran 3 tentang ${data.materiInfo.judul}", "url": "https://www.youtube.com/watch?v=VIDEO_ID_3"}
  ]
}

REKOMENDASI VIDEO YOUTUBE:
Mbah sudah menyiapkan ${formattedVideos.length} video pembelajaran terbaik untuk kamu:

${formattedVideos.map((v, i) => `${i + 1}. "${v.judul}" - ${v.url}`).join("\n")}

INSTRUKSI: Gunakan video-video di atas untuk field "rekomendasi_video" di output JSON kamu.
Format output harus PERSIS seperti ini:
"rekomendasi_video": ${JSON.stringify(formattedVideos)}

JANGAN ubah URL atau judul video! Gunakan persis seperti yang Mbah berikan di atas.
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
      // Clean response jika ada markdown code blocks dan control characters
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Sanitize: Parse sebagai JSON object, lalu stringify ulang untuk fix control characters
      // Ini akan otomatis escape newline dan special characters
      const tempParsed = JSON.parse(cleanedText);

      // Fix rekomendasi_belajar yang mungkin punya newline tidak valid
      if (tempParsed.rekomendasi_belajar) {
        tempParsed.rekomendasi_belajar = tempParsed.rekomendasi_belajar
          .replace(/\r\n/g, '\\n')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\n');
      }

      analysisData = tempParsed;
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
  // Implementasi fallback sederhana dengan gaya Mbah Adaptivin
  return {
    analisis: "Wah, Mbah lihat hasil kuis kamu nih! " + text.substring(0, 150) + "...",
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
    kelebihan: "Mbah lihat kamu udah berusaha dengan baik! 👍 Semangat terus ya!",
    kelemahan: "Ada beberapa hal yang bisa kamu perbaiki nih, tapi tenang Mbah akan bantu! 😊",
    rekomendasi_belajar:
      "Ayo latihan lagi biar makin jago! Mbah yakin kamu pasti bisa! 💪",
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
 * Generate mock analysis sebagai fallback dengan gaya Mbah Adaptivin
 */
function generateMockAnalysis(data) {
  const persentase = data.hasilStatistik.persentase;

  // Pilih video YouTube yang relevan berdasarkan materi (contoh untuk matematika SD)
  // Dalam production, sebaiknya punya database mapping materi -> video
  const videoRecommendations = [
    {
      judul: "Cara Seru Belajar Matematika - Pasti Paham!",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Ganti dengan video ID asli
    },
    {
      judul: "Rahasia Jago Matematika dalam 10 Menit!",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Ganti dengan video ID asli
    },
    {
      judul: "Trik Cepat Matematika yang Bikin Kamu Hebat!",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Ganti dengan video ID asli
    },
  ];

  return {
    analisis:
      persentase >= 80
        ? `Wah keren banget! 🌟 Mbah lihat kamu bisa jawab ${data.hasilStatistik.total_benar} dari ${data.kuisInfo.total_soal} soal dengan benar! Nilai kamu ${persentase.toFixed(1)}% itu luar biasa! Mbah bangga sama kamu! 🎉`
        : persentase >= 70
        ? `Bagus nih! 👍 Kamu berhasil jawab ${data.hasilStatistik.total_benar} dari ${data.kuisInfo.total_soal} soal dengan benar! Dapat ${persentase.toFixed(1)}% tuh keren! Tinggal latihan dikit lagi pasti makin jago!`
        : persentase >= 60
        ? `Oke nih, lumayan! 😊 Dari ${data.kuisInfo.total_soal} soal, kamu bisa jawab benar ${data.hasilStatistik.total_benar} soal (${persentase.toFixed(1)}%). Ayo semangat latihan lagi biar makin jago!`
        : `Tidak apa-apa, yang penting kamu sudah berani coba! 💪 Dari ${data.kuisInfo.total_soal} soal, kamu dapat ${data.hasilStatistik.total_benar} benar. Mbah tau kamu pasti bisa lebih baik lagi kalau sering latihan!`,
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
        ? "Mbah lihat kamu jago banget jawab soalnya cepat dan tepat! 🚀 Kamu juga pinter banget di soal-soal yang agak susah. Keren deh! 👏"
        : "Mbah suka semangat kamu yang pantang menyerah! 💪 Kamu juga udah berani coba semua soalnya. Bagus banget!",
    kelemahan:
      persentase < 70
        ? "Ada beberapa soal yang kayaknya perlu kamu pelajari lagi deh 📚 Tapi tenang aja, semua orang juga gitu kok di awal. Nanti pasti bisa! 😊"
        : "Kadang kamu masih buru-buru jawab nih, coba santai dikit biar lebih teliti ya! 🤔 Pasti nilainya bisa perfect!",
    rekomendasi_belajar:
      persentase >= 70
        ? "Oke, Mbah punya tips jitu nih! 1) Coba latihan soal yang lebih susah biar makin jago 🎯 2) Jangan lupa istirahat ya, otak juga butuh rehat 😴 3) Ajak teman belajar bareng biar makin seru! 4) Tetep semangat dan percaya sama diri kamu! 💪"
        : "Dengar baik-baik ya! 1) Ulang lagi materinya pelan-pelan, jangan terburu-buru 📖 2) Latihan soal yang gampang dulu sampai lancar 🎮 3) Kalau ada yang bingung, langsung tanya guru atau teman ya 🙋 4) Jangan lupa istirahat biar otak fresh! Main sebentar juga boleh kok 😊",
    rekomendasi_video: JSON.stringify(videoRecommendations),
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
