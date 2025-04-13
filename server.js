import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import spinWheelRoutes from './routes/spinWheelRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import localStorageRoutes from './routes/localStorageRoutes.js';
import badgeRoutes from './routes/badgeRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

// Middleware
import { verifyUser } from './middleware/authMiddleware.js';
import errorHandler from './middleware/errorMiddleware.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Initialize app
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Constants
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://standardg0ku31@cluster0.tls8oxo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'yoEPQfVN9qQGubqn';

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,  // 5s timeout
      socketTimeoutMS: 45000           // 45s socket timeout
    });
    console.log('MongoDB connected successfully');
    
    // Automatic index creation
    await Promise.all([
      mongoose.model('User').init(),
      mongoose.model('GameProgress').init()
    ]);
    
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// ======================
// SECURITY MIDDLEWARE
// ======================
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());
app.use(cookieParser());

// Rate limiting
app.use('/api', apiLimiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced CORS
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ======================
// ROUTES
// ======================
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    clientUrl: CLIENT_URL,
    apiBaseUrl: `http://localhost:${PORT}/api/v1`
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', verifyUser, userRoutes);
app.use('/api/v1/habits', verifyUser, habitRoutes);
app.use('/api/v1/tasks', verifyUser, taskRoutes);
app.use('/api/v1/games', verifyUser, gameRoutes);
app.use('/api/v1/spin-wheel', verifyUser, spinWheelRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/local-storage', verifyUser, localStorageRoutes);
app.use('/api/v1/badges', verifyUser, badgeRoutes);
app.use('/api/v1/stats', verifyUser, statsRoutes);

// ======================
// ERROR HANDLING
// ======================
app.all('*', (req, res, next) => {
  const err = new Error(`Route ${req.originalUrl} not found`);
  err.statusCode = 404;
  err.isOperational = true;
  next(err);
});

app.use(errorHandler);

// ======================
// SERVER STARTUP
// ======================
let server; // For graceful shutdown

const startServer = async () => {
  await connectDB();
  
  server = app.listen(PORT, () => {
    console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
    console.log(`Client URL: ${CLIENT_URL}`);
    console.log(`API base URL: http://localhost:${PORT}/api/v1`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
};

// Process event handlers
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection! Shutting down...');
  console.error(err.name, err.message);
  server?.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception! Shutting down...');
  console.error(err.name, err.message);
  server?.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server?.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

startServer();

export default app;
