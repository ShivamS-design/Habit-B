import mongoose from 'mongoose';
import User from './User.js';

const ShopItemSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [50, 'Item name cannot exceed 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [200, 'Description cannot exceed 200 characters']
  },

  // Item Classification
  type: {
    type: String,
    required: [true, 'Item type is required'],
    enum: ['badge', 'powerup', 'cosmetic', 'boost', 'currency_pack'],
    default: 'cosmetic'
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'avatar', 'frame', 'theme', 
      'streak_booster', 'xp_booster', 
      'instant_reward', 'mystery_box'
    ]
  },

  // Visual Representation
  icon: {
    type: String,
    required: [true, 'Icon URL is required'],
    default: 'https://i.imgur.com/default-item.png'
  },
  previewImages: [{
    type: String,
    validate: {
      validator: function(v) {
        return v.length <= 5; // Max 5 preview images
      },
      message: 'Cannot have more than 5 preview images'
    }
  }],
  colorScheme: {
    primary: { type: String, default: '#FFFFFF' },
    secondary: { type: String, default: '#000000' }
  },

  // Game Economy
  price: {
    coins: {
      type: Number,
      default: 0,
      min: [0, 'Coin price cannot be negative']
    },
    gems: {
      type: Number,
      default: 0,
      min: [0, 'Gem price cannot be negative']
    }
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
    default: 'common'
  },

  // Item Effects
  effects: {
    xpBoost: {
      value: { type: Number, min: 0, max: 300 }, // Percentage
      duration: { type: Number, min: 0 } // In hours
    },
    streakProtection: {
      type: Boolean,
      default: false
    },
    rewardMultiplier: {
      type: Number,
      min: 1,
      max: 5
    }
  },

  // Inventory Properties
  stackable: {
    type: Boolean,
    default: false
  },
  maxStack: {
    type: Number,
    default: 1,
    min: 1
  },
  consumable: {
    type: Boolean,
    default: true
  },
  reusable: {
    type: Boolean,
    default: false
  },

  // Availability
  availableFrom: {
    type: Date,
    default: Date.now
  },
  availableUntil: Date,
  limitedEdition: {
    type: Boolean,
    default: false
  },
  stock: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return !this.limitedEdition || v > 0;
      },
      message: 'Limited edition items must have stock'
    }
  },

  // Associated Content
  linkedBadge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge'
  },
  requiredLevel: {
    type: Number,
    default: 1,
    min: 1
  },

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

// Indexes for optimized queries
ShopItemSchema.index({ name: 1 });
ShopItemSchema.index({ type: 1 });
ShopItemSchema.index({ category: 1 });
ShopItemSchema.index({ rarity: 1 });
ShopItemSchema.index({ 'price.coins': 1 });
ShopItemSchema.index({ 'price.gems': 1 });
ShopItemSchema.index({ availableFrom: 1 });
ShopItemSchema.index({ availableUntil: 1 });
ShopItemSchema.index({ isActive: 1 });

// Virtual Properties
ShopItemSchema.virtual('displayName').get(function() {
  return `${this.name} [${this.rarity.toUpperCase()}]`;
});

ShopItemSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.isActive && 
    (!this.availableUntil || now <= this.availableUntil) &&
