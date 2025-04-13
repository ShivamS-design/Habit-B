import User from '../models/User.js';
import GameProgress from '../models/GameProgress.js';
import AppError from '../utils/appError.js';

/**
 * @desc    Get comprehensive user stats
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const getUserStats = async (req, res, next) => {
  try {
    const stats = await User.findById(req.user.id)
      .select('xp level gameStats achievements')
      .populate('gameStats.badges achievements.badge');
      
    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update user stats
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const updateUserStats = async (req, res, next) => {
  try {
    const updates = {};
    
    // Validate and structure updates
    if (req.body.xp) updates.$inc = { xp: req.body.xp };
    if (req.body.level) updates.$set = { level: req.body.level };
    if (req.body.gameStats) updates.$set = { ...updates.$set, gameStats: req.body.gameStats };
    
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
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const getGameSessionStats = async (req, res, next) => {
  try {
    const stats = await GameProgress.findOne({
      userId: req.user.id,
      gameId: req.params.gameId
    }).lean();
    
    if (!stats) {
      return next(new AppError('No game progress found', 404));
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
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const getLeaderboardStats = async (req, res, next) => {
  try {
    const leaderboard = await User.find()
      .sort({ xp: -1, level: -1 })
      .limit(100)
      .select('username avatar xp level gameStats.totalWins')
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
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const getUserProgress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('gameStats.goals achievements')
      .lean();
    
    res.status(200).json({
      status: 'success',
      data: {
        goals: user.gameStats?.goals || [],
        achievements: user.achievements || []
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user activity history
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const getActivityHistory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('activityLog')
      .lean();
    
    res.status(200).json({
      status: 'success',
      data: user.activityLog || []
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get milestone achievements
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const getMilestoneAchievements = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('achievements')
      .populate('achievements.badge')
      .lean();
    
    res.status(200).json({
      status: 'success',
      data: user.achievements?.filter(a => a.isMilestone) || []
    });
  } catch (err) {
    next(err);
  }
};
