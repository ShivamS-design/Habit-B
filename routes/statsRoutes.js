import express from 'express';
import { 
  getUserStats,
  updateUserStats,
  getGameSessionStats,
  getLeaderboardStats,
  getUserProgress,
  getActivityHistory,
  getMilestoneAchievements
} from '../controllers/statsController.js';
import { verifyUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyUser);

/**
 * @route GET /api/stats
 * @desc Get comprehensive user stats
 * @access Private
 */
router.get('/', getUserStats);

/**
 * @route PATCH /api/stats
 * @desc Update user stats (XP, achievements, etc.)
 * @access Private
 */
router.patch('/', updateUserStats);

/**
 * @route GET /api/stats/games/:gameId
 * @desc Get game session statistics
 * @access Private
 */
router.get('/games/:gameId', getGameSessionStats);

/**
 * @route GET /api/stats/leaderboard
 * @desc Get leaderboard statistics
 * @access Private
 */
router.get('/leaderboard', getLeaderboardStats);

/**
 * @route GET /api/stats/progress
 * @desc Get user progress toward goals
 * @access Private
 */
router.get('/progress', getUserProgress);

/**
 * @route GET /api/stats/activity
 * @desc Get user activity history (last 50 activities)
 * @access Private
 */
router.get('/activity', getActivityHistory);

/**
 * @route GET /api/stats/milestones
 * @desc Get achieved milestones
 * @access Private
 */
router.get('/milestones', getMilestoneAchievements);

export default router;
