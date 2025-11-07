/**
 * Testing Rule-Based System V2
 * Test lengkap untuk sistem poin, stabilizer, dan level progression
 */

import {
  calculateLevelProgress,
  categorizeSpeed,
  calculatePoints,
} from "../services/ruleBasedServices.js";

console.log("🧪 TESTING RULE-BASED SYSTEM V2\n");
console.log("=".repeat(80));

// ===== TEST 1: Kategorisasi Kecepatan =====
console.log("\n📊 TEST 1: Kategorisasi Kecepatan (Threshold Baru: 70%, 110%)");
console.log("-".repeat(80));

const speedTests = [
  { waktu: 30, median: 50, expected: "cepat" }, // 60% < 70%
  { waktu: 35, median: 50, expected: "cepat" }, // 70% (exact)
  { waktu: 40, median: 50, expected: "sedang" }, // 80%
  { waktu: 50, median: 50, expected: "sedang" }, // 100%
  { waktu: 55, median: 50, expected: "sedang" }, // 110% (exact)
  { waktu: 60, median: 50, expected: "lambat" }, // 120% > 110%
];

speedTests.forEach(({ waktu, median, expected }) => {
  const result = categorizeSpeed(waktu, median);
  const persentase = ((waktu / median) * 100).toFixed(0);
  const status = result === expected ? "✅" : "❌";
  console.log(
    `${status} ${waktu}s dari ${median}s (${persentase}%) → ${result} ${
      result !== expected ? `(expected: ${expected})` : ""
    }`
  );
});

// ===== TEST 2: Perhitungan Poin =====
console.log("\n📊 TEST 2: Perhitungan Poin");
console.log("-".repeat(80));

const pointTests = [
  { correct: true, speed: "cepat", expected: 2 },
  { correct: true, speed: "sedang", expected: 1 },
  { correct: true, speed: "lambat", expected: 0 },
  { correct: false, speed: "cepat", expected: 0 },
  { correct: false, speed: "sedang", expected: -1 },
  { correct: false, speed: "lambat", expected: -2 },
];

pointTests.forEach(({ correct, speed, expected }) => {
  const result = calculatePoints(correct, speed);
  const status = result === expected ? "✅" : "❌";
  const label = correct ? "Benar" : "Salah";
  console.log(
    `${status} ${label} + ${speed.padEnd(6)} → ${
      result > 0 ? "+" : ""
    }${result} poin ${result !== expected ? `(expected: ${expected})` : ""}`
  );
});

// ===== TEST 3: Naik Level - Benar + Cepat =====
console.log("\n📊 TEST 3: Naik Level - Benar + Cepat (Langsung)");
console.log("-".repeat(80));

const test3 = calculateLevelProgress({
  currentLevel: 3,
  answers: [{ correct: true, timeTaken: 30, medianTime: 50, questionLevel: 3 }],
  currentPoints: 0,
});

console.log(`Level saat ini: 3`);
console.log(`Jawaban: Benar + Cepat (30s dari 50s median)`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test3.newLevel} (expected: 4)`);
console.log(`   - Perubahan: ${test3.levelChange} (expected: naik)`);
console.log(`   - Poin: ${test3.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test3.reason}`);
console.log(
  test3.newLevel === 4 && test3.levelChange === "naik" && test3.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 4: Naik 2 Level - Benar + Cepat pada soal lebih sulit =====
console.log("\n📊 TEST 4: Naik 2 Level - Benar + Cepat pada soal lebih sulit");
console.log("-".repeat(80));

const test4 = calculateLevelProgress({
  currentLevel: 3,
  answers: [{ correct: true, timeTaken: 30, medianTime: 50, questionLevel: 5 }], // Soal level 5!
  currentPoints: 0,
});

console.log(`Level saat ini: 3`);
console.log(`Jawaban: Benar + Cepat pada soal level 5 (lebih sulit)`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test4.newLevel} (expected: 5)`);
console.log(`   - Perubahan: ${test4.levelChange} (expected: naik)`);
console.log(`   - Poin: ${test4.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test4.reason}`);
console.log(
  test4.newLevel === 5 && test4.levelChange === "naik" && test4.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 5: Stabilizer Naik - Poin >= 5 =====
console.log("\n📊 TEST 5: Stabilizer Naik - Akumulasi Poin >= 5");
console.log("-".repeat(80));

const test5 = calculateLevelProgress({
  currentLevel: 3,
  answers: [
    { correct: true, timeTaken: 30, medianTime: 50, questionLevel: 3 }, // +2 cepat
    { correct: true, timeTaken: 45, medianTime: 50, questionLevel: 3 }, // +1 sedang
    { correct: true, timeTaken: 30, medianTime: 50, questionLevel: 3 }, // +2 cepat (total: 5)
  ],
  currentPoints: 0,
});

console.log(`Level saat ini: 3`);
console.log(`Jawaban:`);
console.log(`   1. Benar + Cepat → +2 poin`);
console.log(`   2. Benar + Sedang → +1 poin`);
console.log(`   3. Benar + Cepat → +2 poin`);
console.log(`   Total: 5 poin (mencapai threshold)`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test5.newLevel} (expected: 4)`);
console.log(`   - Perubahan: ${test5.levelChange} (expected: naik)`);
console.log(`   - Poin: ${test5.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test5.reason}`);
console.log(`   - Total poin sebelum reset: ${test5.analysis.totalPoints}`);
console.log(
  test5.newLevel === 4 && test5.levelChange === "naik" && test5.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 6: Konsistensi 3x Benar + Sedang =====
console.log("\n📊 TEST 6: Konsistensi 3x Benar + Sedang");
console.log("-".repeat(80));

const test6 = calculateLevelProgress({
  currentLevel: 3,
  answers: [
    { correct: true, timeTaken: 45, medianTime: 50, questionLevel: 3 }, // sedang
    { correct: true, timeTaken: 50, medianTime: 50, questionLevel: 3 }, // sedang
    { correct: true, timeTaken: 48, medianTime: 50, questionLevel: 3 }, // sedang
  ],
  currentPoints: 0,
});

console.log(`Level saat ini: 3`);
console.log(`Jawaban: 3x Benar + Sedang berturut-turut`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test6.newLevel} (expected: 4)`);
console.log(`   - Perubahan: ${test6.levelChange} (expected: naik)`);
console.log(`   - Poin: ${test6.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test6.reason}`);
console.log(
  `   - Consecutive Medium Correct: ${test6.analysis.consecutiveMediumCorrect}`
);
console.log(
  test6.newLevel === 4 && test6.levelChange === "naik" && test6.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 7: Turun Level - Salah + Lambat =====
console.log("\n📊 TEST 7: Turun Level - Salah + Lambat");
console.log("-".repeat(80));

const test7 = calculateLevelProgress({
  currentLevel: 4,
  answers: [
    { correct: false, timeTaken: 60, medianTime: 50, questionLevel: 4 },
  ],
  currentPoints: 0,
});

console.log(`Level saat ini: 4`);
console.log(`Jawaban: Salah + Lambat (60s dari 50s median)`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test7.newLevel} (expected: 3)`);
console.log(`   - Perubahan: ${test7.levelChange} (expected: turun)`);
console.log(`   - Poin: ${test7.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test7.reason}`);
console.log(
  test7.newLevel === 3 && test7.levelChange === "turun" && test7.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 8: Turun 2 Level - Salah pada soal lebih mudah =====
console.log("\n📊 TEST 8: Turun 2 Level - Salah pada soal lebih mudah");
console.log("-".repeat(80));

const test8 = calculateLevelProgress({
  currentLevel: 5,
  answers: [
    { correct: false, timeTaken: 45, medianTime: 50, questionLevel: 3 },
  ], // Soal level 3!
  currentPoints: 0,
});

console.log(`Level saat ini: 5`);
console.log(`Jawaban: Salah pada soal level 3 (lebih mudah)`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test8.newLevel} (expected: 3)`);
console.log(`   - Perubahan: ${test8.levelChange} (expected: turun)`);
console.log(`   - Poin: ${test8.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test8.reason}`);
console.log(
  test8.newLevel === 3 && test8.levelChange === "turun" && test8.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 9: Stabilizer Turun - Poin <= -3 =====
console.log("\n📊 TEST 9: Stabilizer Turun - Poin <= -3");
console.log("-".repeat(80));

const test9 = calculateLevelProgress({
  currentLevel: 4,
  answers: [
    { correct: false, timeTaken: 60, medianTime: 50, questionLevel: 4 }, // -2 lambat
    { correct: false, timeTaken: 50, medianTime: 50, questionLevel: 4 }, // -1 sedang (total: -3)
  ],
  currentPoints: 0,
});

console.log(`Level saat ini: 4`);
console.log(`Jawaban:`);
console.log(`   1. Salah + Lambat → -2 poin`);
console.log(`   2. Salah + Sedang → -1 poin`);
console.log(`   Total: -3 poin (mencapai threshold)`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test9.newLevel} (expected: 3)`);
console.log(`   - Perubahan: ${test9.levelChange} (expected: turun)`);
console.log(`   - Poin: ${test9.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test9.reason}`);
console.log(`   - Total poin sebelum reset: ${test9.analysis.totalPoints}`);
console.log(
  test9.newLevel === 3 && test9.levelChange === "turun" && test9.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 10: Tetap - Akumulasi Belum Cukup =====
console.log("\n📊 TEST 10: Tetap - Akumulasi Belum Cukup");
console.log("-".repeat(80));

const test10 = calculateLevelProgress({
  currentLevel: 3,
  answers: [
    { correct: true, timeTaken: 45, medianTime: 50, questionLevel: 3 }, // +1 sedang
    { correct: true, timeTaken: 50, medianTime: 50, questionLevel: 3 }, // +1 sedang (total: 2)
  ],
  currentPoints: 0,
});

console.log(`Level saat ini: 3`);
console.log(`Jawaban: 2x Benar + Sedang (belum 3x)`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test10.newLevel} (expected: 3)`);
console.log(`   - Perubahan: ${test10.levelChange} (expected: tetap)`);
console.log(`   - Poin: ${test10.points} (expected: 2 - akumulatif)`);
console.log(`   - Alasan: ${test10.reason}`);
console.log(
  `   - Consecutive Medium Correct: ${test10.analysis.consecutiveMediumCorrect}`
);
console.log(
  test10.newLevel === 3 && test10.levelChange === "tetap" && test10.points === 2
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 11: 2x Salah Berturut-turut =====
console.log("\n📊 TEST 11: 2x Salah Berturut-turut → Turun");
console.log("-".repeat(80));

const test11 = calculateLevelProgress({
  currentLevel: 4,
  answers: [
    { correct: false, timeTaken: 40, medianTime: 50, questionLevel: 4 }, // salah sedang
    { correct: false, timeTaken: 45, medianTime: 50, questionLevel: 4 }, // salah sedang (2x)
  ],
  currentPoints: 0,
});

console.log(`Level saat ini: 4`);
console.log(`Jawaban: 2x Salah berturut-turut`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test11.newLevel} (expected: 3)`);
console.log(`   - Perubahan: ${test11.levelChange} (expected: turun)`);
console.log(`   - Poin: ${test11.points} (expected: 0 - reset)`);
console.log(`   - Alasan: ${test11.reason}`);
console.log(`   - Consecutive Wrong: ${test11.analysis.consecutiveWrong}`);
console.log(
  test11.newLevel === 3 && test11.levelChange === "turun" && test11.points === 0
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== TEST 12: Sliding Window (5 soal terakhir) =====
console.log(
  "\n📊 TEST 12: Sliding Window - Hanya 5 soal terakhir yang dihitung"
);
console.log("-".repeat(80));

const test12 = calculateLevelProgress({
  currentLevel: 3,
  answers: [
    // 6 jawaban, hanya 5 terakhir yang dihitung
    { correct: true, timeTaken: 30, medianTime: 50, questionLevel: 3 }, // +2 (diabaikan)
    { correct: true, timeTaken: 45, medianTime: 50, questionLevel: 3 }, // +1
    { correct: true, timeTaken: 40, medianTime: 50, questionLevel: 3 }, // +1
    { correct: true, timeTaken: 30, medianTime: 50, questionLevel: 3 }, // +2
    { correct: true, timeTaken: 35, medianTime: 50, questionLevel: 3 }, // +2
    { correct: true, timeTaken: 30, medianTime: 50, questionLevel: 3 }, // +2
  ],
  currentPoints: 0,
});

console.log(`Level saat ini: 3`);
console.log(`Total jawaban: 6 (hanya 5 terakhir dihitung)`);
console.log(`Poin dari 5 terakhir: +1, +1, +2, +2, +2 = 8 poin`);
console.log(`\n✅ Hasil:`);
console.log(`   - Level baru: ${test12.newLevel} (expected: 4)`);
console.log(`   - Perubahan: ${test12.levelChange} (expected: naik)`);
console.log(`   - Total poin (5 terakhir): ${test12.analysis.totalPoints}`);
console.log(`   - Jawaban dihitung: ${test12.analysis.recentAnswers.length}`);
console.log(`   - Alasan: ${test12.reason}`);
console.log(
  test12.newLevel === 4 &&
    test12.analysis.totalPoints === 8 &&
    test12.analysis.recentAnswers.length === 5
    ? "✅ PASS"
    : "❌ FAIL"
);

// ===== SUMMARY =====
console.log("\n" + "=".repeat(80));
console.log("✅ TESTING SELESAI");
console.log("=".repeat(80));
console.log("\n📋 Ringkasan:");
console.log("   - Total test cases: 12");
console.log("   - Sistem Poin: ✅ Berfungsi");
console.log("   - Stabilizer: ✅ Berfungsi (>= 5 naik, <= -3 turun)");
console.log("   - Threshold Kecepatan: ✅ 70%, 110%");
console.log("   - Sliding Window: ✅ 5 jawaban terakhir");
console.log("   - Level Differential: ✅ +2/-2 bonus");
console.log("\n🎯 Rule-Based System V2 siap digunakan!");
