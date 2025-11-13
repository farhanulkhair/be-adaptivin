/**
 * Service untuk logika rule-based adaptif dengan sistem poin
 * Menentukan level soal berikutnya berdasarkan jawaban siswa
 *
 * ATURAN KECEPATAN (berdasarkan durasi soal yang ditetapkan guru):
 * - Cepat  : < 70% dari durasi soal
 * - Sedang : 70-110% dari durasi soal
 * - Lambat : > 110% dari durasi soal
 */

/**
 * Menentukan kategori kecepatan jawaban
 * @param {number} waktuDijawab - Waktu yang digunakan siswa (detik)
 * @param {number} durasiSoal - Durasi soal yang ditetapkan guru (detik)
 * @returns {string} 'cepat' | 'sedang' | 'lambat'
 */
function categorizeSpeed(waktuDijawab, durasiSoal) {
  const persentase = (waktuDijawab / durasiSoal) * 100;

  if (persentase < 70) {
    return "cepat"; // < 70% dari durasi soal
  } else if (persentase <= 110) {
    return "sedang"; // 70-110% dari durasi soal
  } else {
    return "lambat"; // > 110% dari durasi soal
  }
}

/**
 * Menghitung poin berdasarkan hasil dan kecepatan
 * SISTEM BARU:
 * - Benar + Cepat = tidak pakai poin (langsung naik level)
 * - Benar + Sedang = +2 poin (akumulasi, naik di ≥4 poin)
 * - Benar + Lambat = 0 poin (konsistensi 3x berturut-turut)
 * - Salah = 0 poin (reset)
 *
 * @param {boolean} isCorrect - Apakah jawaban benar
 * @param {string} speed - Kecepatan jawaban
 * @returns {number} Poin yang didapat
 */
function calculatePoints(isCorrect, speed) {
  if (isCorrect) {
    if (speed === "cepat") return 0; // Benar+Cepat langsung naik
    if (speed === "sedang") return 2; // Benar+Sedang = +2 poin
    return 0; // Benar+Lambat = 0 poin (pakai sistem konsistensi 3x)
  } else {
    return 0; // Semua jawaban salah = 0 poin (reset)
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
    const speed = categorizeSpeed(answer.timeTaken, answer.durasiSoal);
    const points = calculatePoints(answer.correct, speed);
    totalPoints += points;

    analysisDetails.push({
      index: index + 1,
      correct: answer.correct,
      speed,
      points,
      questionLevel: answer.questionLevel,
      timeTaken: answer.timeTaken,
      durasiSoal: answer.durasiSoal,
    });
  });

  // Analisis jawaban terakhir untuk aturan khusus
  const lastAnswer = recentAnswers[recentAnswers.length - 1];
  const lastSpeed = categorizeSpeed(
    lastAnswer.timeTaken,
    lastAnswer.durasiSoal
  );
  const lastPoints = calculatePoints(lastAnswer.correct, lastSpeed);

  // PERBAIKAN: Hitung poin HANYA dari jawaban terakhir untuk logika benar berturut-turut
  // Poin akumulatif sekarang HANYA untuk tracking consecutive correct answers
  let consecutivePoints = 0;

  // Hitung consecutive correct answers dari belakang
  for (let i = recentAnswers.length - 1; i >= 0; i--) {
    if (!recentAnswers[i].correct) break; // Stop jika ketemu salah

    const speed = categorizeSpeed(
      recentAnswers[i].timeTaken,
      recentAnswers[i].durasiSoal
    );
    const points = calculatePoints(recentAnswers[i].correct, speed);
    consecutivePoints += points;
  }

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
  let pointsAfterChange = consecutivePoints; // Gunakan consecutive points, bukan totalPoints

  // === ATURAN NAIK LEVEL ===

  // 1. NAIK 1 LEVEL: Benar + Cepat (langsung naik)
  if (lastAnswer.correct && lastSpeed === "cepat" && currentLevel < 6) {
    newLevel = Math.min(currentLevel + 1, 6);
    levelChange = "naik";
    reason = "Benar + Cepat → Naik 1 level";
    pointsAfterChange = 0;
  }

  // 2. NAIK 1 LEVEL: Akumulasi poin >= 4 dari Benar + Sedang
  // Benar+Sedang memberikan +2 poin, jadi perlu 4 poin untuk naik (2x Benar+Sedang)
  else if (lastAnswer.correct && consecutivePoints >= 4 && currentLevel < 6) {
    newLevel = Math.min(currentLevel + 1, 6);
    levelChange = "naik";
    reason = `Akumulasi poin ${consecutivePoints} (>= 4) → Naik 1 level`;
    pointsAfterChange = 0; // Reset poin
  }

  // 3. NAIK 1 LEVEL: 3x Benar + Lambat berturut-turut (konsistensi)
  else if (consecutiveSlowCorrect >= 3 && currentLevel < 6) {
    newLevel = Math.min(currentLevel + 1, 6);
    levelChange = "naik";
    reason = `3x Benar + Lambat berturut-turut (konsistensi terjaga) → Naik 1 level`;
    pointsAfterChange = 0;
  }

  // === ATURAN TURUN LEVEL ===

  // 1. TURUN 1 LEVEL: Salah + Lambat (tidak paham)
  else if (!lastAnswer.correct && lastSpeed === "lambat" && currentLevel > 1) {
    newLevel = Math.max(currentLevel - 1, 1);
    levelChange = "turun";
    reason = "Salah + Lambat (tidak paham materi) → Turun 1 level";
    pointsAfterChange = 0; // RESET karena jawaban salah
  }

  // 2. TURUN 1 LEVEL: 2x Salah berturut-turut (apapun kecepatannya)
  else if (consecutiveWrong >= 2 && currentLevel > 1) {
    newLevel = Math.max(currentLevel - 1, 1);
    levelChange = "turun";
    reason = `${consecutiveWrong}x Salah berturut-turut → Turun 1 level`;
    pointsAfterChange = 0; // RESET karena jawaban salah
  }

  // === TETAP ===
  else {
    reason = buildStayReason(
      lastAnswer.correct,
      lastSpeed,
      consecutivePoints, // Gunakan consecutivePoints, bukan totalPoints
      consecutiveCorrect,
      consecutiveMediumCorrect,
      consecutiveSlowCorrect
    );

    // PERBAIKAN: Reset poin ke 0 jika jawaban terakhir SALAH
    // Poin hanya bertambah jika benar berturut-turut
    if (!lastAnswer.correct) {
      pointsAfterChange = 0;
    } else {
      pointsAfterChange = consecutivePoints; // Simpan poin consecutive jika tetap benar
    }
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
    const speed = categorizeSpeed(answers[i].timeTaken, answers[i].durasiSoal);
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
    return `Benar + Lambat (${slowStreak}/3 konsistensi) → Tetap (Perlu 3x berturut-turut untuk naik)`;
  } else if (correct && speed === "sedang") {
    return `Benar + Sedang (poin: ${points}/4) → Tetap (Perlu 4 poin untuk naik)`;
  } else if (!correct && speed === "cepat") {
    return `Salah + Cepat (mungkin teledor) → Tetap (Diberi kesempatan)`;
  } else if (!correct && speed === "sedang") {
    return `Salah + Sedang (pertama kali) → Tetap (Poin direset ke 0)`;
  } else if (!correct) {
    return `Salah pertama kali → Tetap (Poin direset ke 0)`;
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
 * Menggunakan durasi_soal sebagai basis perhitungan kecepatan
 * @param {string} currentLevel - Level soal saat ini
 * @param {boolean} isCorrect - Apakah jawaban benar
 * @param {number} waktuDijawab - Waktu yang digunakan siswa (detik)
 * @param {number} waktuDitentukan - Durasi soal yang ditetapkan guru (detik)
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
