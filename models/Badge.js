import mongoose from 'mongoose';

const BadgeSchema = new mongoose.Schema({
  // Basic Information
  name: { 
    type: String, 
    required: [true, 'Badge name is required'],
    trim: true,
    maxlength: [50, 'Badge name cannot exceed 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  
  // Visual Representation
  icon: {
    type: String,
    required: [true, 'Icon URL is required'],
    default: 'https://i.imgur.com/default-badge.png'
  },
  iconLocked: {
    type: String,
    required: [true, 'Locked icon URL is required'],
    default: 'https://i.imgur.com/default-badge-locked.png'
  },
  color: {
    type: String,
    default: '#FFD700',
    validate: {
      validator: function(v) {
        return /^#([0-9A-F]{3}){1,2}$/i.test(v);
      },
      message: props => `${props.value} is not a valid hex color!`
    }
  },
  
  // Game Properties
  rarity: { 
    type: String, 
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common',
    required: true
  },
  xpReward: {
    type: Number,
    default: 0,
    min: [0, 'XP reward cannot be negative']
  },
  coinReward: {
    type: Number,
    default: 0,
    min: [0, 'Coin reward cannot be negative']
  },
  
  // Acquisition Criteria
  criteria: {
    metric: {
      type: String,
      required: [true, 'Metric is required'],
      enum: [
        'streak', 
        'totalXP', 
        'completedTasks',
        'completedHabits',
        'gamesPlayed',
        'daysActive',
        'shopPurchases',
        'badgesCollected'
      ]
    },
    threshold: {
      type: Number,
      required: [true, 'Threshold is required'],
      min: [1, 'Threshold must be at least 1']
    },
    gameSpecific: {
      type: String,
      enum: ['word-scrambler', 'spin-wheel', 'habit-challenge', 'cosmic-chess', 'recovery-game', null],
      default: null
    }
  },
  
  // Shop Properties (if purchasable)
  purchasable: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative'],
    required: function() { return this.purchasable; }
  },
  availableFrom: {
    type: Date,
    default: Date.now
  },
  availableUntil: {
    type: Date,
    validate: {
      validator: function(v) {
        return !this.availableUntil || v > this.availableFrom;
      },
      message: 'Available until date must be after available from date'
    }
  },
  
  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  isSecret: {
    type: Boolean,
    default: false
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

// Indexes for faster queries
BadgeSchema.index({ name: 1 }, { unique: true });
BadgeSchema.index({ rarity: 1 });
BadgeSchema.index({ 'criteria.metric': 1 });
BadgeSchema.index({ 'criteria.gameSpecific': 1 });
BadgeSchema.index({ purchasable: 1 });
BadgeSchema.index({ isActive: 1 });

// Virtual for display name with rarity
BadgeSchema.virtual('displayName').get(function() {
  return `[${this.rarity.toUpperCase()}] ${this.name}`;
});

// Virtual for current availability
BadgeSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.isActive && 
    (!this.availableUntil || now <= this.availableUntil);
});

// Static method to find badges by criteria
BadgeSchema.statics.findByCriteria = async function(metric, threshold, gameSpecific = null) {
  return this.find({
    'criteria.metric': metric,
    'criteria.threshold': { $lte: threshold },
    ...(gameSpecific && { 'criteria.gameSpecific': gameSpecific })
  });
};

// Static method to check if user qualifies for badge
BadgeSchema.statics.checkUserQualification = async function(userId, badgeId) {
  const badge = await this.findById(badgeId);
  const user = await User.findById(userId).select('gameStats');
  
  if (!badge || !user) return false;
  
  let progress;
  switch(badge.criteria.metric) {
    case 'streak':
      progress = user.gameStats.currentStreak || 0;
      break;
    case 'totalXP':
      progress = user.gameStats.totalXP || 0;
      break;
    case 'completedTasks':
      progress = user.gameStats.completedTasks || 0;
      break;
    case 'completedHabits':
      progress = user.gameStats.completedHabits || 0;
      break;
    case 'gamesPlayed':
      progress = user.gameStats.gamesPlayed?.[badge.criteria.gameSpecific]?.playCount || 0;
      break;
    case 'daysActive':
      progress = user.gameStats.daysActive || 0;
      break;
    default:
      progress = 0;
  }
  
  return progress >= badge.criteria.threshold;
};

// Pre-save hook to validate purchasable badges
BadgeSchema.pre('save', function(next) {
  if (this.purchasable && this.price <= 0) {
    throw new Error('Purchasable badges must have a positive price');
  }
  next();
});

const Badge = mongoose.model('Badge', BadgeSchema);

export default Badge;