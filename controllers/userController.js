import User from '../models/User.js';
import AppError from '../utils/appError.js';
import { filterObj } from '../utils/helpers.js';

// Get current user's profile
export const getCurrentUser = async (req, res, next) => {
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

// Update user profile
export const updateUser = async (req, res, next) => {
  try {
    // 1. Filter out unwanted fields
    const filteredBody = filterObj(req.body, 'name', 'email', 'avatar', 'bio');
    
    // 2. Update user
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

// Delete user account
export const deleteUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { active: false });
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

// Get user stats
export const getUserStats = async (req, res, next) => {
  try {
    const stats = await User.findById(req.user.id)
      .select('gameStats xp level')
      .populate('gameStats.badges');
      
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (err) {
    next(err);
  }
};