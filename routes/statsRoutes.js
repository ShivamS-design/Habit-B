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

// Core stats endpoints
router.route('/')
  .get(getUserStats)       // GET user stats
  .patch(updateUserStats); // UPDATE user stats

// Game-specific stats
router.get('/games/:gameId', getGameSessionStats); // GET game session stats

// Progress tracking
router.get('/leaderboard', getLeaderboardStats); // GET leaderboard
router.get('/progress', getUserProgress);       // GET user progress
router.get('/activity', getActivityHistory);    // GET activity history
router.get('/milestones', getMilestoneAchievements); // GET milestones

export default router;
