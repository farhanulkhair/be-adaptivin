import XLSX from "xlsx";
import { supabaseAdmin } from "../config/supabaseAdmin.js";

/**
 * Generate auto password from name (first name + 123)
 */
export const generatePasswordFromName = (namaLengkap) => {
  if (!namaLengkap) return "default123";
  const firstName = namaLengkap.trim().split(" ")[0].toLowerCase();
  return `${firstName}123`;
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate jenis kelamin
 */
export const isValidJenisKelamin = (jenisKelamin) => {
  if (!jenisKelamin) return false;
  const normalized = jenisKelamin.toLowerCase().trim();
  return ["laki-laki", "perempuan", "l", "p"].includes(normalized);
};

/**
 * Normalize jenis kelamin to standard format
 */
export const normalizeJenisKelamin = (jenisKelamin) => {
  if (!jenisKelamin) return null;
  const normalized = jenisKelamin.toLowerCase().trim();
  if (normalized === "l" || normalized === "laki-laki") return "laki-laki";
  if (normalized === "p" || normalized === "perempuan") return "perempuan";
  return null;
};

/**
 * Validate date format (YYYY-MM-DD)
 */
export const isValidDate = (dateString) => {
  if (!dateString) return true; // Optional field
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Check if email exists in database
 */
export const checkEmailExists = async (email) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    return data.users.some((user) => user.email === email);
  } catch (error) {
    console.error("Error checking email:", error);
    return false;
  }
};

/**
 * Check if NIP/NISN exists in database
 */
export const checkIdentifierExists = async (identifier, field) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .select("id")
      .eq(field, identifier)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error(`Error checking ${field}:`, error);
    return false;
  }
};

/**
 * Validate a single row of guru data
 */
export const validateGuruRow = async (row, rowIndex) => {
  const errors = [];

  // Required fields
  if (!row.nama_lengkap?.trim()) {
    errors.push("Nama lengkap wajib diisi");
  }

  if (!row.email?.trim()) {
    errors.push("Email wajib diisi");
  } else if (!isValidEmail(row.email)) {
    errors.push("Format email tidak valid");
  } else if (await checkEmailExists(row.email)) {
    errors.push("Email sudah terdaftar");
  }

  if (!row.nip?.trim()) {
    errors.push("NIP wajib diisi");
  } else if (await checkIdentifierExists(row.nip, "nip")) {
    errors.push("NIP sudah terdaftar");
  }

  if (!row.jenis_kelamin?.trim()) {
    errors.push("Jenis kelamin wajib diisi");
  } else if (!isValidJenisKelamin(row.jenis_kelamin)) {
    errors.push("Jenis kelamin harus 'laki-laki', 'perempuan', 'L', atau 'P'");
  }

  // Optional fields validation
  if (row.tanggal_lahir && !isValidDate(row.tanggal_lahir)) {
    errors.push("Format tanggal lahir tidak valid (gunakan YYYY-MM-DD)");
  }

  return {
    isValid: errors.length === 0,
    errors,
    rowIndex: rowIndex + 2, // +2 because Excel starts at 1 and row 1 is header
  };
};

/**
 * Validate a single row of siswa data
 */
export const validateSiswaRow = async (row, rowIndex) => {
  const errors = [];

  // Required fields
  if (!row.nama_lengkap?.trim()) {
    errors.push("Nama lengkap wajib diisi");
  }

  if (!row.email?.trim()) {
    errors.push("Email wajib diisi");
  } else if (!isValidEmail(row.email)) {
    errors.push("Format email tidak valid");
  } else if (await checkEmailExists(row.email)) {
    errors.push("Email sudah terdaftar");
  }

  if (!row.nisn?.trim()) {
    errors.push("NISN wajib diisi");
  } else if (await checkIdentifierExists(row.nisn, "nisn")) {
    errors.push("NISN sudah terdaftar");
  }

  if (!row.jenis_kelamin?.trim()) {
    errors.push("Jenis kelamin wajib diisi");
  } else if (!isValidJenisKelamin(row.jenis_kelamin)) {
    errors.push("Jenis kelamin harus 'laki-laki', 'perempuan', 'L', atau 'P'");
  }

  // Optional fields validation
  if (row.tanggal_lahir && !isValidDate(row.tanggal_lahir)) {
    errors.push("Format tanggal lahir tidak valid (gunakan YYYY-MM-DD)");
  }

  return {
    isValid: errors.length === 0,
    errors,
    rowIndex: rowIndex + 2, // +2 because Excel starts at 1 and row 1 is header
  };
};

/**
 * Parse Excel/CSV file buffer
 */
export const parseExcelFile = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Generate Excel template for guru
 */
export const generateGuruTemplate = () => {
  const templateData = [
    {
      nama_lengkap: "Ahmad Santoso",
      email: "ahmad.santoso@example.com",
      nip: "198501012010011001",
      jenis_kelamin: "laki-laki",
      tanggal_lahir: "1985-01-01",
      alamat: "Jl. Merdeka No. 10",
    },
    {
      nama_lengkap: "Siti Nurhaliza",
      email: "siti.nurhaliza@example.com",
      nip: "199002022015022001",
      jenis_kelamin: "perempuan",
      tanggal_lahir: "1990-02-02",
      alamat: "Jl. Sudirman No. 20",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template Guru");

  // Set column widths
  worksheet["!cols"] = [
    { wch: 25 }, // nama_lengkap
    { wch: 30 }, // email
    { wch: 20 }, // nip
    { wch: 15 }, // jenis_kelamin
    { wch: 15 }, // tanggal_lahir
    { wch: 30 }, // alamat
  ];

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

/**
 * Generate Excel template for siswa
 */
export const generateSiswaTemplate = () => {
  const templateData = [
    {
      nama_lengkap: "Budi Santoso",
      email: "budi.santoso@example.com",
      nisn: "0012345678",
      jenis_kelamin: "laki-laki",
      tanggal_lahir: "2010-05-15",
      alamat: "Jl. Kenanga No. 5",
    },
    {
      nama_lengkap: "Ani Wijaya",
      email: "ani.wijaya@example.com",
      nisn: "0012345679",
      jenis_kelamin: "perempuan",
      tanggal_lahir: "2010-08-20",
      alamat: "Jl. Melati No. 8",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template Siswa");

  // Set column widths
  worksheet["!cols"] = [
    { wch: 25 }, // nama_lengkap
    { wch: 30 }, // email
    { wch: 15 }, // nisn
    { wch: 15 }, // jenis_kelamin
    { wch: 15 }, // tanggal_lahir
    { wch: 30 }, // alamat
  ];

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

/**
 * Export users to Excel
 */
export const exportUsersToExcel = (users, role) => {
  const exportData = users.map((user) => {
    const baseData = {
      nama_lengkap: user.nama_lengkap || "-",
      email: user.email || "-",
      jenis_kelamin: user.jenis_kelamin || "-",
      tanggal_lahir: user.tanggal_lahir || "-",
      alamat: user.alamat || "-",
      sekolah: user.sekolah?.nama_sekolah || "-",
      kelas: user.kelas?.nama_kelas || "-",
    };

    if (role === "guru") {
      return {
        nip: user.nip || "-",
        ...baseData,
      };
    } else {
      return {
        nisn: user.nisn || "-",
        ...baseData,
      };
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  const sheetName = role === "guru" ? "Data Guru" : "Data Siswa";
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Set column widths
  const columnWidths = [
    { wch: 20 }, // nip/nisn
    { wch: 25 }, // nama_lengkap
    { wch: 30 }, // email
    { wch: 15 }, // jenis_kelamin
    { wch: 15 }, // tanggal_lahir
    { wch: 30 }, // alamat
    { wch: 25 }, // sekolah
    { wch: 15 }, // kelas
  ];
  worksheet["!cols"] = columnWidths;

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

/**
 * Generate credentials export after import
 */
export const generateCredentialsExport = (credentials) => {
  const exportData = credentials.map((cred) => ({
    nama_lengkap: cred.nama_lengkap,
    email: cred.email,
    password: cred.password,
    role: cred.role,
    sekolah: cred.sekolah,
    kelas: cred.kelas,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Credentials");

  // Set column widths
  worksheet["!cols"] = [
    { wch: 25 }, // nama_lengkap
    { wch: 30 }, // email
    { wch: 15 }, // password
    { wch: 10 }, // role
    { wch: 25 }, // sekolah
    { wch: 15 }, // kelas
  ];

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};
