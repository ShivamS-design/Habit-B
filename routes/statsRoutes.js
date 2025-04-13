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

// User statistics routes
router.route('/')
  .get(getUserStats)    // GET /api/stats - Get user stats
  .patch(updateUserStats); // PATCH /api/stats - Update user stats

// Game-specific routes
router.get('/games/:gameId', getGameSessionStats); // GET /api/stats/games/:gameId - Get game stats

// Progress and activity routes
router.get('/leaderboard', getLeaderboardStats); // GET /api/stats/leaderboard - Get leaderboard
router.get('/progress', getUserProgress); // GET /api/stats/progress - Get user progress
router.get('/activity', getActivityHistory); // GET /api/stats/activity - Get activity history
router.get('/milestones', getMilestoneAchievements); // GET /api/stats/milestones - Get milestones

export default router;
