import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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

// Initialize app
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// =============================================
// ADDED: Fallback error handler if errorMiddleware.js is missing
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
// =============================================

// Constants
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Database Connection (unchanged)
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false
    });
    console.log('MongoDB connected successfully');
    
    await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.db.collection('gameprogress').createIndex({ userId: 1, gameId: 1 }, { unique: true });
    
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Security Middleware (unchanged)
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());
app.use(cookieParser());

// Rate limiting (unchanged)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api', limiter);

// Body parser (unchanged)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Static files (unchanged)
app.use(express.static(path.join(__dirname, 'public')));

// CORS (unchanged)
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

// Logging (unchanged)
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check (unchanged)
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes (unchanged)
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

// =============================================
// IMPROVED: 404 Handler with route debugging
app.all('*', (req, res, next) => {
  const err = new Error(`Route ${req.originalUrl} not found`);
  err.statusCode = 404;
  err.isOperational = true;
  
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Missing route: ${req.method} ${req.originalUrl}`);
  }
  
  next(err);
});
// =============================================

// Error handling middleware (now uses our fallback)
app.use(errorHandler);

// Server startup (unchanged)
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
  });
};

// Error handlers (unchanged)
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

startServer();

export default app;
