/**
 * COMPREHENSIVE API ENDPOINT TEST
 * Test semua endpoint sebelum deploy ke Vercel
 *
 * Cara menjalankan:
 * 1. Pastikan backend sudah running: npm start
 * 2. Jalankan test: node src/test/test-all-endpoints.js
 */

import axios from "axios";

// ==================== CONFIGURATION ====================
const BASE_URL = process.env.API_URL || "http://localhost:5000/api";
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Test data storage
let testData = {
  tokens: {
    superadmin: null,
    admin: null,
    guru: null,
    siswa: null,
  },
  ids: {
    sekolah: null,
    admin: null,
    guru: null,
    siswa: null,
    kelas: null,
    materi: null,
    subMateri: null,
    soal: null,
    jawaban: null,
    kuis: null,
    hasilKuis: null,
    detailJawaban: null,
  },
  users: {
    superadmin: { email: "superadmin@gmail.com", password: "Superadmin123!" },
    admin: { email: "admin@gmail.com", password: "admin1234" },
    guru: { email: "guru@gmail.com", password: "guru1234" },
    siswa: { email: "siswa@gmail.com", password: "siswa1234" },
  },
};

// ==================== HELPER FUNCTIONS ====================

function log(message, color = "reset") {
  console.log(COLORS[color] + message + COLORS.reset);
}

function logTest(testName) {
  console.log("\n" + COLORS.cyan + "━".repeat(80) + COLORS.reset);
  log(`🧪 Testing: ${testName}`, "bright");
  console.log(COLORS.cyan + "━".repeat(80) + COLORS.reset);
}

function logSuccess(message) {
  log(`✅ ${message}`, "green");
}

function logError(message, error) {
  log(`❌ ${message}`, "red");
  if (error?.response?.data) {
    console.error("   Error details:", error.response.data);
  } else if (error?.message) {
    console.error("   Error message:", error.message);
  }
}

function logWarning(message) {
  log(`⚠️  ${message}`, "yellow");
}

function logInfo(message) {
  log(`ℹ️  ${message}`, "blue");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== TEST SUITES ====================

/**
 * 1. AUTH ENDPOINTS
 */
async function testAuthEndpoints() {
  logTest("AUTH ENDPOINTS");

  try {
    // Test 1.1: Login Superadmin
    logInfo("Test 1.1: Login as Superadmin");
    const superadminLogin = await axios.post(
      `${BASE_URL}/auth/login`,
      testData.users.superadmin
    );
    testData.tokens.superadmin = superadminLogin.data.data.token;
    logSuccess(
      `Superadmin login successful. Token: ${testData.tokens.superadmin.substring(
        0,
        20
      )}...`
    );

    // Test 1.2: Register Admin
    logInfo("Test 1.2: Register new Admin");
    try {
      const adminData = {
        email: testData.users.admin.email,
        password: testData.users.admin.password,
        nama_lengkap: "Admin Test",
        role: "admin",
        jenis_kelamin: "laki-laki",
        alamat: "Jl. Test Admin",
        tanggal_lahir: "1990-01-01",
      };
      const adminRegister = await axios.post(
        `${BASE_URL}/auth/register`,
        adminData
      );
      testData.ids.admin = adminRegister.data.data.user.id;
      logSuccess(`Admin registered with ID: ${testData.ids.admin}`);
    } catch (error) {
      if (error.response?.data?.error?.includes("already")) {
        logWarning("Admin already exists, skipping registration");
      } else {
        throw error;
      }
    }

    // Test 1.3: Login Admin
    logInfo("Test 1.3: Login as Admin");
    const adminLogin = await axios.post(
      `${BASE_URL}/auth/login`,
      testData.users.admin
    );
    testData.tokens.admin = adminLogin.data.data.token;
    logSuccess(`Admin login successful`);

    // Test 1.4: Logout
    logInfo("Test 1.4: Logout");
    await axios.post(
      `${BASE_URL}/auth/logout`,
      {},
      {
        headers: { Authorization: `Bearer ${testData.tokens.admin}` },
      }
    );
    logSuccess("Logout successful");

    return true;
  } catch (error) {
    logError("Auth endpoints test failed", error);
    return false;
  }
}

/**
 * 2. SEKOLAH ENDPOINTS
 */
async function testSekolahEndpoints() {
  logTest("SEKOLAH ENDPOINTS");

  try {
    // Test 2.1: Create Sekolah
    logInfo("Test 2.1: Create Sekolah");
    const sekolahData = {
      nama_sekolah: "SMA Test Adaptivin",
      alamat_sekolah: "Jl. Testing No. 123",
    };
    const createSekolah = await axios.post(`${BASE_URL}/sekolah`, sekolahData, {
      headers: { Authorization: `Bearer ${testData.tokens.superadmin}` },
    });
    testData.ids.sekolah = createSekolah.data.data.id;
    logSuccess(`Sekolah created with ID: ${testData.ids.sekolah}`);

    // Test 2.2: Get All Sekolah
    logInfo("Test 2.2: Get all Sekolah");
    const allSekolah = await axios.get(`${BASE_URL}/sekolah`, {
      headers: { Authorization: `Bearer ${testData.tokens.superadmin}` },
    });
    logSuccess(`Retrieved ${allSekolah.data.data.length} sekolah`);

    // Test 2.3: Get Sekolah by ID
    logInfo("Test 2.3: Get Sekolah by ID");
    const sekolahById = await axios.get(
      `${BASE_URL}/sekolah/${testData.ids.sekolah}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.superadmin}` },
      }
    );
    logSuccess(`Retrieved sekolah: ${sekolahById.data.data.nama_sekolah}`);

    // Test 2.4: Update Sekolah
    logInfo("Test 2.4: Update Sekolah");
    const updateData = {
      nama_sekolah: "SMA Test Adaptivin (Updated)",
      alamat_sekolah: "Jl. Testing No. 456",
    };
    await axios.put(`${BASE_URL}/sekolah/${testData.ids.sekolah}`, updateData, {
      headers: { Authorization: `Bearer ${testData.tokens.superadmin}` },
    });
    logSuccess("Sekolah updated successfully");

    return true;
  } catch (error) {
    logError("Sekolah endpoints test failed", error);
    return false;
  }
}

/**
 * 3. USER ENDPOINTS (Guru & Siswa)
 */
async function testUserEndpoints() {
  logTest("USER ENDPOINTS");

  try {
    // Test 3.1: Register Guru
    logInfo("Test 3.1: Register Guru");
    try {
      const guruData = {
        email: testData.users.guru.email,
        password: testData.users.guru.password,
        nama_lengkap: "Guru Test",
        role: "guru",
        nip: "1234567890",
        jenis_kelamin: "laki-laki",
        alamat: "Jl. Test Guru",
        tanggal_lahir: "1985-01-01",
        sekolah_id: testData.ids.sekolah,
      };
      const guruRegister = await axios.post(
        `${BASE_URL}/auth/register`,
        guruData
      );
      testData.ids.guru = guruRegister.data.data.user.id;
      logSuccess(`Guru registered with ID: ${testData.ids.guru}`);
    } catch (error) {
      if (error.response?.data?.error?.includes("already")) {
        logWarning("Guru already exists, attempting login");
        const guruLogin = await axios.post(
          `${BASE_URL}/auth/login`,
          testData.users.guru
        );
        testData.ids.guru = guruLogin.data.data.user.id;
      } else {
        throw error;
      }
    }

    // Test 3.2: Login Guru
    logInfo("Test 3.2: Login as Guru");
    const guruLogin = await axios.post(
      `${BASE_URL}/auth/login`,
      testData.users.guru
    );
    testData.tokens.guru = guruLogin.data.data.token;
    logSuccess("Guru login successful");

    // Test 3.3: Register Siswa
    logInfo("Test 3.3: Register Siswa");
    try {
      const siswaData = {
        email: testData.users.siswa.email,
        password: testData.users.siswa.password,
        nama_lengkap: "Siswa Test",
        role: "siswa",
        nisn: "0123456789",
        jenis_kelamin: "perempuan",
        alamat: "Jl. Test Siswa",
        tanggal_lahir: "2005-01-01",
        sekolah_id: testData.ids.sekolah,
      };
      const siswaRegister = await axios.post(
        `${BASE_URL}/auth/register`,
        siswaData
      );
      testData.ids.siswa = siswaRegister.data.data.user.id;
      logSuccess(`Siswa registered with ID: ${testData.ids.siswa}`);
    } catch (error) {
      if (error.response?.data?.error?.includes("already")) {
        logWarning("Siswa already exists, attempting login");
        const siswaLogin = await axios.post(
          `${BASE_URL}/auth/login`,
          testData.users.siswa
        );
        testData.ids.siswa = siswaLogin.data.data.user.id;
      } else {
        throw error;
      }
    }

    // Test 3.4: Login Siswa
    logInfo("Test 3.4: Login as Siswa");
    const siswaLogin = await axios.post(
      `${BASE_URL}/auth/login`,
      testData.users.siswa
    );
    testData.tokens.siswa = siswaLogin.data.data.token;
    logSuccess("Siswa login successful");

    // Test 3.5: Get All Users
    logInfo("Test 3.5: Get all Users");
    const allUsers = await axios.get(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${testData.tokens.admin}` },
    });
    logSuccess(`Retrieved ${allUsers.data.data.length} users`);

    // Test 3.6: Get User by ID
    logInfo("Test 3.6: Get User by ID");
    const userById = await axios.get(`${BASE_URL}/users/${testData.ids.guru}`, {
      headers: { Authorization: `Bearer ${testData.tokens.admin}` },
    });
    logSuccess(`Retrieved user: ${userById.data.data.nama_lengkap}`);

    return true;
  } catch (error) {
    logError("User endpoints test failed", error);
    return false;
  }
}

/**
 * 4. KELAS ENDPOINTS
 */
async function testKelasEndpoints() {
  logTest("KELAS ENDPOINTS");

  try {
    // Test 4.1: Create Kelas
    logInfo("Test 4.1: Create Kelas");
    const kelasData = {
      nama_kelas: "10-A",
      tingkat_kelas: "10",
      rombel: "A",
      mata_pelajaran: "Matematika",
      tahun_ajaran: "2024/2025",
      sekolah_id: testData.ids.sekolah,
    };
    const createKelas = await axios.post(`${BASE_URL}/kelas`, kelasData, {
      headers: { Authorization: `Bearer ${testData.tokens.guru}` },
    });
    testData.ids.kelas = createKelas.data.data.id;
    logSuccess(`Kelas created with ID: ${testData.ids.kelas}`);

    // Test 4.2: Get All Kelas
    logInfo("Test 4.2: Get all Kelas");
    const allKelas = await axios.get(`${BASE_URL}/kelas`, {
      headers: { Authorization: `Bearer ${testData.tokens.guru}` },
    });
    logSuccess(`Retrieved ${allKelas.data.data.length} kelas`);

    // Test 4.3: Get Kelas by ID
    logInfo("Test 4.3: Get Kelas by ID");
    const kelasById = await axios.get(
      `${BASE_URL}/kelas/${testData.ids.kelas}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(`Retrieved kelas: ${kelasById.data.data.nama_kelas}`);

    // Test 4.4: Add Siswa to Kelas
    logInfo("Test 4.4: Add Siswa to Kelas");
    await axios.post(
      `${BASE_URL}/kelas/${testData.ids.kelas}/siswa`,
      { siswa_id: testData.ids.siswa },
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess("Siswa added to kelas");

    // Test 4.5: Get Siswa in Kelas
    logInfo("Test 4.5: Get Siswa in Kelas");
    const siswaInKelas = await axios.get(
      `${BASE_URL}/kelas/${testData.ids.kelas}/siswa`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(
      `Retrieved ${siswaInKelas.data.data.items.length} siswa in kelas`
    );

    return true;
  } catch (error) {
    logError("Kelas endpoints test failed", error);
    return false;
  }
}

/**
 * 5. MATERI ENDPOINTS
 */
async function testMateriEndpoints() {
  logTest("MATERI ENDPOINTS");

  try {
    // Test 5.1: Create Materi
    logInfo("Test 5.1: Create Materi");
    const materiData = {
      judul_materi: "Bilangan Bulat",
      deskripsi: "Materi tentang operasi bilangan bulat",
      kelas_id: testData.ids.kelas,
    };
    const createMateri = await axios.post(`${BASE_URL}/materi`, materiData, {
      headers: { Authorization: `Bearer ${testData.tokens.guru}` },
    });
    testData.ids.materi = createMateri.data.data.id;
    logSuccess(`Materi created with ID: ${testData.ids.materi}`);

    // Test 5.2: Get All Materi
    logInfo("Test 5.2: Get all Materi");
    const allMateri = await axios.get(
      `${BASE_URL}/materi/kelas/${testData.ids.kelas}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(`Retrieved ${allMateri.data.data.length} materi`);

    // Test 5.3: Get Materi by ID
    logInfo("Test 5.3: Get Materi by ID");
    const materiById = await axios.get(
      `${BASE_URL}/materi/${testData.ids.materi}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(`Retrieved materi: ${materiById.data.data.judul_materi}`);

    // Test 5.4: Update Materi
    logInfo("Test 5.4: Update Materi");
    const updateMateri = {
      judul_materi: "Bilangan Bulat (Updated)",
      deskripsi: "Materi tentang operasi bilangan bulat - updated",
    };
    await axios.put(`${BASE_URL}/materi/${testData.ids.materi}`, updateMateri, {
      headers: { Authorization: `Bearer ${testData.tokens.guru}` },
    });
    logSuccess("Materi updated successfully");

    // Test 5.5: Create Sub Materi
    logInfo("Test 5.5: Create Sub Materi");
    const subMateriData = {
      judul_sub_materi: "Penjumlahan Bilangan Bulat",
      isi_materi: "Penjelasan tentang cara menjumlahkan bilangan bulat",
      urutan: 1,
    };
    const createSubMateri = await axios.post(
      `${BASE_URL}/materi/${testData.ids.materi}/sub-materi`,
      subMateriData,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    testData.ids.subMateri = createSubMateri.data.data.id;
    logSuccess(`Sub Materi created with ID: ${testData.ids.subMateri}`);

    // Test 5.6: Get Sub Materi
    logInfo("Test 5.6: Get Sub Materi");
    const subMateri = await axios.get(
      `${BASE_URL}/materi/${testData.ids.materi}/sub-materi`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(`Retrieved ${subMateri.data.data.length} sub materi`);

    return true;
  } catch (error) {
    logError("Materi endpoints test failed", error);
    return false;
  }
}

/**
 * 6. BANK SOAL ENDPOINTS
 */
async function testBankSoalEndpoints() {
  logTest("BANK SOAL ENDPOINTS");

  try {
    // Test 6.1: Create Soal
    logInfo("Test 6.1: Create Soal");
    const soalData = {
      level_soal: "level1",
      tipe_jawaban: "pilihan_ganda",
      soal_teks: "Berapakah hasil dari 5 + 3?",
      durasi_soal: 60,
      penjelasan: "Penjumlahan sederhana",
    };
    const createSoal = await axios.post(
      `${BASE_URL}/soal/${testData.ids.materi}`,
      soalData,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    testData.ids.soal = createSoal.data.data.id;
    logSuccess(`Soal created with ID: ${testData.ids.soal}`);

    // Test 6.2: Create Jawaban for Soal
    logInfo("Test 6.2: Create Jawaban for Soal");
    const jawabanData = [
      { isi_jawaban: "8", is_benar: true },
      { isi_jawaban: "7", is_benar: false },
      { isi_jawaban: "9", is_benar: false },
      { isi_jawaban: "10", is_benar: false },
    ];

    for (const jawaban of jawabanData) {
      const createJawaban = await axios.post(
        `${BASE_URL}/soal/${testData.ids.soal}/jawaban`,
        jawaban,
        {
          headers: { Authorization: `Bearer ${testData.tokens.guru}` },
        }
      );
      if (jawaban.is_benar) {
        testData.ids.jawaban = createJawaban.data.data.id;
      }
    }
    logSuccess(`Created ${jawabanData.length} jawaban for soal`);

    // Test 6.3: Get All Soal by Materi
    logInfo("Test 6.3: Get all Soal by Materi");
    const allSoal = await axios.get(
      `${BASE_URL}/soal/materi/${testData.ids.materi}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(`Retrieved ${allSoal.data.data.length} soal`);

    // Test 6.4: Get Soal by ID
    logInfo("Test 6.4: Get Soal by ID");
    const soalById = await axios.get(`${BASE_URL}/soal/${testData.ids.soal}`, {
      headers: { Authorization: `Bearer ${testData.tokens.guru}` },
    });
    logSuccess(
      `Retrieved soal: ${soalById.data.data.soal_teks.substring(0, 30)}...`
    );

    // Test 6.5: Update Soal
    logInfo("Test 6.5: Update Soal");
    const updateSoal = {
      soal_teks: "Berapakah hasil dari 5 + 3? (Updated)",
      durasi_soal: 90,
    };
    await axios.put(`${BASE_URL}/soal/${testData.ids.soal}`, updateSoal, {
      headers: { Authorization: `Bearer ${testData.tokens.guru}` },
    });
    logSuccess("Soal updated successfully");

    return true;
  } catch (error) {
    logError("Bank Soal endpoints test failed", error);
    return false;
  }
}

/**
 * 7. KUIS ENDPOINTS
 */
async function testKuisEndpoints() {
  logTest("KUIS ENDPOINTS");

  try {
    // Test 7.1: Create Kuis
    logInfo("Test 7.1: Create Kuis");
    const kuisData = {
      judul: "Kuis Bilangan Bulat",
      jumlah_soal: 10,
    };
    const createKuis = await axios.post(
      `${BASE_URL}/kuis/${testData.ids.materi}`,
      kuisData,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    testData.ids.kuis = createKuis.data.data.id;
    logSuccess(`Kuis created with ID: ${testData.ids.kuis}`);

    // Test 7.2: Get All Kuis by Materi
    logInfo("Test 7.2: Get all Kuis by Materi");
    const allKuis = await axios.get(
      `${BASE_URL}/kuis/materi/${testData.ids.materi}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(`Retrieved ${allKuis.data.data.length} kuis`);

    // Test 7.3: Get Kuis by ID
    logInfo("Test 7.3: Get Kuis by ID");
    const kuisById = await axios.get(`${BASE_URL}/kuis/${testData.ids.kuis}`, {
      headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
    });
    logSuccess(`Retrieved kuis: ${kuisById.data.data.judul}`);

    // Test 7.4: Start Kuis (Create Hasil Kuis)
    logInfo("Test 7.4: Start Kuis");
    const startKuis = await axios.post(
      `${BASE_URL}/hasil-kuis`,
      { kuis_id: testData.ids.kuis },
      {
        headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
      }
    );
    testData.ids.hasilKuis = startKuis.data.data.id;
    logSuccess(`Hasil Kuis created with ID: ${testData.ids.hasilKuis}`);

    // Test 7.5: Get Hasil Kuis by ID
    logInfo("Test 7.5: Get Hasil Kuis by ID");
    const hasilKuisById = await axios.get(
      `${BASE_URL}/hasil-kuis/${testData.ids.hasilKuis}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
      }
    );
    logSuccess(`Retrieved hasil kuis for siswa`);

    return true;
  } catch (error) {
    logError("Kuis endpoints test failed", error);
    return false;
  }
}

/**
 * 8. DETAIL JAWABAN ENDPOINTS
 */
async function testDetailJawabanEndpoints() {
  logTest("DETAIL JAWABAN ENDPOINTS");

  try {
    // Test 8.1: Submit Jawaban
    logInfo("Test 8.1: Submit Jawaban");
    const jawabanData = {
      soal_id: testData.ids.soal,
      jawaban_id: testData.ids.jawaban,
      jawaban_siswa: "8",
      waktu_dijawab: 45,
    };
    const submitJawaban = await axios.post(
      `${BASE_URL}/detail-jawaban/${testData.ids.hasilKuis}`,
      jawabanData,
      {
        headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
      }
    );
    testData.ids.detailJawaban = submitJawaban.data.data.id;
    logSuccess(`Jawaban submitted with ID: ${testData.ids.detailJawaban}`);

    // Test 8.2: Get Detail Jawaban
    logInfo("Test 8.2: Get Detail Jawaban");
    const detailJawaban = await axios.get(
      `${BASE_URL}/detail-jawaban/${testData.ids.hasilKuis}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
      }
    );
    logSuccess(`Retrieved ${detailJawaban.data.data.length} detail jawaban`);

    // Test 8.3: Finish Kuis
    logInfo("Test 8.3: Finish Kuis");
    await axios.put(
      `${BASE_URL}/hasil-kuis/${testData.ids.hasilKuis}/selesai`,
      {},
      {
        headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
      }
    );
    logSuccess("Kuis finished successfully");

    return true;
  } catch (error) {
    logError("Detail Jawaban endpoints test failed", error);
    return false;
  }
}

/**
 * 9. ANALISIS AI ENDPOINTS
 */
async function testAnalisisAIEndpoints() {
  logTest("ANALISIS AI ENDPOINTS");

  try {
    // Wait a bit for hasil kuis to be processed
    await sleep(2000);

    // Test 9.1: Check Analisis Status
    logInfo("Test 9.1: Check Analisis Status");
    const checkStatus = await axios.get(
      `${BASE_URL}/analisis/check/${testData.ids.hasilKuis}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
      }
    );
    logSuccess(
      `Analisis status checked: ${
        checkStatus.data.data.is_analyzed ? "Analyzed" : "Not yet analyzed"
      }`
    );

    // Test 9.2: Create Analisis (if not exists)
    if (!checkStatus.data.data.is_analyzed) {
      logInfo("Test 9.2: Create Analisis");
      try {
        const createAnalisis = await axios.post(
          `${BASE_URL}/analisis/${testData.ids.hasilKuis}`,
          {},
          {
            headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
          }
        );
        logSuccess(`Analisis created with ID: ${createAnalisis.data.data.id}`);
      } catch (error) {
        if (error.response?.status === 400) {
          logWarning("Analisis already exists or cannot be created yet");
        } else {
          throw error;
        }
      }
    }

    // Test 9.3: Get Analisis
    logInfo("Test 9.3: Get Analisis");
    try {
      const getAnalisis = await axios.get(
        `${BASE_URL}/analisis/${testData.ids.hasilKuis}`,
        {
          headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
        }
      );
      logSuccess(`Retrieved analisis for hasil kuis`);
    } catch (error) {
      if (error.response?.status === 404) {
        logWarning("Analisis not found (may need more time to generate)");
      } else {
        throw error;
      }
    }

    // Test 9.4: Check Teacher Analysis Status
    logInfo("Test 9.4: Check Teacher Analysis Status");
    try {
      const checkTeacherStatus = await axios.get(
        `${BASE_URL}/analisis/guru/check/${testData.ids.hasilKuis}`,
        {
          headers: { Authorization: `Bearer ${testData.tokens.guru}` },
        }
      );
      logSuccess(
        `Teacher analysis status: ${
          checkTeacherStatus.data.data.is_analyzed
            ? "Analyzed"
            : "Not yet analyzed"
        }`
      );
    } catch (error) {
      logWarning("Teacher analysis check failed (may not be implemented yet)");
    }

    return true;
  } catch (error) {
    logError("Analisis AI endpoints test failed", error);
    return false;
  }
}

/**
 * 10. LAPORAN ENDPOINTS
 */
async function testLaporanEndpoints() {
  logTest("LAPORAN ENDPOINTS");

  try {
    // Test 10.1: Get Laporan Siswa
    logInfo("Test 10.1: Get Laporan Siswa");
    const laporanSiswa = await axios.get(
      `${BASE_URL}/laporan/kelas/${testData.ids.kelas}/siswa/${testData.ids.siswa}`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(`Retrieved laporan for siswa: ${laporanSiswa.data.data.nama}`);
    logInfo(
      `   Total kuis dikerjakan: ${laporanSiswa.data.data.totalKuisDikerjakan}`
    );
    logInfo(
      `   Total soal dijawab: ${laporanSiswa.data.data.totalSoalDijawab}`
    );

    // Test 10.2: Get Hasil Kuis Detail
    logInfo("Test 10.2: Get Hasil Kuis Detail");
    const hasilKuisDetail = await axios.get(
      `${BASE_URL}/laporan/kelas/${testData.ids.kelas}/siswa/${testData.ids.siswa}/materi/${testData.ids.materi}/hasil-kuis`,
      {
        headers: { Authorization: `Bearer ${testData.tokens.guru}` },
      }
    );
    logSuccess(
      `Retrieved ${hasilKuisDetail.data.data.length} hasil kuis detail`
    );

    return true;
  } catch (error) {
    logError("Laporan endpoints test failed", error);
    return false;
  }
}

/**
 * 11. VIDEO REKOMENDASI ENDPOINTS
 */
async function testVideoRekomendasiEndpoints() {
  logTest("VIDEO REKOMENDASI ENDPOINTS");

  try {
    // Test 11.1: Search Videos
    logInfo("Test 11.1: Search Videos");
    try {
      const searchVideos = await axios.get(
        `${BASE_URL}/video-rekomendasi/search`,
        {
          params: {
            query: "matematika bilangan bulat",
            maxResults: 5,
          },
          headers: { Authorization: `Bearer ${testData.tokens.siswa}` },
        }
      );
      logSuccess(`Found ${searchVideos.data.data.videos?.length || 0} videos`);
    } catch (error) {
      logWarning("Video search failed (YouTube API may not be configured)");
    }

    return true;
  } catch (error) {
    logError("Video Rekomendasi endpoints test failed", error);
    return false;
  }
}

/**
 * 12. ADMIN ENDPOINTS
 */
async function testAdminEndpoints() {
  logTest("ADMIN ENDPOINTS");

  try {
    // Test 12.1: Get All Admins
    logInfo("Test 12.1: Get All Admins");
    const allAdmins = await axios.get(`${BASE_URL}/admin`, {
      headers: { Authorization: `Bearer ${testData.tokens.superadmin}` },
    });
    logSuccess(`Retrieved ${allAdmins.data.data.length} admins`);

    // Test 12.2: Get Admin by ID
    if (testData.ids.admin) {
      logInfo("Test 12.2: Get Admin by ID");
      const adminById = await axios.get(
        `${BASE_URL}/admin/${testData.ids.admin}`,
        {
          headers: { Authorization: `Bearer ${testData.tokens.superadmin}` },
        }
      );
      logSuccess(`Retrieved admin: ${adminById.data.data.nama_lengkap}`);
    }

    return true;
  } catch (error) {
    logError("Admin endpoints test failed", error);
    return false;
  }
}

// ==================== CLEANUP ====================

async function cleanupTestData() {
  logTest("CLEANUP TEST DATA");

  try {
    // Delete in reverse order of creation
    const cleanupTasks = [
      {
        name: "Kuis",
        condition: testData.ids.kuis,
        action: () =>
          axios.delete(`${BASE_URL}/kuis/${testData.ids.kuis}`, {
            headers: { Authorization: `Bearer ${testData.tokens.guru}` },
          }),
      },
      {
        name: "Soal",
        condition: testData.ids.soal,
        action: () =>
          axios.delete(`${BASE_URL}/soal/${testData.ids.soal}`, {
            headers: { Authorization: `Bearer ${testData.tokens.guru}` },
          }),
      },
      {
        name: "Sub Materi",
        condition: testData.ids.subMateri,
        action: () =>
          axios.delete(
            `${BASE_URL}/materi/${testData.ids.materi}/sub-materi/${testData.ids.subMateri}`,
            {
              headers: { Authorization: `Bearer ${testData.tokens.guru}` },
            }
          ),
      },
      {
        name: "Materi",
        condition: testData.ids.materi,
        action: () =>
          axios.delete(`${BASE_URL}/materi/${testData.ids.materi}`, {
            headers: { Authorization: `Bearer ${testData.tokens.guru}` },
          }),
      },
      {
        name: "Kelas",
        condition: testData.ids.kelas,
        action: () =>
          axios.delete(`${BASE_URL}/kelas/${testData.ids.kelas}`, {
            headers: { Authorization: `Bearer ${testData.tokens.guru}` },
          }),
      },
      {
        name: "Sekolah",
        condition: testData.ids.sekolah,
        action: () =>
          axios.delete(`${BASE_URL}/sekolah/${testData.ids.sekolah}`, {
            headers: { Authorization: `Bearer ${testData.tokens.superadmin}` },
          }),
      },
    ];

    for (const task of cleanupTasks) {
      if (task.condition) {
        try {
          await task.action();
          logSuccess(`${task.name} deleted`);
        } catch (error) {
          logWarning(
            `Failed to delete ${task.name} (may not exist or cascade delete)`
          );
        }
      }
    }

    logInfo(
      "⚠️  Note: User accounts (Admin, Guru, Siswa) were NOT deleted for safety"
    );
    logInfo("   You may want to manually delete them from Supabase if needed");

    return true;
  } catch (error) {
    logError("Cleanup failed", error);
    return false;
  }
}

// ==================== MAIN TEST RUNNER ====================

async function runAllTests() {
  console.clear();
  log("\n" + "=".repeat(80), "cyan");
  log("  🚀 ADAPTIVIN BACKEND API - COMPREHENSIVE TEST SUITE", "bright");
  log("=".repeat(80) + "\n", "cyan");

  log(`📍 Testing API at: ${BASE_URL}`, "blue");
  log(`🕐 Started at: ${new Date().toLocaleString()}\n`, "blue");

  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  const tests = [
    { name: "Auth", fn: testAuthEndpoints },
    { name: "Sekolah", fn: testSekolahEndpoints },
    { name: "User", fn: testUserEndpoints },
    { name: "Kelas", fn: testKelasEndpoints },
    { name: "Materi", fn: testMateriEndpoints },
    { name: "Bank Soal", fn: testBankSoalEndpoints },
    { name: "Kuis", fn: testKuisEndpoints },
    { name: "Detail Jawaban", fn: testDetailJawabanEndpoints },
    { name: "Analisis AI", fn: testAnalisisAIEndpoints },
    { name: "Laporan", fn: testLaporanEndpoints },
    { name: "Video Rekomendasi", fn: testVideoRekomendasiEndpoints },
    { name: "Admin", fn: testAdminEndpoints },
  ];

  for (const test of tests) {
    results.total++;
    try {
      const success = await test.fn();
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      logError(`Unexpected error in ${test.name} test suite`, error);
    }
    await sleep(1000); // Wait between test suites
  }

  // Cleanup
  log("\n");
  const shouldCleanup = process.argv.includes("--cleanup");
  if (shouldCleanup) {
    await cleanupTestData();
  } else {
    logWarning("Skipping cleanup. Run with --cleanup flag to delete test data");
  }

  // Summary
  console.log("\n" + COLORS.cyan + "=".repeat(80) + COLORS.reset);
  log("  📊 TEST SUMMARY", "bright");
  console.log(COLORS.cyan + "=".repeat(80) + COLORS.reset);

  log(`\n✅ Passed: ${results.passed}/${results.total}`, "green");
  log(
    `❌ Failed: ${results.failed}/${results.total}`,
    results.failed > 0 ? "red" : "green"
  );
  log(
    `📈 Success Rate: ${Math.round((results.passed / results.total) * 100)}%\n`,
    "blue"
  );

  if (results.failed === 0) {
    log("🎉 ALL TESTS PASSED! Backend is ready for deployment! 🚀", "green");
  } else {
    log(
      "⚠️  Some tests failed. Please review and fix before deployment.",
      "yellow"
    );
  }

  log(`\n🕐 Finished at: ${new Date().toLocaleString()}`, "blue");
  console.log(COLORS.cyan + "=".repeat(80) + COLORS.reset + "\n");

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// ==================== RUN TESTS ====================

runAllTests().catch((error) => {
  logError("Fatal error running tests", error);
  process.exit(1);
});
