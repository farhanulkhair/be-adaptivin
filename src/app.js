import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import kelasRoutes from './routes/kelasRoutes.js';
import sekolahRoutes from './routes/sekolahRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kelas', kelasRoutes);
app.use('/api/sekolah', sekolahRoutes);

export default app;
