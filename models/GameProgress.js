import mongoose from 'mongoose';
import AppError from '../utils/appError.js';

const GameProgressSchema = new mongoose.Schema({
  // Core Identification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Progress must belong to a user'],
    index: true
  },
  gameId: {
    type: String,
    required: [true, 'Game ID is required'],
    enum: ['word-scrambler', 'spin-wheel', 'habit-challenge', 'cosmic-chess', 'recovery-game'],
    index: true
  },

  // Game State Management
  progressData: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Progress data is required'],
    validate: {
      validator: function(v) {
        try {
          return JSON.stringify(v).length <= 50000; // 50KB max
        } catch (e) {
          return false;
        }
      },
      message: 'Progress data must be serializable and cannot exceed 50KB'
    }
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Level must be an integer'
    }
  },
  checkpoints: [{
    level: {
      type: Number,
      min: 1,
      required: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function(v) {
          try {
            return JSON.stringify(v).length <= 25000; // 25KB max per checkpoint
          } catch (e) {
            return false;
          }
        },
        message: 'Checkpoint data must be serializable and cannot exceed 25KB'
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Performance Metrics
  xpEarned: {
    type: Number,
    default: 0,
    min: 0,
    get: v => Math.round(v)
  },
  playTime: { // in seconds
    type: Number,
    default: 0,
    min: 0,
    get: v => Math.round(v)
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
    max: 100,
    get: v => Math.round(v)
  },

  // Game Analytics
  sessionHistory: [{
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function(v) {
          return v >= this.startTime;
        },
        message: 'End time must be after start time'
      }
    },
    duration: { // in seconds
      type: Number,
      min: 0,
      get: v => Math.round(v)
    },
    actions: {
      type: Number,
      min: 0
    },
    xpEarned: {
      type: Number,
      min: 0
    },
    completed: Boolean
  }],
  achievementHistory: [{
    achievementId: {
      type: String,
      required: true
    },
    earnedAt: {
      type: Date,
      default: Date.now
    },
    xpReward: {
      type: Number,
      min: 0
    }
  }],
  inventorySnapshot: {
    type: mongoose.Schema.Types.Mixed,
    validate: {
      validator: function(v) {
        try {
          return JSON.stringify(v).length <= 10000; // 10KB max
        } catch (e) {
          return false;
        }
      },
      message: 'Snapshot data must be serializable and cannot exceed 10KB'
    }
  },

  // Version Control
  gameVersion: {
    type: String,
    required: [true, 'Game version is required'],
    match: [/^\d+\.\d+\.\d+$/, 'Version must be in semantic format (X.Y.Z)']
  },
  dataVersion: {
    type: Number,
    default: 1,
    min: 1
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
  toJSON: { 
    virtuals: true,
    getters: true 
  },
  toObject: { 
    virtuals: true,
    getters: true 
  }
});

// Indexes for optimized queries
GameProgressSchema.index({ userId: 1, gameId: 1 }, { unique: true });
GameProgressSchema.index({ gameId: 1, 'achievementHistory.achievementId': 1 });
GameProgressSchema.index({ 'sessionHistory.endTime': -1 });
GameProgressSchema.index({ xpEarned: -1 });
GameProgressSchema.index({ highestScore: -1 });
GameProgressSchema.index({ completionPercentage: -1 });

// Virtual Properties
GameProgressSchema.virtual('totalSessions').get(function() {
  return this.sessionHistory.length;
});

GameProgressSchema.virtual('totalPlayTimeHours').get(function() {
  return parseFloat((this.playTime / 3600).toFixed(2));
});

GameProgressSchema.virtual('averageSessionTime').get(function() {
  return this.totalSessions > 0 
    ? parseFloat((this.playTime / this.totalSessions / 60).toFixed(1))
    : 0;
});

GameProgressSchema.virtual('xpPerHour').get(function() {
  return this.playTime > 0
    ? Math.round((this.xpEarned / this.playTime) * 3600)
    : 0;
});

GameProgressSchema.virtual('lastSession').get(function() {
  return this.sessionHistory.length > 0 
    ? this.sessionHistory[this.sessionHistory.length - 1]
    : null;
});

// Pre-save hooks
GameProgressSchema.pre('save', function(next) {
  // Auto-calculate completion percentage if not set
  if (this.progressData?.levels && !this.isModified('completionPercentage')) {
    const levels = this.progressData.levels;
    const completedLevels = Object.values(levels).filter(l => l.completed).length;
    this.completionPercentage = Math.round((completedLevels / Object.keys(levels).length) * 100);
  }

  // Update highest score if applicable
  if (this.progressData?.score > this.highestScore) {
    this.highestScore = this.progressData.score;
  }

  // Auto-set sync timestamp
  if (this.isModified('progressData') || this.isModified('currentLevel')) {
    this.lastSynced = new Date();
  }

  next();
});

// Instance Methods
GameProgressSchema.methods.addSession = function(sessionData) {
  const duration = sessionData.duration || 
    Math.round((sessionData.endTime - sessionData.startTime) / 1000);

  this.sessionHistory.push({
    startTime: sessionData.startTime || new Date(Date.now() - (duration * 1000)),
    endTime: sessionData.endTime || new Date(),
    duration,
    actions: sessionData.actions || 0,
    xpEarned: sessionData.xpEarned || 0,
    completed: sessionData.completed || false
  });

  this.playTime += duration;
  this.xpEarned += sessionData.xpEarned || 0;
  
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
  try {
    this.checkpoints.push({
      level: this.currentLevel,
      data: JSON.parse(JSON.stringify(this.progressData)) // Deep clone
    });
    
    // Keep only the last 5 checkpoints
    if (this.checkpoints.length > 5) {
      this.checkpoints.shift();
    }
    
    return this.save();
  } catch (err) {
    throw new AppError('Failed to create checkpoint: Invalid progress data', 400);
  }
};

GameProgressSchema.methods.restoreCheckpoint = function(checkpointIndex = -1) {
  const index = checkpointIndex >= 0 
    ? Math.min(checkpointIndex, this.checkpoints.length - 1)
    : this.checkpoints.length - 1;
    
  if (index >= 0) {
    this.progressData = JSON.parse(JSON.stringify(this.checkpoints[index].data));
    this.currentLevel = this.checkpoints[index].level;
    this.syncStatus = 'pending';
    return this.save();
  }
  
  throw new AppError('No checkpoint available', 404);
};

// Static Methods
GameProgressSchema.statics.getUserProgress = async function(userId, gameId) {
  return this.findOne({ userId, gameId })
    .populate('userId', 'name avatar level')
    .lean({ virtuals: true });
};

GameProgressSchema.statics.getLeaderboard = async function(gameId, limit = 10) {
  return this.aggregate([
    { $match: { gameId, isActive: true } },
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
  const results = await this.aggregate([
    { $match: { gameId, isActive: true } },
    {
      $group: {
        _id: null,
        totalPlayers: { $sum: 1 },
        averageXp: { $avg: '$xpEarned' },
        averagePlayTime: { $avg: '$playTime' },
        averageCompletion: { $avg: '$completionPercentage' },
        topScore: { $max: '$highestScore' },
        totalSessions: { $sum: { $size: '$sessionHistory' } }
      }
    },
    {
      $project: {
        _id: 0,
        totalPlayers: 1,
        averageXp: { $round: ['$averageXp', 1] },
        averagePlayTimeHours: { $round: [{ $divide: ['$averagePlayTime', 3600] }, 1] },
        averageCompletion: { $round: ['$averageCompletion', 1] },
        topScore: 1,
        sessionsPerPlayer: { $round: [{ $divide: ['$totalSessions', '$totalPlayers'] }, 1] }
      }
    }
  ]);

  return results[0] || null;
};

const GameProgress = mongoose.model('GameProgress', GameProgressSchema);

export default GameProgress;
