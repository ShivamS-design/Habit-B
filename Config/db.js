import mongoose from 'mongoose';
import User from '../models/User.js';
import Habit from '../models/habit.js';
import Task from '../models/Task.js';
import GameProgress from '../models/GameProgress.js';
import LocalData from '../models/LocalData.js';
import Badge from '../models/Badge.js';
import ShopItem from '../models/ShopItem.js';
import AppError from '../utils/appError.js';

// Configuration
const MONGO_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
  poolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
};

const connectDB = async () => {
  try {
    // Create connection
    const conn = await mongoose.connect(process.env.MONGODB_URI, MONGO_OPTIONS);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize models and indexes
    await initializeDatabase();
    
    // Set up connection event handlers
    setupConnectionHandlers();
    
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

const initializeDatabase = async () => {
  try {
    // Create indexes in background
    await Promise.all([
      User.init(),
      Habit.init(),
      Task.init(),
      GameProgress.init(),
      LocalData.init(),
      Badge.init(),
      ShopItem.init()
    ]);
    
    console.log('All indexes created successfully');
    
    // Apply database migrations if needed
    if (process.env.RUN_MIGRATIONS === 'true') {
      await runMigrations();
    }
    
  } catch (error) {
    console.error('Index creation error:', error);
    throw new AppError('Database initialization failed', 500);
  }
};

const setupConnectionHandlers = () => {
  mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to DB');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`Mongoose connection error: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('Mongoose disconnected from DB');
  });

  // Close connection on app termination
  process.on('SIGINT', gracefulShutdown)
    .on('SIGTERM', gracefulShutdown);
};

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, closing MongoDB connection...`);
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

const runMigrations = async () => {
  try {
    console.log('Running database migrations...');
    
    // Example migration: Add default badges if none exist
    const badgeCount = await Badge.countDocuments();
    if (badgeCount === 0) {
      await seedDefaultBadges();
    }
    
    // Add other migrations as needed
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

const seedDefaultBadges = async () => {
  const defaultBadges = [
    {
      name: 'First Steps',
      description: 'Complete your first habit',
      icon: 'badge-first-steps.png',
      rarity: 'common',
      xpReward: 10,
      criteria: {
        metric: 'completedHabits',
        threshold: 1
      }
    },
    {
      name: 'Task Master',
      description: 'Complete 10 tasks',
      icon: 'badge-task-master.png',
      rarity: 'uncommon',
      xpReward: 25,
      criteria: {
        metric: 'completedTasks',
        threshold: 10
      }
    }
  ];
  
  await Badge.insertMany(defaultBadges);
  console.log('Default badges seeded');
};

export {
  connectDB,
  mongoose,
  gracefulShutdown
};