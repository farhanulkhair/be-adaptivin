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

/**
 * Memanggil Gemini AI untuk analisis strategi pembelajaran GURU
 * @param {Object} data - Data yang sudah disiapkan
 * @returns {Object} Hasil analisis strategi pembelajaran untuk guru
 */
async function callAIAPIForTeacher(data) {
  try {
    // 1. Cari video YouTube untuk guru tentang GAYA PEMBELAJARAN (bukan konten materi)
    console.log("🔍 Searching for teaching strategy videos...");

    // Fokus pada teaching strategies, bukan materi
    const teachingStrategyKeywords = [
      "scaffolding teaching strategy",
      "differentiated instruction techniques",
      "formative assessment strategies",
      "zone of proximal development teaching",
      "strategi pembelajaran berdiferensiasi",
      "teknik scaffolding mengajar"
    ];

    // Ambil video dari berbagai keyword
    const videoPromises = teachingStrategyKeywords.map(keyword =>
      searchEducationalVideos(keyword).catch(() => [])
    );

    const allVideos = await Promise.all(videoPromises);
    const mergedVideos = allVideos.flat().slice(0, 5); // Ambil max 5 video
    const formattedVideos = formatVideosForAnalysis(mergedVideos);

    console.log("✅ Found teaching strategy videos:", formattedVideos.length);

    // 2. Buat prompt khusus untuk analisis guru dengan tone profesional
    const prompt = `
Kamu adalah Mbah Adaptivin, konsultan pendidikan yang berpengalaman dan terpercaya untuk membantu guru SD kelas 4-5.
Gunakan bahasa yang PROFESIONAL namun ACCESSIBLE, EVIDENCE-BASED, dan ACTIONABLE.

ATURAN:
- Gunakan istilah pedagogi tapi jelaskan dengan sederhana
- Semua rekomendasi harus berdasarkan data konkret dari hasil kuis
- Berikan strategi yang bisa langsung diterapkan di kelas
- Rujuk teori pembelajaran (Vygotsky, Bloom, dll) jika relevan
- Fokus pada differensiasi dan personalisasi pembelajaran

📊 DATA HASIL KUIS SISWA:

Materi: ${data.materiInfo.judul}
Deskripsi: ${data.materiInfo.deskripsi}
Judul Kuis: ${data.kuisInfo.judul}
Total Soal: ${data.kuisInfo.total_soal}

STATISTIK HASIL:
- Jawaban Benar: ${data.hasilStatistik.total_benar} dari ${data.kuisInfo.total_soal} soal
- Persentase: ${data.hasilStatistik.persentase.toFixed(1)}%
- Total Waktu: ${data.hasilStatistik.total_waktu} detik
- Rata-rata per soal: ${(data.hasilStatistik.total_waktu / data.kuisInfo.total_soal).toFixed(1)} detik

ANALISIS LEVEL KESULITAN SOAL (1-6):
- Level 1: Paling mudah (soal dasar)
- Level 2: Mudah
- Level 3: Sedang
- Level 4: Cukup sulit
- Level 5: Sulit
- Level 6: Sangat sulit (paling tinggi)

- Level yang dikuasai: ${data.levelAnalisis.level_benar.join(", ")}
- Level yang belum dikuasai: ${data.levelAnalisis.level_salah.join(", ")}
- Distribusi kesalahan: ${data.levelAnalisis.level_salah.reduce((acc, level) => {
  acc[level] = (acc[level] || 0) + 1;
  return acc;
}, {})}

POLA WAKTU PENGERJAAN:
${data.waktuAnalisis
  .map(
    (w, i) =>
      `Soal ${i + 1}: ${w.waktu_dijawab}/${w.waktu_ditentukan} detik (${
        w.cepat ? "Cepat" : "Lambat"
      })`
  )
  .join("\n")}

DETAIL SETIAP SOAL:
${data.detailSoal
  .map(
    (s, i) =>
      `${i + 1}. Level ${s.level_soal} | ${s.benar ? "Benar" : "Salah"} | ${s.waktu_dijawab}/${s.waktu_ditentukan}s`
  )
  .join("\n")}

---

Berdasarkan data di atas, buatlah analisis strategi pembelajaran untuk GURU dalam format JSON yang LENGKAP dan DETAIL:

{
  "diagnosis_pembelajaran": "Analisis mendalam tentang kondisi pembelajaran siswa ini. Jelaskan apa yang terjadi dalam proses belajarnya berdasarkan data kuis (minimal 3-4 kalimat yang spesifik dan berdasarkan evidence dari data)",

  "pola_belajar_siswa": "Identifikasi pola belajar yang terlihat dari cara siswa mengerjakan kuis. Apakah siswa cenderung terburu-buru? Konsisten? Kesulitan di level tertentu? (minimal 3-4 kalimat dengan contoh konkret dari data)",

  "level_kemampuan_saat_ini": "levelX (tentukan berdasarkan level tertinggi yang dikuasai secara konsisten)",

  "zona_proximal_development": "Jelaskan ZPD siswa berdasarkan teori Vygotsky - apa yang bisa siswa capai dengan bantuan guru/scaffolding? Level mana yang bisa dicapai selanjutnya? (3-4 kalimat yang spesifik)",

  "rekomendasi_metode_mengajar": [
    {
      "nama": "Nama Metode 1",
      "penjelasan": "Penjelasan detail cara implementasi metode ini di kelas untuk materi ${data.materiInfo.judul}. Sesuaikan dengan level kemampuan siswa dan ZPD-nya (4-5 kalimat)"
    },
    {
      "nama": "Nama Metode 2",
      "penjelasan": "Penjelasan detail cara implementasi metode ini di kelas (4-5 kalimat)"
    },
    {
      "nama": "Nama Metode 3",
      "penjelasan": "Penjelasan detail cara implementasi metode ini di kelas (4-5 kalimat)"
    },
    {
      "nama": "Nama Metode 4",
      "penjelasan": "Penjelasan detail cara implementasi metode ini di kelas (4-5 kalimat)"
    },
    {
      "nama": "Nama Metode 5",
      "penjelasan": "Penjelasan detail cara implementasi metode ini di kelas (4-5 kalimat)"
    },
    {
      "nama": "Nama Metode 6",
      "penjelasan": "Penjelasan detail cara implementasi metode ini di kelas (4-5 kalimat)"
    }
  ],

CATATAN: rekomendasi_metode_mengajar HARUS berupa ARRAY of objects dengan field 'nama' dan 'penjelasan'. Pastikan metode disesuaikan dengan level kemampuan siswa (1-6) dan ZPD-nya.",

  "strategi_differensiasi": {
    "konten": "Jelaskan diferensiasi KONTEN untuk siswa ini - bagaimana menyesuaikan materi ${data.materiInfo.judul} sesuai level kemampuan siswa (4-5 kalimat dengan contoh konkret)",
    "proses": "Jelaskan diferensiasi PROSES - bagaimana cara siswa belajar dan mengolah informasi tentang ${data.materiInfo.judul} (4-5 kalimat dengan contoh scaffolding, strategi, dan pendekatan yang sesuai)",
    "produk": "Jelaskan diferensiasi PRODUK - bagaimana siswa dapat menunjukkan pemahaman mereka tentang ${data.materiInfo.judul} dengan cara yang berbeda (4-5 kalimat dengan contoh output/hasil karya yang bisa dibuat siswa)"
  },

CATATAN: strategi_differensiasi HARUS berupa OBJECT dengan 3 keys: 'konten', 'proses', dan 'produk'. Berikan penjelasan spesifik dan actionable untuk masing-masing aspek diferensiasi.",

  "aktivitas_pembelajaran": [
    {
      "nama": "Nama Aktivitas 1",
      "deskripsi": "Deskripsi detail cara melakukan aktivitas ini, step by step, disesuaikan dengan level siswa dan materi ${data.materiInfo.judul}",
      "durasi": "20 menit",
      "tujuan": "Tujuan pedagogis yang jelas dan terukur"
    },
    {
      "nama": "Nama Aktivitas 2",
      "deskripsi": "Deskripsi detail cara melakukan aktivitas ini, step by step",
      "durasi": "30 menit",
      "tujuan": "Tujuan pedagogis yang jelas dan terukur"
    },
    {
      "nama": "Nama Aktivitas 3",
      "deskripsi": "Deskripsi detail cara melakukan aktivitas ini, step by step",
      "durasi": "15 menit",
      "tujuan": "Tujuan pedagogis yang jelas dan terukur"
    }
  ],

  "tips_praktis": [
    "Tip 1: Penjelasan konkret yang spesifik untuk siswa ini dan materi ${data.materiInfo.judul}",
    "Tip 2: Penjelasan konkret yang bisa langsung diterapkan besok di kelas",
    "Tip 3: Penjelasan konkret dengan contoh praktis",
    "Tip 4: Penjelasan konkret yang actionable",
    "Tip 5: Penjelasan konkret yang relevan dengan level siswa",
    "Tip 6: Penjelasan konkret (opsional)",
    "Tip 7: Penjelasan konkret (opsional)"
  ],

CATATAN: tips_praktis HARUS berupa ARRAY of strings. Berikan 5-7 tips yang spesifik untuk siswa ini dan materinya, bukan tips umum.",

  "indikator_progress": [
    "Indikator 1: Penjelasan konkret cara mengukur kemajuan siswa dalam 2-4 minggu. Harus observable dan measurable",
    "Indikator 2: Penjelasan konkret cara mengukurnya dengan metrik yang jelas",
    "Indikator 3: Penjelasan konkret yang bisa diobservasi di kelas",
    "Indikator 4: Penjelasan konkret yang terukur dan spesifik",
    "Indikator 5: Penjelasan konkret (opsional)"
  ],

CATATAN: indikator_progress HARUS berupa ARRAY of strings. Berikan 4-5 indikator yang observable dan measurable.",

  "rekomendasi_video_guru": ${formattedVideos.length > 0 ? JSON.stringify(formattedVideos) : '[]'}
}

INSTRUKSI KHUSUS UNTUK VIDEO REKOMENDASI:
${formattedVideos.length > 0
  ? `Mbah sudah menyiapkan ${formattedVideos.length} video tentang GAYA PEMBELAJARAN (teaching strategies) untuk guru:

${formattedVideos.map((v, i) => `${i + 1}. "${v.judul}" - ${v.url}`).join('\n')}

PENTING:
- Video ini tentang METODE/STRATEGI MENGAJAR (scaffolding, differentiation, assessment, dll)
- BUKAN tentang konten materi ${data.materiInfo.judul}
- Pilih HANYA video yang RELEVAN dengan strategi yang kamu rekomendasikan
- Jika TIDAK ADA video yang cocok, KOSONGKAN array: "rekomendasi_video_guru": []
- Jangan paksa memasukkan video jika tidak relevan

Gunakan video-video di atas untuk field "rekomendasi_video_guru" di output JSON kamu, tapi HANYA yang relevan.`
  : `TIDAK ADA video teaching strategy yang ditemukan.
Set "rekomendasi_video_guru" menjadi array KOSONG: []
Jangan buat URL palsu atau video fiktif.`
}

PENTING:
- Semua analisis harus BERDASARKAN DATA konkret dari hasil kuis
- Jangan gunakan istilah yang terlalu teknis tanpa penjelasan
- Fokus pada ACTIONABLE strategies yang bisa langsung diterapkan
- Sesuaikan dengan konteks SD kelas 4-5 Indonesia
- Gunakan contoh konkret dari materi ${data.materiInfo.judul}
- Video rekomendasi: HANYA yang relevan dengan strategi pembelajaran, atau KOSONGKAN jika tidak ada
`.trim();

    console.log("🤖 Calling Gemini AI for teacher analysis...");

    // Call Gemini AI
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("📝 Gemini AI Teacher Analysis Response:", text.substring(0, 500) + "...");

    // Parse JSON response
    let teacherAnalysis;
    try {
      // Clean response dari markdown code blocks
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      teacherAnalysis = JSON.parse(cleanedText);

      // Ensure aktivitas_pembelajaran is array
      if (!Array.isArray(teacherAnalysis.aktivitas_pembelajaran)) {
        teacherAnalysis.aktivitas_pembelajaran = [];
      }

      // Ensure rekomendasi_video_guru is array
      if (!Array.isArray(teacherAnalysis.rekomendasi_video_guru)) {
        teacherAnalysis.rekomendasi_video_guru = formattedVideos;
      }

    } catch (parseError) {
      console.error("❌ Error parsing teacher analysis response:", parseError);
      console.log("Raw response:", text);

      // Fallback to mock data
      teacherAnalysis = generateMockTeacherAnalysis(data, formattedVideos);
    }

    console.log("✅ Teacher analysis completed successfully");
    return teacherAnalysis;

  } catch (error) {
    console.error("❌ Error calling Gemini AI for teacher:", error);

    // Fallback to mock data
    console.log("⚠️ Falling back to mock teacher analysis...");
    return generateMockTeacherAnalysis(data, []);
  }
}

/**
 * Generate mock teacher analysis sebagai fallback
 */
function generateMockTeacherAnalysis(data, videos) {
  const persentase = data.hasilStatistik.persentase;
  const levelTertinggi = data.levelAnalisis.level_benar.length > 0
    ? `level${Math.max(...data.levelAnalisis.level_benar.map(l => parseInt(l.replace("level", ""))))}`
    : "level1";

  return {
    diagnosis_pembelajaran: `Berdasarkan hasil kuis "${data.kuisInfo.judul}" tentang ${data.materiInfo.judul}, siswa menunjukkan pencapaian ${persentase.toFixed(1)}% dengan ${data.hasilStatistik.total_benar} jawaban benar dari ${data.kuisInfo.total_soal} soal. ${persentase >= 70 ? "Siswa menunjukkan pemahaman yang cukup baik pada materi dasar" : "Terdapat gap pemahaman yang perlu ditangani"}, terutama pada ${data.levelAnalisis.level_salah.length > 0 ? "level " + data.levelAnalisis.level_salah.join(", ") : "beberapa level"}.`,

    pola_belajar_siswa: `Siswa menunjukkan pola pengerjaan yang ${data.waktuAnalisis.filter(w => w.cepat).length > data.waktuAnalisis.length / 2 ? "cenderung terburu-buru" : "cukup hati-hati"}. Dari analisis waktu, terlihat siswa ${data.hasilStatistik.total_waktu < (data.waktuAnalisis.reduce((sum, w) => sum + w.waktu_ditentukan, 0) * 0.7) ? "menyelesaikan kuis lebih cepat dari waktu yang disediakan" : "menggunakan waktu dengan baik"}. Ini mengindikasikan ${persentase >= 70 ? "pemahaman yang cukup solid" : "perlu penguatan konsep dasar"}.`,

    level_kemampuan_saat_ini: levelTertinggi,

    zona_proximal_development: `Siswa saat ini berada di ${levelTertinggi} dan menunjukkan potensi untuk berkembang ke level berikutnya dengan scaffolding yang tepat. Dengan bimbingan guru dan latihan terstruktur, siswa dapat mencapai level yang lebih tinggi dalam 2-4 minggu. Fokus pada penguatan konsep yang belum dikuasai akan membantu siswa mencapai ZPD maksimal.`,

    rekomendasi_metode_mengajar: [
      {
        nama: "Scaffolding Bertahap",
        penjelasan: "Mulai dari konsep yang sudah dikuasai siswa (" + data.levelAnalisis.level_benar.join(", ") + "), kemudian secara bertahap tingkatkan kompleksitas. Gunakan analogi dan contoh konkret dari kehidupan sehari-hari untuk memudahkan pemahaman. Berikan bantuan (scaffolding) saat siswa menghadapi level yang lebih tinggi, lalu kurangi bantuan secara bertahap."
      },
      {
        nama: "Think-Aloud Strategy",
        penjelasan: "Saat mengajarkan konsep baru, verbalisasikan proses berpikir Anda. Ini membantu siswa memahami bagaimana cara menganalisis soal dan menemukan solusi. Modelkan cara berpikir kritis dan pemecahan masalah dengan suara keras agar siswa bisa meniru strategi berpikir yang efektif."
      },
      {
        nama: "Error Analysis",
        penjelasan: "Gunakan kesalahan siswa sebagai learning opportunity. Diskusikan kenapa jawaban tertentu salah dan apa konsep yang perlu diperbaiki. Ciptakan lingkungan yang aman dimana kesalahan dilihat sebagai bagian penting dari proses belajar, bukan kegagalan."
      },
      {
        nama: "Collaborative Learning",
        penjelasan: "Bentuk kelompok belajar heterogen dimana siswa yang sudah paham bisa membantu temannya. Ini memanfaatkan teori Vygotsky tentang Zone of Proximal Development. Dorong diskusi antar siswa untuk memperdalam pemahaman dan mengembangkan keterampilan komunikasi matematika."
      },
      {
        nama: "Formative Assessment",
        penjelasan: "Lakukan mini-assessment berkala (setiap 10-15 menit) untuk memastikan siswa mengikuti pembelajaran. Gunakan teknik quick check seperti thumbs up/down atau exit tickets. Gunakan hasil assessment untuk menyesuaikan pace dan metode pembelajaran secara real-time."
      }
    ],

    strategi_differensiasi: {
      konten: `Untuk siswa yang berada di ${levelTertinggi}, sediakan materi dengan tingkat kompleksitas yang sesuai. Mulai dengan konsep yang sudah dikuasai (${data.levelAnalisis.level_benar.join(", ")}), lalu secara bertahap tingkatkan ke level berikutnya. Berikan variasi soal dengan konteks yang berbeda-beda (kehidupan sehari-hari, permainan, situasi nyata) untuk memperkaya pemahaman. Sediakan enrichment berupa soal tantangan untuk topik yang sudah dikuasai, dan remedial berupa penjelasan ulang dengan pendekatan berbeda untuk konsep yang masih sulit.`,
      proses: `Diferensiasi proses dapat dilakukan dengan memberikan pilihan cara belajar yang sesuai dengan gaya belajar siswa - visual (diagram, model gambar, video), auditori (penjelasan verbal, diskusi), atau kinestetik (manipulatif, hands-on activities). Gunakan scaffolding bertahap: berikan bantuan penuh di awal, lalu kurangi secara bertahap saat siswa mulai paham. Sesuaikan pace pembelajaran dengan kecepatan siswa - tidak terburu-buru untuk siswa yang butuh waktu lebih, dan berikan pengayaan untuk siswa yang cepat menguasai. Kelompokkan siswa secara fleksibel berdasarkan kebutuhan, bukan kemampuan tetap.`,
      produk: `Berikan fleksibilitas dalam cara siswa menunjukkan pemahaman mereka. Siswa dapat memilih untuk mendemonstrasikan pemahaman melalui: (1) presentasi lisan di depan kelas, (2) membuat poster atau infografis visual, (3) menyelesaikan problem solving tertulis dengan penjelasan, (4) membuat video pembelajaran untuk teman, atau (5) mengajar konsep ke teman sekelas. Sesuaikan ekspektasi produk dengan level kemampuan - untuk siswa di ${levelTertinggi}, minta penjelasan yang lebih detail tentang proses berpikir mereka. Berikan rubrik yang jelas agar siswa tahu apa yang diharapkan.`
    },

    aktivitas_pembelajaran: [
      {
        nama: "Warm-up Review",
        deskripsi: "Mulai dengan review konsep yang sudah dikuasai siswa melalui game interaktif atau kuis singkat. Ini membangun confidence dan mengaktifkan prior knowledge sebelum memperkenalkan konsep baru.",
        durasi: "10 menit",
        tujuan: "Mengaktivasi pengetahuan sebelumnya dan membangun confidence"
      },
      {
        nama: "Guided Practice dengan Manipulatif",
        deskripsi: "Gunakan benda konkret atau visual aids untuk menjelaskan konsep abstrak. Bimbing siswa step-by-step dengan modeling yang jelas, kemudian biarkan siswa mencoba dengan bimbingan minimal.",
        durasi: "25 menit",
        tujuan: "Membangun pemahaman konseptual melalui pengalaman hands-on"
      },
      {
        nama: "Peer Teaching Session",
        deskripsi: "Pasangkan siswa untuk saling mengajarkan konsep yang baru dipelajari. Siswa yang sudah paham menjelaskan ke temannya, sementara guru berkeliling memberikan support.",
        durasi: "15 menit",
        tujuan: "Memperdalam pemahaman melalui teaching dan collaborative learning"
      }
    ],

    tips_praktis: [
      "Mulai setiap sesi dengan quick review 5 menit untuk mengecek retention dan mengaktifkan prior knowledge",
      "Gunakan visual aids dan manipulatif untuk konsep yang abstrak agar siswa bisa 'melihat' konsep matematika",
      "Berikan immediate feedback saat siswa berlatih - jangan tunggu sampai akhir untuk koreksi",
      "Sediakan lembar kerja dengan scaffolding bertahap (easy → medium → hard) sesuai level kemampuan siswa",
      "Catat progress siswa dalam checklist sederhana untuk tracking perkembangan dari waktu ke waktu",
      "Berikan praise yang spesifik untuk effort, bukan hanya hasil akhir (contoh: 'Bagus cara kamu menggunakan strategi itu!' bukan 'Pintar!')",
      "Variasikan metode setiap 10-15 menit untuk menjaga attention span siswa SD"
    ],

    indikator_progress: [
      "Peningkatan akurasi: Siswa mampu menjawab 80%+ soal di level saat ini dengan konsisten dalam 2-4 minggu ke depan",
      "Kecepatan meningkat: Waktu pengerjaan berkurang 20-30% sambil mempertahankan akurasi, menunjukkan penguasaan konsep yang lebih baik",
      "Self-correction: Siswa mulai bisa mengenali dan memperbaiki kesalahannya sendiri saat mengerjakan soal, menunjukkan kemampuan metakognitif yang berkembang",
      "Transfer knowledge: Siswa bisa menerapkan konsep ke konteks atau soal yang berbeda, tidak terpaku pada satu jenis soal saja",
      "Confidence: Siswa lebih berani bertanya dan mencoba level yang lebih tinggi, menunjukkan growth mindset yang positif"
    ],

    rekomendasi_video_guru: videos.length > 0 ? videos : []
  };
}

/**
 * Menyimpan hasil analisis guru ke database
 * @param {string} hasilKuisId - ID hasil kuis
 * @param {string} materiId - ID materi
 * @param {string} siswaId - ID siswa
 * @param {Object} teacherAnalysis - Data hasil analisis untuk guru
 * @returns {Object} Data analisis yang tersimpan
 */
async function saveTeacherAnalysisResult(
  hasilKuisId,
  materiId,
  siswaId,
  teacherAnalysis
) {
  try {
    // Convert arrays to JSON strings for JSONB fields
    const aktivitasJson = typeof teacherAnalysis.aktivitas_pembelajaran === 'string'
      ? teacherAnalysis.aktivitas_pembelajaran
      : JSON.stringify(teacherAnalysis.aktivitas_pembelajaran);

    const videoJson = typeof teacherAnalysis.rekomendasi_video_guru === 'string'
      ? teacherAnalysis.rekomendasi_video_guru
      : JSON.stringify(teacherAnalysis.rekomendasi_video_guru);

    const rekomendasiMetodeJson = typeof teacherAnalysis.rekomendasi_metode_mengajar === 'string'
      ? teacherAnalysis.rekomendasi_metode_mengajar
      : JSON.stringify(teacherAnalysis.rekomendasi_metode_mengajar);

    const tipsPraktisJson = typeof teacherAnalysis.tips_praktis === 'string'
      ? teacherAnalysis.tips_praktis
      : JSON.stringify(teacherAnalysis.tips_praktis);

    const indikatorProgressJson = typeof teacherAnalysis.indikator_progress === 'string'
      ? teacherAnalysis.indikator_progress
      : JSON.stringify(teacherAnalysis.indikator_progress);

    const strategiDifferensiasiJson = typeof teacherAnalysis.strategi_differensiasi === 'string'
      ? teacherAnalysis.strategi_differensiasi
      : JSON.stringify(teacherAnalysis.strategi_differensiasi);

    const { data, error } = await supabaseAdmin
      .from("analisis_ai_guru")
      .insert({
        hasil_kuis_id: hasilKuisId,
        materi_id: materiId,
        siswa_id: siswaId,
        diagnosis_pembelajaran: teacherAnalysis.diagnosis_pembelajaran,
        pola_belajar_siswa: teacherAnalysis.pola_belajar_siswa,
        level_kemampuan_saat_ini: teacherAnalysis.level_kemampuan_saat_ini,
        zona_proximal_development: teacherAnalysis.zona_proximal_development,
        rekomendasi_metode_mengajar: rekomendasiMetodeJson,
        strategi_differensiasi: strategiDifferensiasiJson,
        aktivitas_pembelajaran: aktivitasJson,
        tips_praktis: tipsPraktisJson,
        indikator_progress: indikatorProgressJson,
        rekomendasi_video_guru: videoJson,
      })
      .select()
      .single();

    if (error) throw error;

    console.log("✅ Teacher analysis saved to database");
    return data;
  } catch (error) {
    console.error("Error saving teacher analysis result:", error);
    throw error;
  }
}

export {
  prepareDataForAI,
  callAIAPI,
  saveAnalysisResult,
  callAIAPIForTeacher,
  saveTeacherAnalysisResult
};
