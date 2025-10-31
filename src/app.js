import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import kelasRoutes from './routes/kelasRoutes.js';
import sekolahRoutes from './routes/sekolahRoutes.js';

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000", // asal frontend kamu
    credentials: true, // agar cookie / Authorization bisa dikirim
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200, // penting untuk browser lama
  })
);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/kelas', kelasRoutes);
app.use('/api/sekolah', sekolahRoutes);

export default app;
