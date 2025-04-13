import User from '../models/User.js';
import GameProgress from '../models/GameProgress.js';
import AppError from '../utils/appError.js';

/**
 * @desc    Get comprehensive user stats
 */
export const getUserStats = async (req, res, next) => {
  try {
    const stats = await User.findById(req.user.id)
      .select('name avatar xp level coins gameStats inventory')
      .populate('gameStats.badges inventory.badges.badge');
    
    res.status(200).json({
      status: 'success',
      data: {
        ...stats.toObject(),
        xpProgress: stats.xpProgress,
        nextLevelXP: stats.nextLevelXP
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update user stats
 */
export const updateUserStats = async (req, res, next) => {
  try {
    const allowedUpdates = ['xp', 'level', 'coins', 'gameStats'];
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get game session statistics
 */
export const getGameSessionStats = async (req, res, next) => {
  try {
    const stats = await GameProgress.findOne({
      userId: req.user.id,
      gameId: req.params.gameId
    });

    if (!stats) {
      return res.status(200).json({
        status: 'success',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get leaderboard statistics
 */
export const getLeaderboardStats = async (req, res, next) => {
  try {
    const leaderboard = await User.find()
      .sort({ 'gameStats.totalXP': -1, level: -1 })
      .limit(100)
      .select('name avatar level gameStats.totalXP')
      .lean();

    res.status(200).json({
      status: 'success',
      data: leaderboard
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user progress toward goals
 */
export const getUserProgress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('gameStats')
      .lean();

    res.status(200).json({
      status: 'success',
      data: {
        currentStreak: user.gameStats.currentStreak,
        longestStreak: user.gameStats.longestStreak,
        totalXP: user.gameStats.totalXP,
        badgesCount: user.gameStats.badges?.length || 0
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user activity history
 */
export const getActivityHistory = async (req, res, next) => {
  try {
    // Using gameStats.gamesPlayed as activity log
    const user = await User.findById(req.user.id)
      .select('gameStats.gamesPlayed')
      .lean();

    const activities = Object.entries(user.gameStats.gamesPlayed || {})
      .map(([gameId, stats]) => ({
        type: 'game',
        gameId,
        lastPlayed: stats.lastPlayed,
        playCount: stats.playCount
      }))
      .sort((a, b) => b.lastPlayed - a.lastPlayed);

    res.status(200).json({
      status: 'success',
      data: activities
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get milestone achievements
 */
export const getMilestoneAchievements = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('gameStats inventory.badges')
      .populate('inventory.badges.badge')
      .lean();

    const milestones = user.inventory.badges
      .filter(badge => 
        badge.badge?.rarity === 'epic' || 
        badge.badge?.rarity === 'legendary'
      )
      .map(badge => ({
        badge: badge.badge,
        unlockedAt: badge.unlockedAt
      }));

    res.status(200).json({
      status: 'success',
      data: milestones
    });
  } catch (err) {
    next(err);
  }
};
