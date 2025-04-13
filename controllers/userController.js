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
    // Filter out unwanted fields
    const filteredBody = filterObj(req.body, 'name', 'email', 'avatar', 'bio');
    
    // Update user
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
    // 1. Delete user data (habits, tasks, etc.)
    // Add your cleanup logic here
    
    // 2. Soft delete user account
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { active: false },
      { new: true, session }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

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
