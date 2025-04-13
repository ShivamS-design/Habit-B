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
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * @desc    Get comprehensive user stats
 * @route   GET /api/stats
 * @access  Private
 */
router.get('/', getUserStats);

/**
 * @desc    Update user stats (XP, achievements, etc.)
 * @route   PATCH /api/stats
 * @access  Private
 */
router.patch('/', updateUserStats);

/**
 * @desc    Get game session statistics
 * @route   GET /api/stats/games/:gameId
 * @access  Private
 */
router.get('/games/:gameId', getGameSessionStats);

/**
 * @desc    Get leaderboard statistics
 * @route   GET /api/stats/leaderboard
 * @access  Private
 */
router.get('/leaderboard', getLeaderboardStats);

/**
 * @desc    Get user progress toward goals
 * @route   GET /api/stats/progress
 * @access  Private
 */
router.get('/progress', getUserProgress);

/**
 * @desc    Get user activity history
 * @route   GET /api/stats/activity
 * @access  Private
 */
router.get('/activity', getActivityHistory);

/**
 * @desc    Get milestone achievements
 * @route   GET /api/stats/milestones
 * @access  Private
 */
router.get('/milestones', getMilestoneAchievements);

export default router;