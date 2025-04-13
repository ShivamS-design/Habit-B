import express from 'express';
import { 
  getLeaderboard, 
  getUserPosition,
  getMultipleLeaderboards
} from '../controllers/leaderboardController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getLeaderboard);
router.get('/multiple', getMultipleLeaderboards);

// Protected routes
router.use(verifyToken);
router.get('/position', getUserPosition);

export default router;