import User from '../models/User.js';
import InventoryItem from '../models/InventoryItem.js';
import AppError from '../utils/appError.js';
import mongoose from 'mongoose';

// Reward configuration with weighted probabilities
const REWARD_TIERS = [
  {
    name: "Common",
    weight: 60,
    rewards: [
      { type: "xp", min: 10, max: 30 },
      { type: "coins", min: 5, max: 15 }
    ]
  },
  {
    name: "Uncommon",
    weight: 25,
    rewards: [
      { type: "xp", min: 30, max: 60 },
      { type: "coins", min: 15, max: 30 },
      { type: "item", itemId: "common_boost" }
    ]
  },
  {
    name: "Rare",
    weight: 10,
    rewards: [
      { type: "xp", min: 60, max: 100 },
      { type: "coins", min: 30, max: 50 },
      { type: "item", itemId: "rare_boost" }
    ]
  },
  {
    name: "Epic",
    weight: 4,
    rewards: [
      { type: "xp", min: 100, max: 200 },
      { type: "coins", min: 50, max: 100 },
      { type: "item", itemId: "epic_boost" }
    ]
  },
  {
    name: "Legendary",
    weight: 1,
    rewards: [
      { type: "xp", min: 200, max: 500 },
      { type: "coins", min: 100, max: 200 },
      { type: "item", itemId: "legendary_boost" },
      { type: "badge", badgeId: "wheel_legend" }
    ]
  }
];

/**
 * @desc    Spin the wheel and award prizes
 * @route   POST /api/spin-wheel
 * @access  Private
 */
export const spinWheel = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(req.user.id).session(session);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check spin cooldown (once per day)
    const lastSpin = user.gameStats.lastSpin || new Date(0);
    const hoursSinceLastSpin = (Date.now() - lastSpin) / (1000 * 60 * 60);

    if (hoursSinceLastSpin < 24) {
      throw new AppError(`You can spin again in ${Math.ceil(24 - hoursSinceLastSpin)} hours`, 400);
    }

    // Determine reward tier based on weighted probability
    const selectedTier = selectRewardTier();
    const reward = selectRandomReward(selectedTier);

    // Apply rewards
    const updates = { $set: { 'gameStats.lastSpin': new Date() } };
    const rewardDetails = { tier: selectedTier.name, rewards: [] };

    // Process each reward component
    for (const component of reward) {
      if (component.type === 'xp') {
        const xpAmount = getRandomInRange(component.min, component.max);
        updates.$inc = { ...(updates.$inc || {}), xp: xpAmount, 'gameStats.totalXP': xpAmount };
        rewardDetails.rewards.push({ type: 'xp', amount: xpAmount });
      } 
      else if (component.type === 'coins') {
        const coinAmount = getRandomInRange(component.min, component.max);
        updates.$inc = { ...(updates.$inc || {}), coins: coinAmount };
        rewardDetails.rewards.push({ type: 'coins', amount: coinAmount });
      }
      else if (component.type === 'item') {
        const item = await InventoryItem.findById(component.itemId).session(session);
        if (!item) {
          throw new AppError('Reward item not found', 500);
        }

        updates.$push = { 
          ...(updates.$push || {}),
          'inventory.items': { 
            item: item._id,
            quantity: 1,
            acquiredAt: new Date()
          }
        };
        rewardDetails.rewards.push({ 
          type: 'item', 
          itemId: item._id,
          name: item.name,
          rarity: item.rarity
        });
      }
      else if (component.type === 'badge') {
        updates.$addToSet = { 
          ...(updates.$addToSet || {}),
          'gameStats.badges': component.badgeId
        };
        rewardDetails.rewards.push({ 
          type: 'badge', 
          badgeId: component.badgeId
        });
      }
    }

    // Check for level up
    const newLevel = Math.floor((user.xp + (updates.$inc?.xp || 0)) / 100) + 1;
    if (newLevel > user.level) {
      updates.$set = { ...(updates.$set || {}), level: newLevel };
      rewardDetails.levelUp = newLevel;
    }

    // Update user with all rewards
    await User.findByIdAndUpdate(req.user.id, updates, { session });

    // Log spin activity
    await logSpinActivity(req.user.id, selectedTier.name, rewardDetails.rewards, session);

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: rewardDetails
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get spin wheel statistics
 * @route   GET /api/spin-wheel/stats
 * @access  Private
 */
export const getSpinStats = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const now = new Date();
    const lastSpin = user.gameStats.lastSpin || new Date(0);
    const hoursUntilNextSpin = Math.max(0, 24 - (now - lastSpin) / (1000 * 60 * 60));

    const stats = {
      lastSpin: lastSpin > new Date(0) ? lastSpin : null,
      nextSpinAvailableIn: hoursUntilNextSpin.toFixed(1) + ' hours',
      totalSpins: user.gameStats.spinCount || 0,
      bestReward: user.gameStats.bestSpinReward || null,
      rewardTiers: REWARD_TIERS.map(tier => ({
        name: tier.name,
        chance: (tier.weight / REWARD_TIERS.reduce((sum, t) => sum + t.weight, 0)) * 100
      }))
    };

    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to select reward tier based on weights
function selectRewardTier() {
  const totalWeight = REWARD_TIERS.reduce((sum, tier) => sum + tier.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const tier of REWARD_TIERS) {
    if (random < tier.weight) {
      return tier;
    }
    random -= tier.weight;
  }
  
  return REWARD_TIERS[0]; // fallback
}

// Helper function to select random reward from tier
function selectRandomReward(tier) {
  const rewards = [];
  
  // Always include XP or coins
  const primaryRewards = tier.rewards.filter(r => r.type === 'xp' || r.type === 'coins');
  if (primaryRewards.length > 0) {
    rewards.push(primaryRewards[Math.floor(Math.random() * primaryRewards.length)]);
  }
  
  // Chance for additional rewards
  tier.rewards.forEach(reward => {
    if (reward.type !== 'xp' && reward.type !== 'coins' && Math.random() < 0.3) {
      rewards.push(reward);
    }
  });
  
  return rewards;
}

// Helper function to get random value in range
function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to log spin activity
async function logSpinActivity(userId, tier, rewards, session) {
  // In a real implementation, you would log this to a SpinActivity collection
  // For now, we'll just update user stats
  const bestReward = rewards.reduce((best, reward) => {
    if (reward.type === 'xp' && reward.amount > (best?.amount || 0)) return reward;
    if (reward.type === 'coins' && reward.amount > (best?.amount || 0)) return reward;
    if (reward.type === 'item' && !best) return reward;
    return best;
  }, null);

  await User.findByIdAndUpdate(
    userId,
    {
      $inc: { 'gameStats.spinCount': 1 },
      $set: { 
        'gameStats.lastSpinTier': tier,
        ...(bestReward && { 'gameStats.bestSpinReward': bestReward })
      }
    },
    { session }
  );
}