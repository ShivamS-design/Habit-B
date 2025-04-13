import mongoose from 'mongoose';

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
    (!this.limitedEdition || this.stock > 0);
});

ShopItemSchema.virtual('discountPercentage').get(function() {
  // Calculate discount if originalPrice is added to the model
  return this.originalPrice ? 
    Math.round((1 - this.price.coins / this.originalPrice.coins) * 100) : 
    0;
});

// Static Methods
ShopItemSchema.statics.getFeaturedItems = async function() {
  return this.find({
    isActive: true,
    availableFrom: { $lte: new Date() },
    $or: [
      { availableUntil: null },
      { availableUntil: { $gt: new Date() } }
    ]
  }).sort('-createdAt').limit(10);
};

ShopItemSchema.statics.getItemsByType = async function(type, limit = 20) {
  return this.find({ 
    type,
    isActive: true 
  }).limit(limit);
};

ShopItemSchema.statics.purchaseItem = async function(userId, itemId) {
  const item = await this.findById(itemId);
  const user = await User.findById(userId);

  if (!item || !item.isAvailable) {
    throw new Error('Item not available for purchase');
  }

  if (user.coins < item.price.coins || user.gems < item.price.gems) {
    throw new Error('Insufficient currency');
  }

  // Process transaction
  user.coins -= item.price.coins;
  user.gems -= item.price.gems;

  // Add to inventory based on item type
  if (item.type === 'badge' && item.linkedBadge) {
    user.gameStats.badges.push(item.linkedBadge);
  } else {
    // Add to inventory
    const inventoryItem = {
      item: item._id,
      quantity: 1,
      expiresAt: item.effects?.duration ? 
        new Date(Date.now() + item.effects.duration * 60 * 60 * 1000) : 
        null
    };

    if (item.stackable) {
      const existing = user.inventory.find(i => i.item.equals(item._id));
      if (existing) {
        existing.quantity += 1;
      } else {
        user.inventory.push(inventoryItem);
      }
    } else {
      user.inventory.push(inventoryItem);
    }
  }

  // Update limited edition stock
  if (item.limitedEdition) {
    item.stock -= 1;
    await item.save();
  }

  await user.save();
  return user;
};

// Pre-save hooks
ShopItemSchema.pre('save', function(next) {
  // Validate that at least one price is set
  if (this.price.coins <= 0 && this.price.gems <= 0) {
    throw new Error('Item must have either coin or gem price');
  }

  // Validate effects based on type
  if (this.type === 'boost' && !this.effects.xpBoost) {
    throw new Error('Boost items must have XP boost effects');
  }

  next();
});

const ShopItem = mongoose.model('ShopItem', ShopItemSchema);

export default ShopItem;