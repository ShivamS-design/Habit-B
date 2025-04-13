import GameProgress from '../models/GameProgress.js';
import User from '../models/User.js';
import Badge from '../models/Badge.js';
import AppError from '../utils/appError.js';
import mongoose from 'mongoose';

/**
 * @desc    Save or update game progress
 * @route   POST /api/games/progress
 * @access  Private
 */
export const saveGameProgress = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { gameId, progressData, xpEarned = 0, actions = [] } = req.body;
    const userId = req.user.id;

    // Validate game ID
    const validGameIds = ['word-scrambler', 'spin-wheel', 'habit-challenge', 'cosmic-chess', 'recovery-game'];
    if (!validGameIds.includes(gameId)) {
      await session.abortTransaction();
      return next(new AppError('Invalid game ID', 400));
    }

    // Save game progress
    const gameProgress = await GameProgress.findOneAndUpdate(
      { userId, gameId },
      { 
        progressData,
        xpEarned,
        lastPlayed: Date.now() 
      },
      { 
        new: true,
        upsert: true,
        session 
      }
    );

    // Update user stats
    const userUpdates = {
      $inc: { 
        xp: xpEarned,
        'gameStats.totalXP': xpEarned,
        [`gameStats.gamesPlayed.${gameId}.playCount`]: 1
      },
      $set: { 
        'gameStats.lastActive': Date.now(),
        [`gameStats.gamesPlayed.${gameId}.lastPlayed`]: Date.now()
      }
    };

    // Process game-specific actions
    actions.forEach(action => {
      switch(action.type) {
        case 'completedTask':
          userUpdates.$inc['gameStats.completedTasks'] = action.count || 1;
          break;
        case 'completedHabit':
          userUpdates.$inc['gameStats.completedHabits'] = action.count || 1;
          break;
        case 'streakUpdate':
          userUpdates.$set['gameStats.currentStreak'] = action.value;
          if (action.value > userUpdates.$set['gameStats.longestStreak'] || 0) {
            userUpdates.$set['gameStats.longestStreak'] = action.value;
          }
          break;
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      userUpdates,
      { new: true, session }
    );

    // Check for level up
    const newLevel = Math.floor(user.xp / 100) + 1;
    let levelUp = false;
    
    if (newLevel > user.level) {
      await User.findByIdAndUpdate(
        userId,
        { $set: { level: newLevel } },
        { session }
      );
      levelUp = true;
    }

    // Check for badge achievements
    const newlyEarnedBadges = [];
    if (xpEarned > 0 || actions.length > 0) {
      const badges = await Badge.find({
        'criteria.gameSpecific': gameId,
        isActive: true
      }).session(session);

      for (const badge of badges) {
        const hasBadge = user.gameStats.badges.includes(badge._id);
        if (!hasBadge) {
          let progress;
          switch(badge.criteria.metric) {
            case 'gamesPlayed':
              progress = user.gameStats.gamesPlayed?.[gameId]?.playCount || 0;
              break;
            case 'totalXP':
              progress = user.gameStats.totalXP;
              break;
            default:
              progress = 0;
          }

          if (progress >= badge.criteria.threshold) {
            await User.findByIdAndUpdate(
              userId,
              { 
                $push: { 'gameStats.badges': badge._id },
                $inc: { 
                  xp: badge.xpReward,
                  coins: badge.coinReward,
                  'gameStats.totalXP': badge.xpReward 
                }
              },
              { session }
            );
            newlyEarnedBadges.push(badge);
          }
        }
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: {
        gameProgress,
        xpEarned,
        newLevel: levelUp ? newLevel : null,
        badgesEarned: newlyEarnedBadges
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
 * @desc    Get game progress for a specific game
 * @route   GET /api/games/progress/:gameId
 * @access  Private
 */
export const getGameProgress = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;

    const gameProgress = await GameProgress.findOne({
      userId,
      gameId
    });

    if (!gameProgress) {
      return res.status(200).json({
        status: 'success',
        data: {
          progress: null,
          firstTime: true
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        progress: gameProgress
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get comprehensive game analytics for a user
 * @route   GET /api/games/analytics
 * @access  Private
 */
export const getGameAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get basic game progress stats
    const gameStats = await GameProgress.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      { $group: {
        _id: '$gameId',
        totalSessions: { $sum: 1 },
        totalXPEarned: { $sum: '$xpEarned' },
        lastPlayed: { $max: '$lastPlayed' }
      }}
    ]);

    // Get user's overall stats
    const user = await User.findById(userId)
      .select('level xp gameStats')
      .lean();

    // Calculate playtime distribution
    const totalSessions = gameStats.reduce((sum, game) => sum + game.totalSessions, 0);
    const gameDistribution = gameStats.map(game => ({
      gameId: game._id,
      percentage: Math.round((game.totalSessions / totalSessions) * 100) || 0,
      ...game
    }));

    // Get recent achievements
    const recentBadges = await Badge.find({
      _id: { $in: user.gameStats.badges.slice(-3) } // Get last 3 badges
    }).select('name icon rarity');

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          level: user.level,
          totalXP: user.gameStats.totalXP,
          currentStreak: user.gameStats.currentStreak,
          longestStreak: user.gameStats.longestStreak
        },
        games: gameDistribution,
        recentAchievements: recentBadges,
        completionPercentages: calculateCompletionPercentages(user.gameStats)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get leaderboard for a specific game
 * @route   GET /api/games/leaderboard/:gameId
 * @access  Public
 */
export const getGameLeaderboard = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // Get top players by XP earned in this game
    const leaderboard = await GameProgress.aggregate([
      { $match: { gameId } },
      { $group: {
        _id: '$userId',
        totalXP: { $sum: '$xpEarned' },
        lastPlayed: { $max: '$lastPlayed' }
      }},
      { $sort: { totalXP: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $project: {
        userId: '$_id',
        _id: 0,
        totalXP: 1,
        lastPlayed: 1,
        name: '$user.name',
        avatar: '$user.avatar',
        level: '$user.level'
      }}
    ]);

    res.status(200).json({
      status: 'success',
      results: leaderboard.length,
      data: {
        leaderboard
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Reset progress for a specific game
 * @route   DELETE /api/games/progress/:gameId
 * @access  Private
 */
export const resetGameProgress = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { gameId } = req.params;
    const userId = req.user.id;

    // Delete game progress
    await GameProgress.deleteOne({ userId, gameId }).session(session);

    // Remove game from user's gamesPlayed map
    await User.findByIdAndUpdate(
      userId,
      { $unset: { [`gameStats.gamesPlayed.${gameId}`]: 1 } },
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

// Helper function to calculate completion percentages
function calculateCompletionPercentages(gameStats) {
  const totalPossible = {
    tasks: 100,       // Example thresholds
    habits: 30,
    games: 5,
    days: 365
  };

  return {
    tasks: Math.min(Math.round((gameStats.completedTasks / totalPossible.tasks) * 100), 100),
    habits: Math.min(Math.round((gameStats.completedHabits / totalPossible.habits) * 100), 100),
    games: Math.min(Math.round((Object.keys(gameStats.gamesPlayed || {}).length / totalPossible.games) * 100), 100),
    days: Math.min(Math.round((gameStats.daysActive / totalPossible.days) * 100), 100)
  };
}