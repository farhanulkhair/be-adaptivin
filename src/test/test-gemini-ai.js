/**
 * Testing Google Gemini AI Integration
 * Test untuk memastikan integrasi Gemini AI bekerja dengan baik
 */

import { prepareDataForAI, callAIAPI } from "../services/aiService.js";

console.log("🧪 TESTING GEMINI AI INTEGRATION\n");
console.log("=".repeat(80));

// Mock data untuk testing
const mockHasilKuisData = {
  materiInfo: {
    judul: "Matematika Dasar - Aljabar",
    deskripsi:
      "Pemahaman konsep aljabar, persamaan linear, dan operasi matematika dasar",
  },
  kuisInfo: {
    judul: "Kuis Aljabar Minggu 1",
    total_soal: 10,
  },
  hasilStatistik: {
    total_benar: 7,
    total_salah: 3,
    total_waktu: 450,
    persentase: 70,
  },
  levelAnalisis: {
    level_benar: [
      "level1",
      "level1",
      "level2",
      "level2",
      "level3",
      "level3",
      "level4",
    ],
    level_salah: ["level5", "level5", "level6"],
  },
  waktuAnalisis: [
    { waktu_ditentukan: 60, waktu_dijawab: 45, cepat: true },
    { waktu_ditentukan: 60, waktu_dijawab: 50, cepat: true },
    { waktu_ditentukan: 60, waktu_dijawab: 40, cepat: true },
    { waktu_ditentukan: 60, waktu_dijawab: 55, cepat: true },
    { waktu_ditentukan: 60, waktu_dijawab: 48, cepat: true },
    { waktu_ditentukan: 60, waktu_dijawab: 42, cepat: true },
    { waktu_ditentukan: 60, waktu_dijawab: 52, cepat: true },
    { waktu_ditentukan: 60, waktu_dijawab: 65, cepat: false },
    { waktu_ditentukan: 60, waktu_dijawab: 70, cepat: false },
    { waktu_ditentukan: 60, waktu_dijawab: 63, cepat: false },
  ],
  detailSoal: [
    {
      soal_teks: "Berapakah hasil dari 2x + 5 = 15?",
      level_soal: "level1",
      jawaban_siswa: "x = 5",
      benar: true,
      waktu_dijawab: 45,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Selesaikan persamaan 3x - 7 = 8",
      level_soal: "level1",
      jawaban_siswa: "x = 5",
      benar: true,
      waktu_dijawab: 50,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Tentukan nilai x dari 4(x+2) = 20",
      level_soal: "level2",
      jawaban_siswa: "x = 3",
      benar: true,
      waktu_dijawab: 40,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Berapakah hasil dari 5x + 3 = 2x + 12?",
      level_soal: "level2",
      jawaban_siswa: "x = 3",
      benar: true,
      waktu_dijawab: 55,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Selesaikan sistem persamaan x + y = 10 dan x - y = 2",
      level_soal: "level3",
      jawaban_siswa: "x=6, y=4",
      benar: true,
      waktu_dijawab: 48,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Faktorkan x² + 5x + 6",
      level_soal: "level3",
      jawaban_siswa: "(x+2)(x+3)",
      benar: true,
      waktu_dijawab: 42,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Selesaikan persamaan kuadrat x² - 7x + 12 = 0",
      level_soal: "level4",
      jawaban_siswa: "x=3 atau x=4",
      benar: true,
      waktu_dijawab: 52,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Tentukan akar-akar dari 2x² + 5x - 3 = 0",
      level_soal: "level5",
      jawaban_siswa: "x=1 atau x=-1.5",
      benar: false,
      waktu_dijawab: 65,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Selesaikan sistem persamaan 3x + 2y = 12 dan 2x - y = 5",
      level_soal: "level5",
      jawaban_siswa: "x=2, y=2",
      benar: false,
      waktu_dijawab: 70,
      waktu_ditentukan: 60,
    },
    {
      soal_teks: "Faktorkan x³ - 8",
      level_soal: "level6",
      jawaban_siswa: "(x-2)(x²+2x+4)",
      benar: false,
      waktu_dijawab: 63,
      waktu_ditentukan: 60,
    },
  ],
};

console.log("\n📊 TEST 1: Mock Data Preparation");
console.log("-".repeat(80));
console.log(`✅ Materi: ${mockHasilKuisData.materiInfo.judul}`);
console.log(`✅ Total Soal: ${mockHasilKuisData.kuisInfo.total_soal}`);
console.log(
  `✅ Benar: ${mockHasilKuisData.hasilStatistik.total_benar} (${mockHasilKuisData.hasilStatistik.persentase}%)`
);
console.log(`✅ Salah: ${mockHasilKuisData.hasilStatistik.total_salah}`);
console.log(
  `✅ Level tertinggi benar: ${Math.max(
    ...mockHasilKuisData.levelAnalisis.level_benar.map((l) =>
      parseInt(l.replace("level", ""))
    )
  )}`
);
console.log(
  `✅ Level terendah salah: ${Math.min(
    ...mockHasilKuisData.levelAnalisis.level_salah.map((l) =>
      parseInt(l.replace("level", ""))
    )
  )}`
);

console.log("\n📊 TEST 2: Calling Gemini AI for Analysis");
console.log("-".repeat(80));
console.log("🤖 Sending data to Gemini AI...\n");

try {
  const startTime = Date.now();

  const aiAnalysis = await callAIAPI(mockHasilKuisData);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log("\n✅ AI ANALYSIS COMPLETED");
  console.log("-".repeat(80));
  console.log(`⏱️  Duration: ${duration}s\n`);

  console.log("📝 HASIL ANALISIS:");
  console.log("-".repeat(80));
  console.log(`\n🎯 Analisis Umum:`);
  console.log(aiAnalysis.analisis);

  console.log(`\n📊 Level Performance:`);
  console.log(`   - Level Tertinggi (Benar): ${aiAnalysis.level_tertinggi}`);
  console.log(`   - Level Terendah (Salah): ${aiAnalysis.level_terendah}`);

  console.log(`\n✨ Kelebihan:`);
  console.log(`   ${aiAnalysis.kelebihan}`);

  console.log(`\n⚠️  Kelemahan:`);
  console.log(`   ${aiAnalysis.kelemahan}`);

  console.log(`\n💡 Rekomendasi Belajar:`);
  console.log(`   ${aiAnalysis.rekomendasi_belajar}`);

  console.log(`\n🎥 Rekomendasi Video:`);
  const videos =
    typeof aiAnalysis.rekomendasi_video === "string"
      ? JSON.parse(aiAnalysis.rekomendasi_video)
      : aiAnalysis.rekomendasi_video;

  videos.forEach((video, index) => {
    console.log(`   ${index + 1}. ${video.judul}`);
    console.log(`      ${video.url}`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("✅ TESTING SELESAI - AI INTEGRATION BERHASIL!");
  console.log("=".repeat(80));

  console.log("\n📋 Validasi:");
  console.log(`   ${aiAnalysis.analisis ? "✅" : "❌"} Analisis ada`);
  console.log(
    `   ${
      aiAnalysis.level_tertinggi?.startsWith("level") ? "✅" : "❌"
    } Level tertinggi valid`
  );
  console.log(
    `   ${
      aiAnalysis.level_terendah?.startsWith("level") ? "✅" : "❌"
    } Level terendah valid`
  );
  console.log(`   ${aiAnalysis.kelebihan ? "✅" : "❌"} Kelebihan ada`);
  console.log(`   ${aiAnalysis.kelemahan ? "✅" : "❌"} Kelemahan ada`);
  console.log(
    `   ${aiAnalysis.rekomendasi_belajar ? "✅" : "❌"} Rekomendasi belajar ada`
  );
  console.log(
    `   ${videos.length > 0 ? "✅" : "❌"} Rekomendasi video ada (${
      videos.length
    } video)`
  );

  const allValid =
    aiAnalysis.analisis &&
    aiAnalysis.level_tertinggi?.startsWith("level") &&
    aiAnalysis.level_terendah?.startsWith("level") &&
    aiAnalysis.kelebihan &&
    aiAnalysis.kelemahan &&
    aiAnalysis.rekomendasi_belajar &&
    videos.length > 0;

  console.log(
    `\n${allValid ? "✅ ALL TESTS PASSED!" : "❌ SOME TESTS FAILED"}`
  );
} catch (error) {
  console.error("\n❌ ERROR:", error.message);
  console.error("\nStack trace:", error.stack);
  console.log("\n⚠️  AI Integration test failed. Check:");
  console.log("   1. API_AI_KEY di .env sudah benar");
  console.log("   2. Koneksi internet tersedia");
  console.log("   3. Google Gemini API quota tidak exceeded");
}

console.log("\n" + "=".repeat(80));
console.log("🎉 Test suite completed");
console.log("=".repeat(80));
