import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";

/**
 * Get laporan per siswa dalam satu kelas
 * GET /api/laporan/kelas/:kelasId/siswa/:siswaId
 */
export const getLaporanSiswa = async (req, res) => {
  try {
    const { kelasId, siswaId } = req.params;

    console.log("=== getLaporanSiswa Backend ===");
    console.log("kelasId:", kelasId);
    console.log("siswaId:", siswaId);

    // 1. Get data siswa
    const { data: siswa, error: siswaError } = await supabaseAdmin
      .from("pengguna")
      .select("id, nama_lengkap, nisn, role")
      .eq("id", siswaId)
      .eq("role", "siswa")
      .single();

    console.log("Siswa data:", siswa);
    console.log("Siswa error:", siswaError);

    if (siswaError || !siswa) {
      return errorResponse(res, "Siswa tidak ditemukan", 404);
    }

    // 2. Get semua materi dalam kelas
    const { data: materiList, error: materiError } = await supabaseAdmin
      .from("materi")
      .select("id, judul_materi, deskripsi, kelas_id")
      .eq("kelas_id", kelasId)
      .order("created_at", { ascending: true });

    if (materiError) {
      console.error("Error fetching materi:", materiError);
      return errorResponse(res, "Gagal mengambil data materi", 500);
    }

    // 3. Get semua hasil kuis siswa untuk materi-materi tersebut
    const materiIds = materiList.map((m) => m.id);

    const { data: hasilKuisList, error: hasilError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        id,
        siswa_id,
        kuis_id,
        total_benar,
        total_salah,
        total_waktu,
        selesai,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          id,
          judul,
          materi_id
        )
      `
      )
      .eq("siswa_id", siswaId)
      .eq("selesai", true)
      .in("kuis.materi_id", materiIds.length > 0 ? materiIds : ["dummy-id"]);

    if (hasilError) {
      console.error("Error fetching hasil kuis:", hasilError);
    }

    // 4. Get detail jawaban untuk menghitung distribusi per level
    const hasilKuisIds = (hasilKuisList || []).map((h) => h.id);

    let jawabanDetails = [];
    if (hasilKuisIds.length > 0) {
      const { data: jawaban, error: jawabanError } = await supabaseAdmin
        .from("detail_jawaban_siswa")
        .select("id, hasil_kuis_id, benar, level_soal")
        .in("hasil_kuis_id", hasilKuisIds);

      if (jawabanError) {
        console.error("Error fetching jawaban:", jawabanError);
      } else {
        jawabanDetails = jawaban || [];
      }
    }

    // 5. Get analisis AI untuk setiap hasil kuis
    let analisisList = [];
    if (hasilKuisIds.length > 0) {
      const { data: analisis, error: analisisError } = await supabaseAdmin
        .from("analisis_ai")
        .select(
          "id, hasil_kuis_id, materi_id, analisis, kelebihan, kelemahan, level_tertinggi, level_terendah, rekomendasi_belajar, rekomendasi_video, created_at"
        )
        .in("hasil_kuis_id", hasilKuisIds)
        .order("created_at", { ascending: false });

      if (analisisError) {
        console.error("Error fetching analisis:", analisisError);
      } else {
        analisisList = analisis || [];
      }
    }

    // 6. Hitung distribusi jawaban per level (overall - semua materi)
    const performanceByLevel = {
      level1: { benar: 0, salah: 0 },
      level2: { benar: 0, salah: 0 },
      level3: { benar: 0, salah: 0 },
      level4: { benar: 0, salah: 0 },
      level5: { benar: 0, salah: 0 },
      level6: { benar: 0, salah: 0 },
    };

    jawabanDetails.forEach((jawaban) => {
      const level = jawaban.level_soal.toLowerCase();
      if (performanceByLevel[level]) {
        if (jawaban.benar) {
          performanceByLevel[level].benar++;
        } else {
          performanceByLevel[level].salah++;
        }
      }
    });

    // Format untuk response
    const performanceData = [
      {
        level: "level1",
        benar: performanceByLevel.level1.benar,
        salah: performanceByLevel.level1.salah,
      },
      {
        level: "level2",
        benar: performanceByLevel.level2.benar,
        salah: performanceByLevel.level2.salah,
      },
      {
        level: "level3",
        benar: performanceByLevel.level3.benar,
        salah: performanceByLevel.level3.salah,
      },
      {
        level: "level4",
        benar: performanceByLevel.level4.benar,
        salah: performanceByLevel.level4.salah,
      },
      {
        level: "level5",
        benar: performanceByLevel.level5.benar,
        salah: performanceByLevel.level5.salah,
      },
      {
        level: "level6",
        benar: performanceByLevel.level6.benar,
        salah: performanceByLevel.level6.salah,
      },
    ];

    // 7. Build progress per materi
    const materiProgress = await Promise.all(
      materiList.map(async (materi) => {
        // Filter hasil kuis untuk materi ini
        const hasilKuisMateri = (hasilKuisList || []).filter(
          (h) => h.kuis?.materi_id === materi.id
        );

        // Hitung total soal yang dijawab untuk materi ini
        const totalSoalDijawab = jawabanDetails.filter((j) =>
          hasilKuisMateri.some((h) => h.id === j.hasil_kuis_id)
        ).length;

        // Hitung distribusi per level untuk materi ini
        const materiLevelPerformance = {
          level1: { benar: 0, salah: 0 },
          level2: { benar: 0, salah: 0 },
          level3: { benar: 0, salah: 0 },
          level4: { benar: 0, salah: 0 },
          level5: { benar: 0, salah: 0 },
          level6: { benar: 0, salah: 0 },
        };

        jawabanDetails
          .filter((j) => hasilKuisMateri.some((h) => h.id === j.hasil_kuis_id))
          .forEach((jawaban) => {
            const level = jawaban.level_soal.toLowerCase();
            if (materiLevelPerformance[level]) {
              if (jawaban.benar) {
                materiLevelPerformance[level].benar++;
              } else {
                materiLevelPerformance[level].salah++;
              }
            }
          });

        // Get analisis untuk materi ini (ambil yang terbaru)
        const materiAnalisis = analisisList
          .filter((a) => a.materi_id === materi.id)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

        // Get analisis guru untuk materi ini if exists
        let materiAnalisisGuru = null;
        if (materiAnalisis && materiAnalisis.hasil_kuis_id) {
          const { data: analisisGuruData, error: analisisGuruError } =
            await supabaseAdmin
              .from("analisis_ai_guru")
              .select("*")
              .eq("hasil_kuis_id", materiAnalisis.hasil_kuis_id)
              .order("created_at", { ascending: false })
              .limit(1);

          if (!analisisGuruError && analisisGuruData && analisisGuruData.length > 0) {
            materiAnalisisGuru = analisisGuruData[0];
          }
        }

        // Tentukan status dan progress
        let status = "not_started";
        let progress = 0;

        if (hasilKuisMateri.length > 0) {
          // Ada kuis yang dikerjakan
          status = "in_progress";

          // Hitung progress berdasarkan jumlah soal yang dijawab
          // Asumsi: 60 soal = 100% (10 soal per level x 6 level)
          progress = Math.min(Math.round((totalSoalDijawab / 60) * 100), 100);

          // Materi dianggap COMPLETED jika ada minimal 1 kuis yang selesai (selesai=true)
          // Kuis dianggap selesai ketika siswa sudah menjawab semua soal kuis
          const adaKuisSelesai = hasilKuisMateri.some((h) => h.selesai === true);

          if (adaKuisSelesai) {
            status = "completed";
            // Set progress minimal 80% jika sudah ada kuis yang selesai
            progress = Math.max(progress, 80);
          }
        }

        return {
          materiId: materi.id,
          judul: materi.judul_materi,
          deskripsi: materi.deskripsi,
          progress,
          status,
          totalKuisDikerjakan: hasilKuisMateri.length,
          totalSoalDijawab,
          performanceByLevel: [
            {
              level: "level1",
              benar: materiLevelPerformance.level1.benar,
              salah: materiLevelPerformance.level1.salah,
            },
            {
              level: "level2",
              benar: materiLevelPerformance.level2.benar,
              salah: materiLevelPerformance.level2.salah,
            },
            {
              level: "level3",
              benar: materiLevelPerformance.level3.benar,
              salah: materiLevelPerformance.level3.salah,
            },
            {
              level: "level4",
              benar: materiLevelPerformance.level4.benar,
              salah: materiLevelPerformance.level4.salah,
            },
            {
              level: "level5",
              benar: materiLevelPerformance.level5.benar,
              salah: materiLevelPerformance.level5.salah,
            },
            {
              level: "level6",
              benar: materiLevelPerformance.level6.benar,
              salah: materiLevelPerformance.level6.salah,
            },
          ],
          analisis: materiAnalisis || null,
          analisisGuru: materiAnalisisGuru || null,
        };
      })
    );

    // 8. Build response
    const response = {
      siswaId: siswa.id,
      nama: siswa.nama_lengkap,
      nisn: siswa.nisn,
      performanceByLevel: performanceData,
      materiProgress,
      totalKuisDikerjakan: (hasilKuisList || []).length,
      totalSoalDijawab: jawabanDetails.length,
    };

    return successResponse(res, response, "Laporan siswa berhasil diambil");
  } catch (error) {
    console.error("Error in getLaporanSiswa:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};

/**
 * Get hasil kuis detail untuk satu materi siswa
 * GET /api/laporan/kelas/:kelasId/siswa/:siswaId/materi/:materiId/hasil-kuis
 */
export const getHasilKuisDetail = async (req, res) => {
  try {
    const { siswaId, materiId } = req.params;

    // Get hasil kuis untuk materi ini
    const { data: hasilKuisList, error: hasilError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select(
        `
        id,
        siswa_id,
        kuis_id,
        total_benar,
        total_salah,
        total_waktu,
        selesai,
        created_at,
        kuis:kuis!hasil_kuis_siswa_kuis_id_fkey(
          id,
          judul,
          materi_id
        )
      `
      )
      .eq("siswa_id", siswaId)
      .eq("selesai", true)
      .eq("kuis.materi_id", materiId)
      .order("created_at", { ascending: false });

    if (hasilError) {
      console.error("Error fetching hasil kuis:", hasilError);
      return errorResponse(res, "Gagal mengambil hasil kuis", 500);
    }

    // Get detail jawaban untuk setiap hasil kuis
    const hasilKuisIds = (hasilKuisList || []).map((h) => h.id);
    let detailJawaban = [];

    if (hasilKuisIds.length > 0) {
      const { data: jawaban, error: jawabanError } = await supabaseAdmin
        .from("detail_jawaban_siswa")
        .select(
          `
          id,
          hasil_kuis_id,
          soal_id,
          jawaban_id,
          jawaban_siswa,
          benar,
          waktu_dijawab,
          level_soal,
          tipe_jawaban,
          bank_soal!detail_jawaban_siswa_soal_id_fkey(
            id,
            soal_teks,
            level_soal,
            tipe_jawaban
          )
        `
        )
        .in("hasil_kuis_id", hasilKuisIds);

      if (jawabanError) {
        console.error("Error fetching detail jawaban:", jawabanError);
      } else {
        detailJawaban = jawaban || [];
      }
    }

    // Get jawaban_soal separately for each soal (both for correct answers AND student answers)
    const soalIds = [...new Set(detailJawaban.map((j) => j.soal_id))];
    let jawabanSoalMap = {};
    let jawabanSoalById = {}; // Map for looking up answers by ID

    if (soalIds.length > 0) {
      const { data: jawabanSoalList, error: jawabanSoalError } =
        await supabaseAdmin
          .from("jawaban_soal")
          .select("id, soal_id, isi_jawaban, is_benar")
          .in("soal_id", soalIds);

      if (jawabanSoalError) {
        console.error("Error fetching jawaban_soal:", jawabanSoalError);
      }

      if (!jawabanSoalError && jawabanSoalList) {
        // Group by soal_id
        jawabanSoalList.forEach((js) => {
          if (!jawabanSoalMap[js.soal_id]) {
            jawabanSoalMap[js.soal_id] = [];
          }
          jawabanSoalMap[js.soal_id].push(js);
          // Also index by ID for student answer lookup
          jawabanSoalById[js.id] = js;
        });
      }
    }

    // Build response dengan detail jawaban
    const results = (hasilKuisList || []).map((hasil) => {
      const jawabanHasil = detailJawaban.filter(
        (j) => j.hasil_kuis_id === hasil.id
      );

      return {
        hasilKuisId: hasil.id,
        kuisJudul: hasil.kuis?.judul || "Kuis",
        totalBenar: hasil.total_benar,
        totalSalah: hasil.total_salah,
        totalWaktu: hasil.total_waktu,
        tanggal: hasil.created_at,
        detailJawaban: jawabanHasil.map((j) => {
          // Get correct answer(s) based on question type
          let jawabanBenar = "-";
          let allJawabanText = []; // All answer options for multiple choice

          // Get jawaban_soal for this question
          const jawabanSoalList = jawabanSoalMap[j.soal_id] || [];

          if (jawabanSoalList.length > 0) {
            // Store all answers for reference
            allJawabanText = jawabanSoalList.map(ans => ans.isi_jawaban);
            
            const correctAnswers = jawabanSoalList.filter(
              (ans) => ans.is_benar
            );

            if (correctAnswers.length > 0) {
              // For all types: only show correct answers
              jawabanBenar = correctAnswers
                .map((ans) => ans.isi_jawaban)
                .join(", ");
            }
          }
          // For essay/isian, get correct answer from jawaban_soal table
          else if (
            j.bank_soal?.tipe_jawaban === "isian" ||
            j.bank_soal?.tipe_jawaban === "essay"
          ) {
            // For essay/isian, look for the correct answer in jawaban_soal
            if (jawabanSoalList.length > 0) {
              const correctAnswer = jawabanSoalList.find(ans => ans.is_benar);
              jawabanBenar = correctAnswer ? correctAnswer.isi_jawaban : "-";
            }
          }

          // Resolve student's answer text
          let jawabanSiswaText = j.jawaban_siswa || "";
          
          // If jawaban_siswa is a UUID (looks like ID), try to resolve it
          if (jawabanSiswaText && jawabanSiswaText.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            const resolvedAnswer = jawabanSoalById[jawabanSiswaText];
            if (resolvedAnswer) {
              jawabanSiswaText = resolvedAnswer.isi_jawaban;
            }
          }
          // For multiple choice complex, might have comma-separated IDs
          else if (jawabanSiswaText && jawabanSiswaText.includes(",")) {
            const ids = jawabanSiswaText.split(",").map(id => id.trim());
            const resolvedAnswers = ids
              .map(id => {
                const resolved = jawabanSoalById[id]?.isi_jawaban;
                if (!resolved) {
                }
                return resolved;
              })
              .filter(Boolean);
            if (resolvedAnswers.length > 0) {
              jawabanSiswaText = resolvedAnswers.join(", ");
            }
          }

          return {
            // Use unique id from detail_jawaban_siswa table
            id: j.id,
            soalId: j.soal_id,
            pertanyaan: j.bank_soal?.soal_teks || "Pertanyaan tidak tersedia",
            tipeSoal: j.level_soal,
            jawabanSiswa: jawabanSiswaText,
            jawabanBenar,
            isCorrect: j.benar,
            waktuJawab: j.waktu_dijawab,
          };
        }),
      };
    });

    return successResponse(res, results, "Detail hasil kuis berhasil diambil");
  } catch (error) {
    console.error("Error in getHasilKuisDetail:", error);
    return errorResponse(res, "Terjadi kesalahan server", 500);
  }
};
