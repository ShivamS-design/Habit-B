import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const UserSchema = new mongoose.Schema({
  // Authentication Fields
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true, // This automatically creates an index
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  password: {
    type: String,
    select: false
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true // This automatically creates an index
  },
  provider: {
    type: String,
    enum: ['email', 'google', 'apple'],
    default: 'email'
  },

  // Profile Information
  avatar: {
    type: String,
    default: 'https://i.imgur.com/JSW6mEx.png'
  },
  bio: {
    type: String,
    maxlength: [200, 'Bio cannot be more than 200 characters']
  },

  // Gamification System
  xp: {
    type: Number,
    default: 0,
    min: [0, 'XP cannot be negative']
  },
  level: {
    type: Number,
    default: 1,
    min: [1, 'Level cannot be less than 1']
  },
  coins: {
    type: Number,
    default: 0,
    min: [0, 'Coins cannot be negative']
  },

  // Game Statistics
  gameStats: {
    totalXP: {
      type: Number,
      default: 0,
      min: [0, 'Total XP cannot be negative']
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    achievements: [{
      type: String,
      default: []
    }],
    badges: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge'
    }],
    gamesPlayed: {
      type: Map,
      of: {
        playCount: Number,
        lastPlayed: Date,
        highScore: Number
      },
      default: {}
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  },

  // Habit Tracking
  habits: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Habit'
  }],

  // Shop & Inventory
  inventory: {
    badges: [{
      badge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge'
      },
      unlockedAt: Date
    }],
    powerups: [{
      item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShopItem'
      },
      quantity: Number,
      expiresAt: Date
    }],
    cosmetics: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopItem'
    }]
  },

  // Settings & Preferences
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'dark'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      profileVisible: {
        type: Boolean,
        default: true
      },
      activityVisible: {
        type: Boolean,
        default: true
      }
    }
  },

  // System Fields
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for next level XP
UserSchema.virtual('nextLevelXP').get(function() {
  return this.level * 100;
});

// Virtual for XP progress percentage
UserSchema.virtual('xpProgress').get(function() {
  return Math.min((this.xp % 100) / 100 * 100, 100);
});

// Removed duplicate index definitions - they're already created by 'unique: true' in the schema

// Only keep additional indexes that aren't covered by schema definitions
UserSchema.index({ xp: -1 }); // For leaderboard queries
UserSchema.index({ 'gameStats.totalXP': -1 }); // For global ranking

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

// Pre-save hook for passwordChangedAt
UserSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000; // Ensure token is created after
  next();
});

// Method to check if password was changed after token was issued
UserSchema.methods.passwordChangedAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to check password
UserSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to create password reset token
UserSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Method to add XP
UserSchema.methods.addXP = async function(amount) {
  if (amount <= 0) return this;
  
  this.xp += amount;
  this.gameStats.totalXP += amount;
  
  const newLevel = Math.floor(this.xp / 100) + 1;
  if (newLevel > this.level) {
    this.level = newLevel;
    // Add level-up rewards or notifications if needed
  }
  
  await this.save();
  return this;
};

// Method to check badge progress
UserSchema.methods.checkBadgeProgress = function(badge) {
  if (!badge?.progressMetric) return 0;
  
  const progressMetrics = {
    daysActive: this.gameStats.daysActive || 0,
    currentStreak: this.gameStats.currentStreak,
    totalXP: this.gameStats.totalXP,
    earlyTasks: this.gameStats.earlyTasks || 0,
    nightTasks: this.gameStats.nightTasks || 0,
    longtermHabits: this.gameStats.longtermHabits || 0,
    completedTasks: this.gameStats.completedTasks || 0,
    meditationCount: this.gameStats.meditationCount || 0
  };

  return progressMetrics[badge.progressMetric] || 0;
};

// Method to purchase item
UserSchema.methods.purchaseItem = async function(item, cost) {
  if (!item || cost === undefined) {
    throw new Error('Invalid item or cost');
  }

  if (this.coins < cost) {
    throw new Error('Not enough coins');
  }

  this.coins -= cost;
  
  // Add to inventory based on item type
  switch(item.type) {
    case 'badge':
      this.inventory.badges.push({
        badge: item._id,
        unlockedAt: new Date()
      });
      break;
    case 'powerup':
      const existingPowerup = this.inventory.powerups.find(p => p.item.equals(item._id));
      if (existingPowerup) {
        existingPowerup.quantity += 1;
      } else {
        this.inventory.powerups.push({
          item: item._id,
          quantity: 1,
          expiresAt: item.duration ? new Date(Date.now() + item.duration * 1000) : null
        });
      }
      break;
    case 'cosmetic':
      if (!this.inventory.cosmetics.some(c => c.equals(item._id))) {
        this.inventory.cosmetics.push(item._id);
      }
      break;
    default:
      throw new Error('Invalid item type');
  }

  await this.save();
  return this;
};

const User = mongoose.model('User', UserSchema);

export default User;
