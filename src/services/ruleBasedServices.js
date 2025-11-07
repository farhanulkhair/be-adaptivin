/**
 * Service untuk logika rule-based adaptif dengan sistem poin
 * Menentukan level soal berikutnya berdasarkan jawaban siswa
 *
 * SISTEM POIN AKUMULATIF:
 * - Benar + Cepat   = +2 poin
 * - Benar + Sedang  = +1 poin
 * - Benar + Lambat  = 0 poin
 * - Salah + Cepat   = 0 poin
 * - Salah + Sedang  = -1 poin
 * - Salah + Lambat  = -2 poin
 *
 * STABILIZER:
 * - Naik level jika poin >= 5
 * - Turun level jika poin <= -3
 * - Reset poin ke 0 setiap kali level berubah
 *
 * ATURAN KECEPATAN (berdasarkan median waktu):
 * - Cepat  : < 70% dari median waktu
 * - Sedang : 70-110% dari median waktu
 * - Lambat : > 110% dari median waktu
 */

import { supabaseAdmin } from "../config/supabaseAdmin.js";

/**
 * Menentukan kategori kecepatan jawaban (berdasarkan median)
 * @param {number} waktuDijawab - Waktu yang digunakan (detik)
 * @param {number} waktuMedian - Median waktu soal (detik)
 * @returns {string} 'cepat' | 'sedang' | 'lambat'
 */
function categorizeSpeed(waktuDijawab, waktuMedian) {
  const persentase = (waktuDijawab / waktuMedian) * 100;

  if (persentase < 70) {
    return "cepat"; // < 70% dari median
  } else if (persentase <= 110) {
    return "sedang"; // 70-110% dari median
  } else {
    return "lambat"; // > 110% dari median
  }
}

/**
 * Menghitung poin berdasarkan hasil dan kecepatan
 * @param {boolean} isCorrect - Apakah jawaban benar
 * @param {string} speed - Kecepatan jawaban
 * @returns {number} Poin yang didapat
 */
function calculatePoints(isCorrect, speed) {
  if (isCorrect) {
    if (speed === "cepat") return 2;
    if (speed === "sedang") return 1;
    return 0; // lambat
  } else {
    if (speed === "cepat") return 0; // salah cepat tidak dikurangi
    if (speed === "sedang") return -1;
    return -2; // lambat
  }
}

/**
 * Fungsi utama untuk menghitung progress level siswa
 * @param {Object} inputData - Data input siswa
 * @param {number} inputData.currentLevel - Level saat ini (1-6)
 * @param {Array} inputData.answers - Array jawaban terakhir
 * @param {number} inputData.currentPoints - Poin akumulatif saat ini (optional)
 * @returns {Object} Hasil perhitungan level baru
 */
function calculateLevelProgress(inputData) {
  const { currentLevel, answers, currentPoints = 0 } = inputData;

  // Validasi input
  if (!answers || answers.length === 0) {
    return {
      newLevel: currentLevel,
      levelChange: "tetap",
      reason: "Tidak ada data jawaban",
      points: currentPoints,
    };
  }

  // Gunakan sliding window 5 soal terakhir
  const recentAnswers = answers.slice(-5);

  // Hitung total poin dari jawaban terakhir
  let totalPoints = currentPoints;
  const analysisDetails = [];

  recentAnswers.forEach((answer, index) => {
    const speed = categorizeSpeed(answer.timeTaken, answer.medianTime);
    const points = calculatePoints(answer.correct, speed);
    totalPoints += points;

    analysisDetails.push({
      index: index + 1,
      correct: answer.correct,
      speed,
      points,
      questionLevel: answer.questionLevel,
      timeTaken: answer.timeTaken,
      medianTime: answer.medianTime,
    });
  });

  // Analisis jawaban terakhir untuk aturan khusus
  const lastAnswer = recentAnswers[recentAnswers.length - 1];
  const lastSpeed = categorizeSpeed(
    lastAnswer.timeTaken,
    lastAnswer.medianTime
  );

  // Cek konsistensi
  const consecutiveCorrect = countConsecutivePattern(recentAnswers, true);
  const consecutiveWrong = countConsecutivePattern(recentAnswers, false);

  // Cek pola kecepatan
  const consecutiveFastCorrect = countConsecutiveSpeedPattern(
    recentAnswers,
    true,
    "cepat"
  );
  const consecutiveMediumCorrect = countConsecutiveSpeedPattern(
    recentAnswers,
    true,
    "sedang"
  );
  const consecutiveSlowCorrect = countConsecutiveSpeedPattern(
    recentAnswers,
    true,
    "lambat"
  );

  let newLevel = currentLevel;
  let levelChange = "tetap";
  let reason = "";
  let pointsAfterChange = totalPoints;

  // === ATURAN NAIK LEVEL ===

  // 1. NAIK 2 LEVEL: Benar + Cepat pada soal lebih sulit
  if (
    lastAnswer.correct &&
    lastSpeed === "cepat" &&
    lastAnswer.questionLevel > currentLevel &&
    currentLevel < 5
  ) {
    newLevel = Math.min(currentLevel + 2, 6);
    levelChange = "naik";
    reason = `Benar + Cepat pada soal level ${lastAnswer.questionLevel} (lebih sulit) → Naik 2 level`;
    pointsAfterChange = 0; // Reset poin
  }

  // 2. NAIK 1 LEVEL: Benar + Cepat (langsung)
  else if (lastAnswer.correct && lastSpeed === "cepat") {
    newLevel = Math.min(currentLevel + 1, 6);
    levelChange = "naik";
    reason = "Benar + Cepat → Naik 1 level";
    pointsAfterChange = 0;
  }

  // 3. NAIK 1 LEVEL: 3x Benar + Sedang berturut-turut
  else if (consecutiveMediumCorrect >= 3) {
    newLevel = Math.min(currentLevel + 1, 6);
    levelChange = "naik";
    reason = `3x Benar + Sedang berturut-turut → Naik 1 level`;
    pointsAfterChange = 0;
  }

  // 4. NAIK 1 LEVEL: 3x Benar + Lambat berturut-turut (konsistensi)
  else if (consecutiveSlowCorrect >= 3) {
    newLevel = Math.min(currentLevel + 1, 6);
    levelChange = "naik";
    reason = `3x Benar + Lambat berturut-turut (konsistensi) → Naik 1 level`;
    pointsAfterChange = 0;
  }

  // 5. NAIK 1 LEVEL: Poin >= 5 (STABILIZER)
  else if (totalPoints >= 5) {
    newLevel = Math.min(currentLevel + 1, 6);
    levelChange = "naik";
    reason = `Poin akumulatif mencapai ${totalPoints} (>= 5) → Naik 1 level`;
    pointsAfterChange = 0;
  }

  // === ATURAN TURUN LEVEL ===

  // 1. TURUN 2 LEVEL: Salah pada soal lebih mudah
  else if (
    !lastAnswer.correct &&
    lastAnswer.questionLevel < currentLevel &&
    currentLevel > 2
  ) {
    newLevel = Math.max(currentLevel - 2, 1);
    levelChange = "turun";
    reason = `Salah pada soal level ${lastAnswer.questionLevel} (lebih mudah) → Turun 2 level`;
    pointsAfterChange = 0;
  }

  // 2. TURUN 1 LEVEL: Salah + Lambat
  else if (!lastAnswer.correct && lastSpeed === "lambat") {
    newLevel = Math.max(currentLevel - 1, 1);
    levelChange = "turun";
    reason = "Salah + Lambat → Turun 1 level";
    pointsAfterChange = 0;
  }

  // 3. TURUN 1 LEVEL: 2x Salah berturut-turut
  else if (consecutiveWrong >= 2) {
    newLevel = Math.max(currentLevel - 1, 1);
    levelChange = "turun";
    reason = `${consecutiveWrong}x Salah berturut-turut → Turun 1 level`;
    pointsAfterChange = 0;
  }

  // 4. TURUN 1 LEVEL: Poin <= -3 (STABILIZER)
  else if (totalPoints <= -3) {
    newLevel = Math.max(currentLevel - 1, 1);
    levelChange = "turun";
    reason = `Poin akumulatif ${totalPoints} (<= -3) → Turun 1 level`;
    pointsAfterChange = 0;
  }

  // === TETAP ===
  else {
    reason = buildStayReason(
      lastAnswer.correct,
      lastSpeed,
      totalPoints,
      consecutiveCorrect,
      consecutiveMediumCorrect,
      consecutiveSlowCorrect
    );
    pointsAfterChange = totalPoints; // Poin tetap akumulatif
  }

  return {
    newLevel,
    levelChange,
    reason,
    points: pointsAfterChange,
    analysis: {
      totalPoints,
      consecutiveCorrect,
      consecutiveWrong,
      consecutiveFastCorrect,
      consecutiveMediumCorrect,
      consecutiveSlowCorrect,
      recentAnswers: analysisDetails,
    },
  };
}

/**
 * Hitung pola berturut-turut (benar/salah)
 * @param {Array} answers - Array jawaban
 * @param {boolean} targetCorrect - Target benar/salah
 * @returns {number} Jumlah berturut-turut
 */
function countConsecutivePattern(answers, targetCorrect) {
  let count = 0;
  for (let i = answers.length - 1; i >= 0; i--) {
    if (answers[i].correct === targetCorrect) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Hitung pola berturut-turut dengan kecepatan spesifik
 * @param {Array} answers - Array jawaban
 * @param {boolean} targetCorrect - Target benar/salah
 * @param {string} targetSpeed - Target kecepatan
 * @returns {number} Jumlah berturut-turut
 */
function countConsecutiveSpeedPattern(answers, targetCorrect, targetSpeed) {
  let count = 0;
  for (let i = answers.length - 1; i >= 0; i--) {
    const speed = categorizeSpeed(answers[i].timeTaken, answers[i].medianTime);
    if (answers[i].correct === targetCorrect && speed === targetSpeed) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Buat alasan untuk tetap di level
 * @param {boolean} correct - Benar/salah
 * @param {string} speed - Kecepatan
 * @param {number} points - Poin saat ini
 * @param {number} consecutive - Berturut-turut
 * @param {number} mediumStreak - Streak sedang
 * @param {number} slowStreak - Streak lambat
 * @returns {string} Alasan
 */
function buildStayReason(
  correct,
  speed,
  points,
  consecutive,
  mediumStreak,
  slowStreak
) {
  if (correct && speed === "lambat") {
    return `Benar + Lambat (${slowStreak}/3 konsistensi) → Tetap (Poin: ${points})`;
  } else if (correct && speed === "sedang") {
    return `Benar + Sedang (${mediumStreak}/3 akumulasi) → Tetap (Poin: ${points})`;
  } else if (!correct && speed === "cepat") {
    return `Salah + Cepat → Tetap (Poin: ${points})`;
  } else if (!correct) {
    return `Salah pertama kali → Tetap (Poin: ${points})`;
  }
  return `Performa campuran → Tetap (Poin: ${points})`;
}

/**
 * Mendapatkan level soal awal
 * @returns {string} Level soal awal (level3)
 */
function getInitialLevel() {
  return "level3"; // Soal pertama selalu level 3
}

/**
 * Menentukan apakah siswa menjawab cepat atau lambat
 * @param {number} waktuDijawab - Waktu yang digunakan (detik)
 * @param {number} waktuDitentukan - Waktu yang ditentukan (detik)
 * @returns {boolean} true jika cepat, false jika lambat
 */
function isFastAnswer(waktuDijawab, waktuDitentukan) {
  return waktuDijawab < waktuDitentukan;
}

/**
 * Wrapper untuk compatibility dengan controller lama
 * Menggunakan durasi_soal sebagai median time
 * @param {string} currentLevel - Level soal saat ini
 * @param {boolean} isCorrect - Apakah jawaban benar
 * @param {number} waktuDijawab - Waktu yang digunakan siswa (detik)
 * @param {number} waktuDitentukan - Waktu yang ditentukan untuk soal (detik)
 * @param {Array} recentHistory - Array history jawaban terakhir
 * @returns {Object} { nextLevel, reasoning, speed }
 */
function determineNextLevel(
  currentLevel,
  isCorrect,
  waktuDijawab,
  waktuDitentukan,
  recentHistory = []
) {
  const levelNumber = parseInt(currentLevel.replace("level", ""));
  const speed = categorizeSpeed(waktuDijawab, waktuDitentukan);

  let nextLevel = levelNumber;
  let reasoning = "";

  // CASE 1: JAWABAN BENAR
  if (isCorrect) {
    // 1.1: BENAR + CEPAT = NAIK 1 LEVEL
    if (speed === "cepat") {
      nextLevel = Math.min(levelNumber + 1, 6);
      reasoning = "Benar + Cepat → Naik 1 level";
    }

    // 1.2: BENAR + SEDANG = Cek akumulasi 3 soal benar berturut-turut
    else if (speed === "sedang") {
      const consecutiveCorrect = countConsecutiveCorrect(
        recentHistory,
        "sedang"
      );

      if (consecutiveCorrect >= 2) {
        nextLevel = Math.min(levelNumber + 1, 6);
        reasoning = "Benar + Sedang (3x berturut-turut) → Naik 1 level";
      } else {
        nextLevel = levelNumber;
        reasoning = `Benar + Sedang (${consecutiveCorrect + 1}/3) → Tetap`;
      }
    }

    // 1.3: BENAR + LAMBAT = Cek konsistensi 3 kali benar berturut-turut
    else if (speed === "lambat") {
      const consecutiveCorrect = countConsecutiveCorrect(
        recentHistory,
        "lambat"
      );

      if (consecutiveCorrect >= 2) {
        nextLevel = Math.min(levelNumber + 1, 6);
        reasoning = "Benar + Lambat (3x berturut-turut) → Naik 1 level";
      } else {
        nextLevel = levelNumber;
        reasoning = `Benar + Lambat (${consecutiveCorrect + 1}/3) → Tetap`;
      }
    }
  }

  // CASE 2: JAWABAN SALAH
  else {
    // 2.1: SALAH + LAMBAT = TURUN 1 LEVEL
    if (speed === "lambat") {
      nextLevel = Math.max(levelNumber - 1, 1);
      reasoning = "Salah + Lambat → Turun 1 level";
    }

    // 2.2: SALAH (apapun kecepatannya) = Cek 2 kali salah berturut-turut di level yang sama
    else {
      const consecutiveWrong = countConsecutiveWrongAtSameLevel(
        recentHistory,
        currentLevel
      );

      if (consecutiveWrong >= 1) {
        nextLevel = Math.max(levelNumber - 1, 1);
        reasoning = `Salah 2x berturut-turut di ${currentLevel} → Turun 1 level`;
      } else {
        nextLevel = levelNumber;
        reasoning = `Salah pertama di ${currentLevel} → Tetap`;
      }
    }
  }

  return {
    nextLevel: `level${nextLevel}`,
    shouldUpdateHistory: true,
    reasoning,
    speed,
  };
}

/**
 * Menghitung jumlah jawaban benar berturut-turut dengan kecepatan tertentu
 * @param {Array} history - Array history jawaban
 * @param {string} targetSpeed - 'cepat' | 'sedang' | 'lambat'
 * @returns {number} Jumlah jawaban benar berturut-turut
 */
function countConsecutiveCorrect(history, targetSpeed) {
  let count = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];

    if (item.isCorrect && item.speed === targetSpeed) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Menghitung jumlah jawaban salah berturut-turut di level yang sama
 * @param {Array} history - Array history jawaban
 * @param {string} targetLevel - Level yang dicek (e.g., 'level3')
 * @returns {number} Jumlah jawaban salah berturut-turut
 */
function countConsecutiveWrongAtSameLevel(history, targetLevel) {
  let count = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];

    if (!item.isCorrect && item.level === targetLevel) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Membuat entry history untuk jawaban
 * @param {string} level - Level soal (e.g., 'level3')
 * @param {boolean} isCorrect - Apakah jawaban benar
 * @param {string} speed - Kecepatan jawaban ('cepat' | 'sedang' | 'lambat')
 * @returns {Object} History entry
 */
function createHistoryEntry(level, isCorrect, speed) {
  return {
    level,
    isCorrect,
    speed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Mengambil history jawaban siswa dari database
 * @param {Object} supabaseAdmin - Supabase admin client
 * @param {string} hasilKuisId - ID hasil kuis
 * @param {number} limit - Jumlah maksimal history yang diambil (default: 10)
 * @returns {Promise<Array>} Array history jawaban
 */
async function getAnswerHistory(supabaseAdmin, hasilKuisId, limit = 10) {
  try {
    const { data, error } = await supabaseAdmin
      .from("detail_jawaban_siswa")
      .select(
        "level_soal, benar, waktu_dijawab, created_at, soal:bank_soal!detail_jawaban_siswa_soal_id_fkey(durasi_soal)"
      )
      .eq("hasil_kuis_id", hasilKuisId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching answer history:", error);
      return [];
    }

    return data
      .map((item) => {
        const speed = categorizeSpeed(
          item.waktu_dijawab,
          item.soal?.durasi_soal || 60
        );
        return {
          level: item.level_soal,
          isCorrect: item.benar,
          speed,
          timestamp: item.created_at,
        };
      })
      .reverse();
  } catch (error) {
    console.error("Error in getAnswerHistory:", error);
    return [];
  }
}

export {
  // Main function dengan sistem poin
  calculateLevelProgress,

  // Helper functions
  categorizeSpeed,
  calculatePoints,
  countConsecutivePattern,
  countConsecutiveSpeedPattern,

  // Backward compatibility functions
  determineNextLevel,
  getInitialLevel,
  isFastAnswer,
  createHistoryEntry,
  getAnswerHistory,
  countConsecutiveCorrect,
  countConsecutiveWrongAtSameLevel,
};
