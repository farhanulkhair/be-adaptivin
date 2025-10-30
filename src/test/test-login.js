import fetch from "node-fetch"; // pastikan sudah install: npm install node-fetch@3
import dotenv from "dotenv";

dotenv.config(); // biar bisa pakai variabel dari .env

const BASE_URL = process.env.API_URL || "http://localhost:5000";
const LOGIN_ENDPOINT = `${BASE_URL}/api/auth/login`;

const testLogin = async () => {
  try {
    // Data login superadmin (pastikan akun ini sudah ada di DB atau dari seed)
    const body = {
      email: "guru@gmail.com",
      password: "Guru123!",
    };

    console.log("🔹 Mengirim request login ke:", LOGIN_ENDPOINT);

    const res = await fetch(LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Gagal login:", data);
      return;
    }

    console.log("✅ Login berhasil!");
    console.log("📦 Response:", data);

    // Kalau kamu ingin menampilkan token-nya saja
    if (data.token) {
      console.log("🔑 JWT Token:", data.token);
    }
  } catch (error) {
    console.error("🚨 Error saat testing login:", error.message);
  }
};

testLogin();
