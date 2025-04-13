import User from '../models/User.js';
import GameProgress from '../models/GameProgress.js';
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