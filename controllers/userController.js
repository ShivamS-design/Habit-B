import User from '../models/User.js';
import AppError from '../utils/appError.js';
import { filterObj } from '../utils/helpers.js';
import mongoose from 'mongoose';

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v')
      .populate('gameStats.badges');
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update user profile
 * @route   PATCH /api/users/me
 * @access  Private
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const filteredBody = filterObj(req.body, 'name', 'email', 'avatar', 'bio');
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      filteredBody,
      { new: true, runValidators: true }
    ).select('-password -__v');

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete user account
 * @route   DELETE /api/users/me
 * @access  Private
 */
export const deleteUserAccount = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { active: false },
      { session }
    );

    await session.commitTransaction();
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get user stats
 * @route   GET /api/users/stats
 * @access  Private
 */
export const getUserStats = async (req, res, next) => {
  try {
    const stats = await User.findById(req.user.id)
      .select('xp level gameStats')
      .populate('gameStats.badges');
      
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update user settings
 * @route   PATCH /api/users/settings
 * @access  Private
 */
export const updateUserSettings = async (req, res, next) => {
  try {
    const filteredBody = filterObj(req.body, 'settings');
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      filteredBody,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user's inventory
 * @route   GET /api/users/inventory
 * @access  Private
 */
export const getUserInventory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('inventory')
      .populate('inventory.items.item inventory.badges.badge');
      
    res.status(200).json({
      status: 'success',
      data: { inventory: user.inventory }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Purchase shop item
 * @route   POST /api/users/purchase/:itemId
 * @access  Private
 */
export const purchaseItem = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(req.user.id).session(session);
    const item = await Item.findById(req.params.itemId).session(session);

    if (!item) {
      throw new AppError('Item not found', 404);
    }

    if (user.coins < item.price) {
      throw new AppError('Not enough coins', 400);
    }

    // Add item to inventory
    user.inventory.items.push({ item: item._id });
    user.coins -= item.price;
    await user.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get user's achievements
 * @route   GET /api/users/achievements
 * @access  Private
 */
export const getUserAchievements = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('gameStats.badges')
      .populate('gameStats.badges');
      
    res.status(200).json({
      status: 'success',
      data: { achievements: user.gameStats.badges }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user's leaderboard position
 * @route   GET /api/users/leaderboard-position
 * @access  Private
 */
export const getLeaderboardPosition = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const totalUsers = await User.countDocuments();
    const rank = await User.countDocuments({ xp: { $gt: user.xp } }) + 1;

    res.status(200).json({
      status: 'success',
      data: {
        rank,
        totalUsers,
        percentile: Math.round((rank / totalUsers) * 100)
      }
    });
  } catch (err) {
    next(err);
  }
};
