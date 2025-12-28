import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import documentsRouter from './routes/documents.js';
import ptsRouter from './routes/pts.js';
import itsRouter from './routes/its.js';
import settingsRouter from './routes/settings.js';
import authRouter from './routes/authRoutes.js';
import dbInitService from './services/dbInitService.js';
import settingsService from './services/settingsService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'FastITS Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Test endpoint working!',
    data: {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Routes
app.use('/api/documents', documentsRouter);
app.use('/api/pts', ptsRouter);
app.use('/api/its', itsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/auth', authRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Server başlatma ve tabloları hazırlama
async function startServer() {
  try {
    // Veritabanı başlatma (tüm tablolar tek servis ile)
    console.log('📋 Veritabanı tabloları kontrol ediliyor...');
    const dbResult = await dbInitService.initializeDatabase();

    if (!dbResult.success) {
      console.error('⚠️ Veritabanı başlatma hatası:', dbResult.error);
    }

    // Ayarları yükle ve cache'le (bir seferlik)
    console.log('⚙️ Ayarlar yükleniyor...');
    await settingsService.loadSettings();

    // Server'ı başlat
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Server başlatma hatası:', error);
    process.exit(1);
  }
}

startServer();

