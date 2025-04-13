import User from '../models/User.js';
import GameProgress from '../models/GameProgress.js';
import AppError from '../utils/appError.js';
import mongoose from 'mongoose';

// Leaderboard configuration
const LEADERBOARD_TYPES = {
  GLOBAL_XP: {
    name: 'Global XP',
    collection: 'users',
    sortField: 'xp',
    projection: { name: 1, avatar: 1, level: 1, xp: 1 }
  },
  GAME_XP: {
    name: 'Game XP',
    collection: 'gameprogresses',
    sortField: 'xpEarned',
    groupField: 'gameId',
    projection: { userId: 1, xpEarned: 1 }
  },
  WEEKLY_STREAK: {
    name: 'Weekly Streak',
    collection: 'users',
    sortField: 'gameStats.currentStreak',
    projection: { name: 1, avatar: 1, 'gameStats.currentStreak': 1 }
  },
  GAME_SPECIFIC: {
    name: 'Game Specific',
    collection: 'gameprogresses',
    sortField: 'highestScore',
    groupField: 'gameId',
    projection: { userId: 1, highestScore: 1 }
  }
};

/**
 * @desc    Get leaderboard data
 * @route   GET /api/leaderboard
 * @access  Public
 */
export const getLeaderboard = async (req, res, next) => {
  try {
    const { type = 'GLOBAL_XP', gameId, limit = 100, timeframe } = req.query;

    // Validate leaderboard type
    const config = LEADERBOARD_TYPES[type];
    if (!config) {
      throw new AppError('Invalid leaderboard type', 400);
    }

    // Build base query
    let query = {};
    let pipeline = [];

    // Apply timeframe filter if specified
    if (timeframe) {
      const dateFilter = getDateFilter(timeframe);
      if (dateFilter) {
        if (config.collection === 'users') {
          query.lastActive = dateFilter;
        } else {
          query.lastPlayed = dateFilter;
        }
      }
    }

    // Apply game filter for game-specific leaderboards
    if (config.groupField && gameId) {
      query[config.groupField] = gameId;
    }

    // Build aggregation pipeline
    if (config.collection === 'gameprogresses') {
      pipeline = buildGameProgressPipeline(config, query, parseInt(limit));
    } else {
      pipeline = buildUserPipeline(config, query, parseInt(limit));
    }

    // Execute aggregation
    const Model = config.collection === 'users' ? User : GameProgress;
    let leaderboard = await Model.aggregate(pipeline);

    // Populate user details if needed
    if (config.collection === 'gameprogresses') {
      leaderboard = await populateUserDetails(leaderboard);
    }

    // Apply final transformations
    leaderboard = leaderboard.map(entry => ({
      rank: entry.rank,
      score: entry.score,
      user: {
        id: entry.userId || entry._id,
        name: entry.user?.name || entry.name,
        avatar: entry.user?.avatar || entry.avatar,
        level: entry.user?.level || entry.level
      },
      ...(type === 'GAME_SPECIFIC' && { gameId }),
      ...(timeframe && { timeframe })
    }));

    res.status(200).json({
      status: 'success',
      data: {
        type: config.name,
        timeframe: timeframe || 'all-time',
        leaderboard
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's leaderboard position
 * @route   GET /api/leaderboard/position
 * @access  Private
 */
export const getUserPosition = async (req, res, next) => {
  try {
    const { type = 'GLOBAL_XP', gameId } = req.query;
    const config = LEADERBOARD_TYPES[type];
    
    if (!config) {
      throw new AppError('Invalid leaderboard type', 400);
    }

    let position;
    if (config.collection === 'users') {
      position = await getUserRank(User, req.user.id, config.sortField);
    } else {
      if (!gameId) {
        throw new AppError('Game ID required for this leaderboard type', 400);
      }
      position = await getGameProgressRank(GameProgress, req.user.id, gameId, config.sortField);
    }

    res.status(200).json({
      status: 'success',
      data: {
        type: config.name,
        position,
        userId: req.user.id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get multiple leaderboard types at once
 * @route   GET /api/leaderboard/multiple
 * @access  Public
 */
export const getMultipleLeaderboards = async (req, res, next) => {
  try {
    const { types = 'GLOBAL_XP,WEEKLY_STREAK', limit = 10 } = req.query;
    const leaderboardTypes = types.split(',');

    const results = await Promise.all(
      leaderboardTypes.map(type => 
        getLeaderboardData(type.trim(), parseInt(limit))
      )
    );

    res.status(200).json({
      status: 'success',
      data: results.reduce((acc, result, index) => {
        acc[leaderboardTypes[index]] = result;
        return acc;
      }, {})
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to build game progress aggregation pipeline
function buildGameProgressPipeline(config, query, limit) {
  return [
    { $match: query },
    { $group: {
      _id: '$userId',
      score: { $sum: `$${config.sortField}` },
      gameId: { $first: `$${config.groupField}` }
    }},
    { $sort: { score: -1 } },
    { $limit: limit },
    { $addFields: { rank: { $add: [{ $indexOfArray: ["$score", "$score"] }, 1] } } },
    { $project: {
      userId: '$_id',
      score: 1,
      rank: 1,
      ...(config.groupField && { gameId: 1 }),
      _id: 0
    }}
  ];
}

// Helper function to build user aggregation pipeline
function buildUserPipeline(config, query, limit) {
  return [
    { $match: query },
    { $sort: { [config.sortField]: -1 } },
    { $limit: limit },
    { $addFields: { rank: { $add: [{ $indexOfArray: [`$${config.sortField}`, `$${config.sortField}`] }, 1] } } },
    { $project: {
      ...config.projection,
      score: `$${config.sortField}`,
      rank: 1,
      _id: 0
    }}
  ];
}

// Helper function to populate user details
async function populateUserDetails(leaderboard) {
  const userIds = leaderboard.map(entry => entry.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select('name avatar level')
    .lean();

  const userMap = users.reduce((map, user) => {
    map[user._id.toString()] = user;
    return map;
  }, {});

  return leaderboard.map(entry => ({
    ...entry,
    user: userMap[entry.userId.toString()]
  }));
}

// Helper function to get date filter for timeframe
function getDateFilter(timeframe) {
  const now = new Date();
  switch(timeframe) {
    case 'daily':
      return { $gte: new Date(now.setDate(now.getDate() - 1)) };
    case 'weekly':
      return { $gte: new Date(now.setDate(now.getDate() - 7)) };
    case 'monthly':
      return { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
    default:
      return null;
  }
}

// Helper function to get user's rank
async function getUserRank(Model, userId, sortField) {
  const result = await Model.aggregate([
    {
      $setWindowFields: {
        sortBy: { [sortField]: -1 },
        output: {
          rank: {
            $rank: {}
          }
        }
      }
    },
    { $match: { _id: mongoose.Types.ObjectId(userId) } },
    { $project: { rank: 1 } }
  ]);

  return result[0]?.rank || 0;
}

// Helper function to get game progress rank
async function getGameProgressRank(Model, userId, gameId, sortField) {
  const result = await Model.aggregate([
    { $match: { gameId } },
    {
      $setWindowFields: {
        sortBy: { [sortField]: -1 },
        output: {
          rank: {
            $rank: {}
          }
        }
      }
    },
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    { $project: { rank: 1 } }
  ]);

  return result[0]?.rank || 0;
}

// Helper function to get leaderboard data
async function getLeaderboardData(type, limit) {
  const config = LEADERBOARD_TYPES[type];
  if (!config) return null;

  const pipeline = config.collection === 'users' 
    ? buildUserPipeline(config, {}, limit)
    : buildGameProgressPipeline(config, {}, limit);

  const Model = config.collection === 'users' ? User : GameProgress;
  let data = await Model.aggregate(pipeline);

  if (config.collection === 'gameprogresses') {
    data = await populateUserDetails(data);
  }

  return {
    type: config.name,
    data: data.map(entry => ({
      rank: entry.rank,
      score: entry.score,
      user: {
        id: entry.userId || entry._id,
        name: entry.user?.name || entry.name,
        avatar: entry.user?.avatar || entry.avatar,
        level: entry.user?.level || entry.level
      }
    }))
  };
}