import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import AppError from '../utils/appError.js';

// Password strength regex (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const UserSchema = new mongoose.Schema({
  // Authentication Fields
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
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
    select: false,
    minlength: [8, 'Password must be at least 8 characters'],
    validate: {
      validator: function(v) {
        return PASSWORD_REGEX.test(v);
      },
      message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character'
    }
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
    validate: {
      validator: (v) => v.length >= 8 && v.length <= 128,
      message: 'Firebase UID must be 8-128 characters'
    }
  },
  provider: {
    type: String,
    enum: ['email', 'google', 'apple', 'facebook'],
    default: 'email'
  },

  // Profile Information
  avatar: {
    type: String,
    default: 'https://i.imgur.com/JSW6mEx.png',
    validate: {
      validator: (v) => {
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Avatar must be a valid URL'
    }
  },
  bio: {
    type: String,
    maxlength: [200, 'Bio cannot exceed 200 characters'],
    default: ''
  },

  // Gamification System
  xp: {
    type: Number,
    default: 0,
    min: [0, 'XP cannot be negative'],
    get: v => Math.floor(v)
  },
  level: {
    type: Number,
    default: 1,
    min: [1, 'Level cannot be less than 1'],
    max: [100, 'Level cannot exceed 100']
  },
  coins: {
    type: Number,
    default: 0,
    min: [0, 'Coins cannot be negative'],
    get: v => Math.floor(v)
  },
  gems: {
    type: Number,
    default: 0,
    min: [0, 'Gems cannot be negative'],
    get: v => Math.floor(v)
  },

  // Game Statistics
  gameStats: {
    totalXP: {
      type: Number,
      default: 0,
      min: [0, 'Total XP cannot be negative'],
      get: v => Math.floor(v)
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: [0, 'Streak cannot be negative']
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: [0, 'Streak cannot be negative']
    },
    daysActive: {
      type: Number,
      default: 0,
      min: [0, 'Days active cannot be negative']
    },
    completedTasks: {
      type: Number,
      default: 0,
      min: [0, 'Completed tasks cannot be negative']
    },
    completedHabits: {
      type: Number,
      default: 0,
      min: [0, 'Completed habits cannot be negative']
    },
    shopPurchases: {
      type: Number,
      default: 0,
      min: [0, 'Purchase count cannot be negative']
    },
    activeBoosts: {
      itemId: mongoose.Schema.Types.ObjectId,
      multiplier: {
        type: Number,
        min: 1,
        max: 3
      },
      expiresAt: Date
    },
    streakProtection: {
      itemId: mongoose.Schema.Types.ObjectId,
      expiresAt: Date
    },
    gamesPlayed: {
      wordScrambler: {
        playCount: {
          type: Number,
          default: 0,
          min: 0
        },
        lastPlayed: Date,
        highScore: {
          type: Number,
          default: 0,
          min: 0
        }
      },
      spinWheel: {
        playCount: {
          type: Number,
          default: 0,
          min: 0
        },
        lastPlayed: Date,
        highScore: {
          type: Number,
          default: 0,
          min: 0
        }
      },
      // Add other games as needed
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  },

  // Inventory
  inventory: {
    badges: [{
      badge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge'
      },
      unlockedAt: {
        type: Date,
        default: Date.now
      }
    }],
    powerups: [{
      item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem'
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1
      },
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
      },
      inApp: {
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
      },
      searchIndexed: {
        type: Boolean,
        default: true
      }
    },
    preferences: {
      language: {
        type: String,
        default: 'en',
        enum: ['en', 'es', 'fr', 'de', 'ja', 'zh']
      },
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  },

  // System Fields
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator', 'support'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    getters: true,
    transform: function(doc, ret) {
      // Remove sensitive fields
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.firebaseUid;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    getters: true 
  }
});

// Indexes
UserSchema.index({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
UserSchema.index({ firebaseUid: 1 }, { unique: true, sparse: true });
UserSchema.index({ 'gameStats.totalXP': -1 }); // Leaderboard
UserSchema.index({ 'gameStats.currentStreak': -1 });
UserSchema.index({ 'inventory.badges.badge': 1 });
UserSchema.index({ 'inventory.powerups.item': 1 });
UserSchema.index({ 'inventory.powerups.expiresAt': 1 });
UserSchema.index({ lastLogin: -1 });

// Virtual Properties
UserSchema.virtual('nextLevelXP').get(function() {
  return Math.pow(this.level, 2) * 100; // Quadratic XP scaling
});

UserSchema.virtual('xpProgress').get(function() {
  const currentLevelXP = Math.pow(this.level - 1, 2) * 100;
  const nextLevelXP = this.nextLevelXP;
  return Math.min(((this.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100, 100);
});

UserSchema.virtual('isPremium').get(function() {
  return this.inventory.cosmetics.some(cosmetic => 
    cosmetic.toString().includes('premium'));
});

// Pre-save hooks
UserSchema.pre('save', async function(next) {
  // Only run if password was modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(new AppError('Password hashing failed', 500));
  }
});

UserSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000; // Ensure token is created after
  next();
});

UserSchema.pre('save', function(next) {
  // Update level if XP threshold crossed
  const potentialLevel = Math.floor(Math.sqrt(this.xp / 100)) + 1;
  if (potentialLevel > this.level) {
    this.level = Math.min(potentialLevel, 100);
  }
  next();
});

// Instance Methods
UserSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.passwordChangedAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

UserSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

UserSchema.methods.createEmailVerificationToken = function() {
  const verifyToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verifyToken)
    .digest('hex');

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verifyToken;
};

UserSchema.methods.addXP = async function(amount) {
  const xpMultiplier = this.gameStats.activeBoosts?.multiplier || 1;
  const adjustedAmount = Math.floor(amount * xpMultiplier);
  
  this.xp += adjustedAmount;
  this.gameStats.totalXP += adjustedAmount;
  
  // Check for level up
  const potentialLevel = Math.floor(Math.sqrt(this.xp / 100)) + 1;
  if (potentialLevel > this.level) {
    this.level = Math.min(potentialLevel, 100);
  }
  
  await this.save();
  return { xpGained: adjustedAmount, levelUp: potentialLevel > this.level };
};

UserSchema.methods.addCoins = async function(amount) {
  this.coins += Math.floor(amount);
  await this.save();
  return this.coins;
};

UserSchema.methods.addGems = async function(amount) {
  this.gems += Math.floor(amount);
  await this.save();
  return this.gems;
};

UserSchema.methods.purchaseItem = async function(item, cost) {
  if (this.coins < cost.coins || (cost.gems && this.gems < cost.gems)) {
    throw new AppError('Insufficient currency', 400);
  }

  this.coins -= cost.coins;
  if (cost.gems) this.gems -= cost.gems;

  // Add to inventory based on item type
  if (item.type === 'badge') {
    this.inventory.badges.push({
      badge: item._id,
      unlockedAt: new Date()
    });
  } else if (item.type === 'powerup') {
    const existing = this.inventory.powerups.find(p => p.item.equals(item._id));
    if (existing) {
      existing.quantity += 1;
    } else {
      this.inventory.powerups.push({
        item: item._id,
        quantity: 1,
        expiresAt: item.effects?.duration ? 
          new Date(Date.now() + item.effects.duration * 60 * 60 * 1000) : 
          null
      });
    }
  } else if (item.type === 'cosmetic') {
    if (!this.inventory.cosmetics.some(c => c.equals(item._id))) {
      this.inventory.cosmetics.push(item._id);
    }
  }

  this.gameStats.shopPurchases += 1;
  await this.save();
  return this;
};

UserSchema.methods.usePowerup = async function(powerupId) {
  const powerup = this.inventory.powerups.find(p => p._id.equals(powerupId));
  if (!powerup) {
    throw new AppError('Powerup not found in inventory', 404);
  }

  powerup.quantity -= 1;
  if (powerup.quantity <= 0) {
    this.inventory.powerups = this.inventory.powerups.filter(p => !p._id.equals(powerupId));
  }

  await this.save();
  return powerup;
};

UserSchema.methods.checkActiveBoosts = async function() {
  const now = new Date();
  let needsUpdate = false;

  // Check XP boost expiration
  if (this.gameStats.activeBoosts?.expiresAt <= now) {
    this.gameStats.activeBoosts = undefined;
    needsUpdate = true;
  }

  // Check streak protection expiration
  if (this.gameStats.streakProtection?.expiresAt <= now) {
    this.gameStats.streakProtection = undefined;
    needsUpdate = true;
  }

  // Check powerup expirations
  this.inventory.powerups = this.inventory.powerups.filter(powerup => {
    if (powerup.expiresAt && powerup.expiresAt <= now) {
      needsUpdate = true;
      return false;
    }
    return true;
  });

  if (needsUpdate) {
    await this.save();
  }
  return this;
};

// Static Methods
UserSchema.statics.findByEmail = async function(email) {
  return this.findOne({ email: new RegExp(`^${email}$`, 'i') });
};

UserSchema.statics.getLeaderboard = async function(limit = 10) {
  return this.aggregate([
    { $match: { isActive: true } },
    { $sort: { 'gameStats.totalXP': -1 } },
    { $limit: limit },
    {
      $project: {
        name: 1,
        avatar: 1,
        level: 1,
        xp: 1,
        'gameStats.totalXP': 1,
        'gameStats.currentStreak': 1,
        'gameStats.longestStreak': 1
      }
    }
  ]);
};

const User = mongoose.model('User', UserSchema);

export default User;
