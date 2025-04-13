import mongoose from 'mongoose';
import AppError from '../utils/appError.js';

const InventoryItemSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  description: {
    type: String,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },

  // Item Classification
  itemType: {
    type: String,
    required: true,
    enum: ['boost', 'cosmetic', 'powerup', 'currency', 'badge', 'consumable'],
    index: true
  },
  category: {
    type: String,
    enum: ['xp_boost', 'streak_protection', 'avatar', 'theme', 'currency_pack', 'other'],
    default: 'other'
  },

  // Visual Representation
  icon: {
    type: String,
    default: 'default-item.png'
  },
  iconLocked: {
    type: String,
    default: 'default-item-locked.png'
  },
  color: {
    type: String,
    default: '#FFFFFF',
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
    index: true
  },
  value: {
    type: Number,
    default: 0,
    min: 0
  },

  // Item Effects
  effects: {
    xpMultiplier: {
      type: Number,
      min: 1,
      max: 3
    },
    duration: { // in hours
      type: Number,
      min: 1
    },
    streakProtection: {
      type: Boolean,
      default: false
    },
    customEffect: mongoose.Schema.Types.Mixed
  },

  // Inventory Properties
  stackable: {
    type: Boolean,
    default: false
  },
  maxStack: {
    type: Number,
    default: 1,
    min: 1,
    validate: {
      validator: function(v) {
        return !this.stackable || v > 1;
      },
      message: 'Stackable items must have maxStack > 1'
    }
  },
  consumable: {
    type: Boolean,
    default: true
  },

  // System Fields
  isActive: {
    type: Boolean,
    default: true,
    index: true
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

// Indexes
InventoryItemSchema.index({ name: 1 }, { unique: true });
InventoryItemSchema.index({ itemType: 1, rarity: 1 });

// Virtual Properties
InventoryItemSchema.virtual('displayName').get(function() {
  return `${this.name} [${this.rarity.toUpperCase()}]`;
});

InventoryItemSchema.virtual('isBoost').get(function() {
  return this.itemType === 'boost';
});

InventoryItemSchema.virtual('expiresAt').get(function() {
  return this.effects?.duration 
    ? new Date(Date.now() + this.effects.duration * 60 * 60 * 1000)
    : null;
});

// Pre-save hooks
InventoryItemSchema.pre('save', function(next) {
  // Auto-set category based on item type if not specified
  if (!this.category || this.category === 'other') {
    if (this.itemType === 'boost') {
      this.category = 'xp_boost';
    } else if (this.itemType === 'powerup') {
      this.category = 'streak_protection';
    } else if (this.itemType === 'cosmetic') {
      this.category = 'theme';
    }
  }

  // Validate boost items have multiplier
  if (this.itemType === 'boost' && !this.effects?.xpMultiplier) {
    throw new AppError('Boost items must have an XP multiplier', 400);
  }
  
  next();
});

// Static Methods
InventoryItemSchema.statics.getByType = async function(itemType, limit = 20) {
  return this.find({ itemType, isActive: true })
    .limit(limit)
    .sort('-rarity -createdAt');
};

InventoryItemSchema.statics.getActiveBoosts = async function() {
  return this.find({ 
    itemType: 'boost',
    isActive: true,
    'effects.xpMultiplier': { $exists: true }
  });
};

// Instance Methods
InventoryItemSchema.methods.applyEffect = async function(userId) {
  const User = mongoose.model('User');
  
  if (this.itemType === 'boost' && this.effects.xpMultiplier) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        'gameStats.activeBoosts': {
          itemId: this._id,
          multiplier: this.effects.xpMultiplier,
          expiresAt: new Date(Date.now() + this.effects.duration * 60 * 60 * 1000)
        }
      }
    });
  }
  
  if (this.itemType === 'powerup' && this.effects.streakProtection) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        'gameStats.streakProtection': {
          itemId: this._id,
          expiresAt: new Date(Date.now() + this.effects.duration * 60 * 60 * 1000)
        }
      }
    });
  }
  
  return this;
};

InventoryItemSchema.methods.toInventoryObject = function() {
  return {
    item: this._id,
    quantity: 1,
    expiresAt: this.effects?.duration 
      ? new Date(Date.now() + this.effects.duration * 60 * 60 * 1000)
      : null
  };
};

const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);

export default InventoryItem;
