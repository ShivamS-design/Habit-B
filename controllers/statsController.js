import User from '../models/User.js';
import GameProgress from '../models/GameProgress.js';
import ActivityLog from '../models/ActivityLog.js';
import Milestone from '../models/Milestone.js';
import AppError from '../utils/appError.js';

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

export const updateUserStats = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: req.body.updates },
      { new: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

export const getGameSessionStats = async (req, res, next) => {
  try {
    const stats = await GameProgress.findOne({
      userId: req.user.id,
      gameId: req.params.gameId
    });
    
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (err) {
    next(err);
  }
};

export const getLeaderboardStats = async (req, res, next) => {
  try {
    const leaderboard = await User.find()
      .sort({ xp: -1, level: -1 })
      .limit(100)
      .select('username xp level avatar');
    
    res.status(200).json({
      status: 'success',
      data: { leaderboard }
    });
  } catch (err) {
    next(err);
  }
};

export const getUserProgress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('gameStats.goals');
    
    res.status(200).json({
      status: 'success',
      data: { progress: user.gameStats.goals }
    });
  } catch (err) {
    next(err);
  }
};

export const getActivityHistory = async (req, res, next) => {
  try {
    const activities = await ActivityLog.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.status(200).json({
      status: 'success',
      data: { activities }
    });
  } catch (err) {
    next(err);
  }
};

export const getMilestoneAchievements = async (req, res, next) => {
  try {
    const milestones = await Milestone.find({
      userId: req.user.id,
      achieved: true
    }).sort({ dateAchieved: -1 });
    
    res.status(200).json({
      status: 'success',
      data: { milestones }
    });
  } catch (err) {
    next(err);
  }
};
