import Habit from '../models/habit.js';
import User from '../models/User.js';
import AppError from '../utils/appError.js';
import mongoose from 'mongoose';
import { calculateStreakBonus } from '../utils/habitUtils.js';

/**
 * @desc    Get all habits for a user
 * @route   GET /api/habits
 * @access  Private
 */
export const getHabits = async (req, res, next) => {
  try {
    const habits = await Habit.find({ userId: req.user.id })
      .select('-__v')
      .sort('-currentStreak -createdAt')
      .lean();

    res.status(200).json({
      status: 'success',
      results: habits.length,
      data: { habits }
    });
  } catch (error) {
    next(new AppError('Failed to fetch habits', 500));
  }
};

/**
 * @desc    Create a new habit
 * @route   POST /api/habits
 * @access  Private
 */
export const createHabit = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, difficulty, frequency } = req.body;

    // Calculate base XP based on difficulty
    const difficultyMultipliers = {
      easy: 1,
      medium: 1.5,
      hard: 2,
      extreme: 3
    };
    const baseXP = 10 * difficultyMultipliers[difficulty];

    const habit = await Habit.create([{
      userId: req.user.id,
      name,
      difficulty,
      frequency,
      baseXP,
      reminder: req.body.reminder
    }], { session });

    // Update user's habit count
    await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { 'gameStats.habitCount': 1 } },
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      status: 'success',
      data: { habit: habit[0] }
    });
  } catch (error) {
    await session.abortTransaction();
    next(new AppError('Failed to create habit', 400));
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Complete a habit
 * @route   PATCH /api/habits/:id/complete
 * @access  Private
 */
export const completeHabit = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const habit = await Habit.findById(req.params.id).session(session);
    if (!habit) {
      throw new AppError('Habit not found', 404);
    }

    // Verify ownership
    if (habit.userId.toString() !== req.user.id) {
      throw new AppError('Not authorized', 403);
    }

    // Complete the habit with notes
    await habit.complete(req.body.notes || '', req.body.difficulty || 3);
    
    // Calculate XP with streak bonus
    const xpEarned = habit.baseXP + calculateStreakBonus(habit.currentStreak);

    // Update user stats
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $inc: { 
          xp: xpEarned,
          'gameStats.totalXP': xpEarned,
          'gameStats.completedHabits': 1
        },
        $set: { 'gameStats.lastActive': new Date() }
      },
      { new: true, session }
    );

    // Check for level up
    const newLevel = Math.floor(user.xp / 100) + 1;
    if (newLevel > user.level) {
      await User.findByIdAndUpdate(
        req.user.id,
        { $set: { level: newLevel } },
        { session }
      );
    }

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: { 
        habit,
        xpEarned,
        levelUp: newLevel > user.level ? newLevel : null
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Update habit details
 * @route   PATCH /api/habits/:id
 * @access  Private
 */
export const updateHabit = async (req, res, next) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!habit) {
      throw new AppError('Habit not found or not owned by user', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { habit }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a habit
 * @route   DELETE /api/habits/:id
 * @access  Private
 */
export const deleteHabit = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const habit = await Habit.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    }).session(session);

    if (!habit) {
      throw new AppError('Habit not found or not owned by user', 404);
    }

    // Update user's habit count
    await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { 'gameStats.habitCount': -1 } },
      { session }
    );

    await session.commitTransaction();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get habit analytics
 * @route   GET /api/habits/analytics
 * @access  Private
 */
export const getHabitAnalytics = async (req, res, next) => {
  try {
    const habits = await Habit.find({ userId: req.user.id });

    const analytics = {
      totalHabits: habits.length,
      activeHabits: habits.filter(h => h.isActive).length,
      totalCompletions: habits.reduce((sum, h) => sum + h.completionHistory.length, 0),
      bestStreak: Math.max(...habits.map(h => h.longestStreak),
      currentStreaks: habits.map(h => ({
        name: h.name,
        streak: h.currentStreak,
        status: h.streakStatus
      })),
      completionRateByDifficulty: {
        easy: calculateAverageCompletion(habits.filter(h => h.difficulty === 'easy')),
        medium: calculateAverageCompletion(habits.filter(h => h.difficulty === 'medium')),
        hard: calculateAverageCompletion(habits.filter(h => h.difficulty === 'hard')),
        extreme: calculateAverageCompletion(habits.filter(h => h.difficulty === 'extreme'))
      }
    };

    res.status(200).json({
      status: 'success',
      data: { analytics }
    });
  } catch (error) {
    next(new AppError('Failed to generate analytics', 500));
  }
};

/**
 * @desc    Calculate streaks for all habits
 * @route   POST /api/habits/calculate-streaks
 * @access  Private
 */
export const calculateStreaks = async (req, res, next) => {
  try {
    await Habit.calculateStreaks(req.user.id);
    res.status(200).json({
      status: 'success',
      message: 'Streaks recalculated'
    });
  } catch (error) {
    next(new AppError('Failed to calculate streaks', 500));
  }
};

// Helper function to calculate average completion rate
function calculateAverageCompletion(habits) {
  if (habits.length === 0) return 0;
  const total = habits.reduce((sum, h) => sum + h.completionRate, 0);
  return Math.round(total / habits.length);
}