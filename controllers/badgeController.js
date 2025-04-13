import Badge from '../models/Badge.js';
import User from '../models/User.js';
import AppError from '../utils/appError.js';
import mongoose from 'mongoose';

/**
 * @desc    Get all available badges
 * @route   GET /api/badges
 * @access  Public
 */
export const getAllBadges = async (req, res, next) => {
  try {
    // Filtering
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    
    let query = Badge.find(JSON.parse(queryStr));

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Field limiting
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    } else {
      query = query.select('-__v');
    }

    // Pagination
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 100;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    const badges = await query;
    const total = await Badge.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: badges.length,
      total,
      data: {
        badges
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get a specific badge
 * @route   GET /api/badges/:id
 * @access  Public
 */
export const getBadge = async (req, res, next) => {
  try {
    const badge = await Badge.findById(req.params.id);
    
    if (!badge) {
      return next(new AppError('No badge found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        badge
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new badge
 * @route   POST /api/badges
 * @access  Private/Admin
 */
export const createBadge = async (req, res, next) => {
  try {
    // Validate linked badge if this is a shop item
    if (req.body.purchasable && !req.body.price) {
      return next(new AppError('Purchasable badges must have a price', 400));
    }

    const newBadge = await Badge.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        badge: newBadge
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update a badge
 * @route   PATCH /api/badges/:id
 * @access  Private/Admin
 */
export const updateBadge = async (req, res, next) => {
  try {
    const badge = await Badge.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!badge) {
      return next(new AppError('No badge found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        badge
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a badge
 * @route   DELETE /api/badges/:id
 * @access  Private/Admin
 */
export const deleteBadge = async (req, res, next) => {
  try {
    const badge = await Badge.findByIdAndDelete(req.params.id);

    if (!badge) {
      return next(new AppError('No badge found with that ID', 404));
    }

    // Remove badge from all users' collections
    await User.updateMany(
      { 'gameStats.badges': badge._id },
      { $pull: { 'gameStats.badges': badge._id } }
    );

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get badges earned by a user
 * @route   GET /api/badges/user/:userId
 * @access  Private
 */
export const getUserBadges = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('gameStats.badges')
      .populate('gameStats.badges');

    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      results: user.gameStats.badges.length,
      data: {
        badges: user.gameStats.badges
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get badges not yet earned by a user
 * @route   GET /api/badges/user/:userId/unearned
 * @access  Private
 */
export const getUnearnedBadges = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('gameStats.badges');
    
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    const unearnedBadges = await Badge.find({
      _id: { $nin: user.gameStats.badges }
    });

    res.status(200).json({
      status: 'success',
      results: unearnedBadges.length,
      data: {
        badges: unearnedBadges
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Check if user qualifies for new badges and award them
 * @route   POST /api/badges/check-progress/:userId
 * @access  Private
 */
export const checkAndAwardBadges = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const user = await User.findById(req.params.userId)
      .select('gameStats')
      .session(session);

    if (!user) {
      await session.abortTransaction();
      return next(new AppError('No user found with that ID', 404));
    }

    // Get all badges the user doesn't have yet
    const potentialBadges = await Badge.find({
      _id: { $nin: user.gameStats.badges },
      isActive: true
    }).session(session);

    const newlyEarnedBadges = [];
    let totalXPReward = 0;
    let totalCoinReward = 0;

    // Check each badge's criteria
    for (const badge of potentialBadges) {
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

      if (progress >= badge.criteria.threshold) {
        user.gameStats.badges.push(badge._id);
        newlyEarnedBadges.push(badge);
        
        // Add rewards
        totalXPReward += badge.xpReward;
        totalCoinReward += badge.coinReward;
      }
    }

    if (newlyEarnedBadges.length > 0) {
      // Update user's XP and coins
      user.gameStats.totalXP += totalXPReward;
      user.xp += totalXPReward;
      user.coins += totalCoinReward;

      await user.save({ session });

      await session.commitTransaction();
      
      res.status(200).json({
        status: 'success',
        message: `${newlyEarnedBadges.length} new badges earned!`,
        data: {
          badgesEarned: newlyEarnedBadges.length,
          xpRewarded: totalXPReward,
          coinsRewarded: totalCoinReward,
          badges: newlyEarnedBadges
        }
      });
    } else {
      await session.abortTransaction();
      res.status(200).json({
        status: 'success',
        message: 'No new badges earned yet',
        data: {
          badgesEarned: 0
        }
      });
    }
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Purchase a badge from the shop
 * @route   POST /api/badges/purchase/:badgeId
 * @access  Private
 */
export const purchaseBadge = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const badge = await Badge.findById(req.params.badgeId)
      .session(session);

    if (!badge || !badge.isAvailable || !badge.purchasable) {
      await session.abortTransaction();
      return next(new AppError('Badge not available for purchase', 400));
    }

    const user = await User.findById(req.user.id)
      .select('coins gameStats.badges')
      .session(session);

    if (!user) {
      await session.abortTransaction();
      return next(new AppError('User not found', 404));
    }

    // Check if user already has the badge
    if (user.gameStats.badges.includes(badge._id)) {
      await session.abortTransaction();
      return next(new AppError('You already own this badge', 400));
    }

    // Check if user has enough coins
    if (user.coins < badge.price) {
      await session.abortTransaction();
      return next(new AppError('Not enough coins to purchase this badge', 400));
    }

    // Process transaction
    user.coins -= badge.price;
    user.gameStats.badges.push(badge._id);

    await user.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      message: 'Badge purchased successfully',
      data: {
        badge,
        newBalance: user.coins
      }
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get user's progress toward specific badges
 * @route   GET /api/badges/progress/:userId
 * @access  Private
 */
export const getBadgeProgress = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('gameStats');

    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    // Get all badges (excluding those already earned)
    const badges = await Badge.find({
      _id: { $nin: user.gameStats.badges },
      isActive: true
    });

    const progressData = await Promise.all(
      badges.map(async badge => {
        let currentProgress = 0;
        let target = badge.criteria.threshold;

        switch(badge.criteria.metric) {
          case 'streak':
            currentProgress = user.gameStats.currentStreak || 0;
            break;
          case 'totalXP':
            currentProgress = user.gameStats.totalXP || 0;
            break;
          case 'completedTasks':
            currentProgress = user.gameStats.completedTasks || 0;
            break;
          case 'completedHabits':
            currentProgress = user.gameStats.completedHabits || 0;
            break;
          case 'gamesPlayed':
            currentProgress = user.gameStats.gamesPlayed?.[badge.criteria.gameSpecific]?.playCount || 0;
            break;
          case 'daysActive':
            currentProgress = user.gameStats.daysActive || 0;
            break;
        }

        return {
          badgeId: badge._id,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          description: badge.description,
          progressMetric: badge.criteria.metric,
          gameSpecific: badge.criteria.gameSpecific || null,
          currentProgress,
          target,
          percentage: Math.min(Math.round((currentProgress / target) * 100), 100),
          isEarned: currentProgress >= target
        };
      })
    );

    res.status(200).json({
      status: 'success',
      results: progressData.length,
      data: {
        progress: progressData
      }
    });
  } catch (err) {
    next(err);
  }
};