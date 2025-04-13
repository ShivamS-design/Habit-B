import express from 'express';
import { 
  saveGameProgress, 
  getGameProgress,
  getGameAnalytics
} from '../controllers/gameController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Save game progress
router.post('/', verifyToken, saveGameProgress);

// Get game progress
router.get('/:gameId', verifyToken, getGameProgress);

// Get game analytics
router.get('/analytics/summary', verifyToken, getGameAnalytics);

export default router;