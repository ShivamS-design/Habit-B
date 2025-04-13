import express from 'express';
import { 
  getLeaderboard, 
  getUserPosition,
  getMultipleLeaderboards
} from '../controllers/leaderboardController.js';
import { verifyUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.route('/')
  .get(getLeaderboard);              // GET: Get main leaderboard (public)

router.route('/multiple')
  .get(getMultipleLeaderboards);     // GET: Get multiple leaderboards (public)

// Protected routes (require authentication)
router.use(verifyUser);             // Apply auth middleware to following routes

router.route('/position')
  .get(getUserPosition);            // GET: Get current user's position (protected)

export default router;
