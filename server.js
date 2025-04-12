import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Routes - IMPORTANT: Case must match exactly with filenames
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import localStorageRoutes from './routes/LocalStorageRoutes.js'; // Note uppercase 'L' and 'S'
import spinWheelRoutes from './routes/spinWheelRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined');
  process.exit(1);
}

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

// Health check
app.get('/api', (req, res) => {
  res.json({ status: 'API running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/local-storage', localStorageRoutes);
app.use('/api/spin-wheel', spinWheelRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Error handling
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

// Start server
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
