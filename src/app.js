import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// Check environment variables before proceeding
import { checkRequiredEnvVars } from "./utils/checkEnv.js";
try {
  checkRequiredEnvVars();
} catch (error) {
  console.error("❌ Environment check failed:", error.message);
  // On Vercel, this will show in logs
  if (process.env.VERCEL) {
    console.error("\n📌 Vercel Deployment Guide:");
    console.error("1. Go to your project dashboard");
    console.error("2. Navigate to Settings > Environment Variables");
    console.error("3. Add all required variables");
    console.error("4. Redeploy the project\n");
  }
  throw error;
}

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import kelasRoutes from "./routes/kelasRoutes.js";
import sekolahRoutes from "./routes/sekolahRoutes.js";
import materiRoutes from "./routes/materiRoutes.js";
import soalRoutes from "./routes/soalRoutes.js";
import kuisRoutes from "./routes/kuisRoutes.js";
import hasilKuisRoutes from "./routes/hasilKuisRoutes.js";
import detailJawabanRoutes from "./routes/detailJawabanRoutes.js";
import laporanRoutes from "./routes/laporanRoutes.js";
import videoRekomendasiRoutes from "./routes/videoRekomendasiRoutes.js";
import analisisAiRoutes from "./routes/analisisAIRoutes.js";

const app = express();

// CORS configuration with environment variable support
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL, // Frontend production URL
  process.env.ADMIN_URL, // Admin production URL
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use(express.json());

// 🔍 Debug: Log registered routes
console.log("📋 Registering routes...");
app.use("/api/auth", authRoutes);
console.log("✅ /api/auth registered");
app.use("/api/users", userRoutes);
console.log("✅ /api/users registered");
app.use("/api/sekolah", sekolahRoutes);
console.log("✅ /api/sekolah registered");
app.use("/api/kelas", kelasRoutes);
console.log("✅ /api/kelas registered");
app.use("/api/admins", adminRoutes);
console.log("✅ /api/admins registered");
app.use("/api/materi", materiRoutes);
console.log("✅ /api/materi registered");
app.use("/api/soal", soalRoutes);
console.log("✅ /api/soal registered");
app.use("/api/kuis", kuisRoutes);
console.log("✅ /api/kuis registered");
app.use("/api/hasil-kuis", hasilKuisRoutes);
console.log("✅ /api/hasil-kuis registered");
app.use("/api/jawaban", detailJawabanRoutes);
console.log("✅ /api/jawaban registered");
app.use("/api/analisis", analisisAiRoutes);
console.log("✅ /api/analisis registered");
app.use("/api/laporan", laporanRoutes);
console.log("✅ /api/laporan registered");
app.use("/api/video-rekomendasi", videoRekomendasiRoutes);
console.log("✅ /api/video-rekomendasi registered");

// 🔍 Test route untuk verify server berjalan
app.get("/api/test", (req, res) => {
  res.json({
    message: "Server is running!",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler untuk route yang tidak ditemukan
app.use((req, res) => {
  console.log("❌ 404 Not Found:", req.method, req.url);
  res.status(404).json({
    error: "Not Found",
    method: req.method,
    url: req.url,
    availableRoutes: [
      "/api/test",
      "/api/auth/*",
      "/api/users/*",
      "/api/sekolah/*",
      "/api/kelas/*",
      "/api/admins/*",
      "/api/materi/*",
      "/api/soal/*",
      "/api/kuis/*",
      "/api/hasil-kuis/*",
      "/api/jawaban/*",
      "/api/analisis/*",
      "/api/laporan/*",
      "/api/video-rekomendasi/*",
    ],
  });
});

export default app;
