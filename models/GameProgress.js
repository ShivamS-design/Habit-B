import mongoose from 'mongoose';
import AppError from '../utils/appError.js';

const GameProgressSchema = new mongoose.Schema({
  // Core Identification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Progress must belong to a user']
    // Removed index: true here since we have compound index below
  },
  gameId: {
    type: String,
    required: [true, 'Game ID is required'],
    enum: ['word-scrambler', 'spin-wheel', 'habit-challenge', 'cosmic-chess', 'recovery-game']
    // Removed index: true here since we have compound index below
  },

  // Game State Management
  progressData: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Progress data is required'],
    validate: {
      validator: function(v) {
        return JSON.stringify(v).length <= 50000; // 50KB max
      },
      message: 'Progress data exceeds maximum size'
    }
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1
  },
  checkpoints: [{
    level: Number,
    data: mongoose.Schema.Types.Mixed,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Performance Metrics
  xpEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  playTime: { // in seconds
    type: Number,
    default: 0,
    min: 0
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0
  },
  highestScore: {
    type: Number,
    default: 0
  },
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Game Analytics
  sessionHistory: [{
    startTime: Date,
    endTime: Date,
    duration: Number, // in seconds
    actions: Number,
    xpEarned: Number,
    completed: Boolean
  }],
  achievementHistory: [{
    achievementId: String,
    earnedAt: Date,
    xpReward: Number
  }],
  inventorySnapshot: mongoose.Schema.Types.Mixed,

  // Version Control
  gameVersion: {
    type: String,
    required: [true, 'Game version is required']
  },
  dataVersion: {
    type: Number,
    default: 1
  },

  // Synchronization
  lastSynced: Date,
  syncStatus: {
    type: String,
    enum: ['in-sync', 'pending', 'conflict'],
    default: 'in-sync'
  },

  // System Fields
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Optimized Indexes
GameProgressSchema.index({ userId: 1, gameId: 1 }, { unique: true }); // Compound primary key
GameProgressSchema.index({ 'achievementHistory.achievementId': 1 });
GameProgressSchema.index({ 'sessionHistory.endTime': -1 });
GameProgressSchema.index({ xpEarned: -1 }); // For leaderboards
GameProgressSchema.index({ highestScore: -1 }); // For leaderboards

// Virtual Properties
GameProgressSchema.virtual('totalSessions').get(function() {
  return this.sessionHistory.length;
});

GameProgressSchema.virtual('totalPlayTimeHours').get(function() {
  return (this.playTime / 3600).toFixed(1);
});

GameProgressSchema.virtual('averageSessionTime').get(function() {
  return this.totalSessions > 0 
    ? (this.playTime / this.totalSessions / 60).toFixed(1)
    : 0;
});

GameProgressSchema.virtual('xpPerHour').get(function() {
  return this.playTime > 0
    ? Math.round((this.xpEarned / this.playTime) * 3600)
    : 0;
});

// Pre-save hooks
GameProgressSchema.pre('save', function(next) {
  // Auto-calculate completion percentage if not set
  if (this.progressData?.levels) {
    const completedLevels = Object.values(this.progressData.levels)
      .filter(level => level.completed).length;
    this.completionPercentage = Math.round(
      (completedLevels / Object.keys(this.progressData.levels).length) * 100
    );
  }

  // Update highest score if applicable
  if (this.progressData?.score > this.highestScore) {
    this.highestScore = this.progressData.score;
  }

  next();
});

// Instance Methods
GameProgressSchema.methods.addSession = function(sessionData) {
  this.sessionHistory.push({
    startTime: sessionData.startTime || new Date(Date.now() - (sessionData.duration * 1000)),
    endTime: new Date(),
    duration: sessionData.duration,
    actions: sessionData.actions || 0,
    xpEarned: sessionData.xpEarned || 0,
    completed: sessionData.completed || false
  });

  this.playTime += sessionData.duration;
  return this.save();
};

GameProgressSchema.methods.addAchievement = function(achievementId, xpReward = 0) {
  this.achievementHistory.push({
    achievementId,
    earnedAt: new Date(),
    xpReward
  });
  
  this.xpEarned += xpReward;
  return this.save();
};

GameProgressSchema.methods.createCheckpoint = function() {
  this.checkpoints.push({
    level: this.currentLevel,
    data: JSON.parse(JSON.stringify(this.progressData)) // Deep clone
  });
  
  // Keep only the last 5 checkpoints
  if (this.checkpoints.length > 5) {
    this.checkpoints.shift();
  }
  
  return this.save();
};

GameProgressSchema.methods.restoreCheckpoint = function(checkpointIndex = -1) {
  const index = checkpointIndex >= 0 
    ? Math.min(checkpointIndex, this.checkpoints.length - 1)
    : this.checkpoints.length - 1;
    
  if (index >= 0) {
    this.progressData = JSON.parse(JSON.stringify(this.checkpoints[index].data));
    this.currentLevel = this.checkpoints[index].level;
    return this.save();
  }
  
  throw new AppError('No checkpoint available', 400);
};

// Static Methods
GameProgressSchema.statics.getUserProgress = async function(userId, gameId) {
  return this.findOne({ userId, gameId })
    .populate('userId', 'name avatar level')
    .lean();
};

GameProgressSchema.statics.getLeaderboard = async function(gameId, limit = 10) {
  return this.aggregate([
    { $match: { gameId } },
    { $sort: { highestScore: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: 1,
        highestScore: 1,
        xpEarned: 1,
        completionPercentage: 1,
        'user.name': 1,
        'user.avatar': 1,
        'user.level': 1
      }
    }
  ]);
};

GameProgressSchema.statics.getGameAnalytics = async function(gameId) {
  return this.aggregate([
    { $match: { gameId } },
    {
      $group: {
        _id: null,
        totalPlayers: { $sum: 1 },
        averageXp: { $avg: '$xpEarned
