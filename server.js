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
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false
    });
    console.log('MongoDB connected successfully');
    
    // Create indexes
    await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.db.collection('gameprogress').createIndex({ userId: 1, gameId: 1 }, { unique: true });
    
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

// Rate limiting (now using centralized config)
app.use('/api', apiLimiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// CORS
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
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
    uptime: process.uptime()
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
const startServer = async () => {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
    console.log(`API docs available at http://localhost:${PORT}/api-docs`);
  });

  // Handle server errors
  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
};

// Process event handlers
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

startServer();

export default app;
