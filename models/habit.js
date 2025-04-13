import mongoose from 'mongoose';
import AppError from '../utils/appError.js';

const HabitSchema = new mongoose.Schema({
  // Core Habit Properties
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'A habit must belong to a user'] 
  },
  name: { 
    type: String, 
    required: [true, 'A habit must have a name'],
    trim: true,
    maxlength: [50, 'Habit name cannot exceed 50 characters'],
    minlength: [3, 'Habit name must be at least 3 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },

  // Completion Tracking
  completed: { 
    type: Boolean, 
    default: false 
  },
  completionHistory: [{
    date: { type: Date, default: Date.now },
    notes: String,
    difficulty: Number
  }],
  currentStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  longestStreak: {
    type: Number,
    default: 0,
    min: 0
  },

  // Gamification Properties
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'extreme'],
    default: 'medium',
    required: true
  },
  baseXP: {
    type: Number,
    default: 10,
    min: 1,
    validate: {
      validator: function(v) {
        // Higher difficulty = higher XP
        const difficultyMultipliers = {
          easy: 1,
          medium: 1.5,
          hard: 2,
          extreme: 3
        };
        return v === 10 * difficultyMultipliers[this.difficulty];
      },
      message: 'XP must match difficulty level'
    }
  },
  streakBonus: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Scheduling and Tracking
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  reminder: {
    enabled: Boolean,
    time: String, // HH:MM format
    days: [{
      type: String,
      enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    }]
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  lastCompleted: Date,

  // Social and Sharing
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
HabitSchema.index({ userId: 1 });
HabitSchema.index({ completed: 1 });
HabitSchema.index({ difficulty: 1 });
HabitSchema.index({ currentStreak: -1 });
HabitSchema.index({ lastCompleted: -1 });

// Virtual Properties
HabitSchema.virtual('totalCompletions').get(function() {
  return this.completionHistory.length;
});

HabitSchema.virtual('completionRate').get(function() {
  if (!this.startDate) return 0;
  const daysActive = Math.ceil((Date.now() - this.startDate) / (1000 * 60 * 60 * 24));
  return (this.totalCompletions / daysActive) * 100;
});

HabitSchema.virtual('currentXP').get(function() {
  return this.baseXP + this.streakBonus;
});

HabitSchema.virtual('streakStatus').get(function() {
  if (this.currentStreak >= 21) return 'legendary';
  if (this.currentStreak >= 14) return 'epic';
  if (this.currentStreak >= 7) return 'hot';
  if (this.currentStreak >= 3) return 'warm';
  return 'new';
});

// Pre-save hooks
HabitSchema.pre('save', function(next) {
  // Auto-calculate streak bonus
  this.streakBonus = Math.min(Math.floor(this.currentStreak / 3) * 5, 100);
  next();
});

// Static Methods
HabitSchema.statics.getUserHabits = async function(userId, options = {}) {
  const defaults = {
    activeOnly: true,
    sortBy: '-createdAt',
    limit: 50
  };
  const settings = { ...defaults, ...options };

  const query = { userId };
  if (settings.activeOnly) query.isActive = true;

  return this.find(query)
    .sort(settings.sortBy)
    .limit(settings.limit)
    .populate('sharedWith', 'name avatar');
};

HabitSchema.statics.calculateStreaks = async function(userId) {
  const habits = await this.find({ userId });
  const today = new Date().toISOString().split('T')[0];

  for (const habit of habits) {
    const lastCompletion = habit.completionHistory.slice(-1)[0];
    const lastDate = lastCompletion?.date.toISOString().split('T')[0];

    if (lastDate === today) {
      habit.currentStreak += 1;
      habit.longestStreak = Math.max(habit.currentStreak, habit.longestStreak);
    } else {
      habit.currentStreak = 0;
    }

    await habit.save();
  }
};

// Instance Methods
HabitSchema.methods.complete = async function(notes = '', difficulty = 3) {
  this.completed = true;
  this.lastCompleted = new Date();
  this.completionHistory.push({ notes, difficulty });

  // Streak calculation
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasCompletedYesterday = this.completionHistory.some(
    entry => entry.date.toDateString() === yesterday.toDateString()
  );

  this.currentStreak = wasCompletedYesterday ? this.currentStreak + 1 : 1;
  this.longestStreak = Math.max(this.currentStreak, this.longestStreak);

  await this.save();
  return this;
};

HabitSchema.methods.addReminder = function(time, days) {
  this.reminder = {
    enabled: true,
    time,
    days: days || ['mon', 'tue', 'wed', 'thu', 'fri']
  };
  return this.save();
};

const Habit = mongoose.model('Habit', HabitSchema);

export default Habit;