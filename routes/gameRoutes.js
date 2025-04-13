import express from 'express';
import { 
  saveGameProgress, 
  getGameProgress,
  getGameAnalytics
} from '../controllers/gameController.js';
import { verifyUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Game progress routes
router.route('/')
  .post(verifyUser, saveGameProgress);  // Save game progress (protected)

router.route('/:gameId')
  .get(verifyUser, getGameProgress);    // Get specific game progress (protected)

// Game analytics route
router.route('/analytics/summary')
  .get(verifyUser, getGameAnalytics);   // Get game analytics summary (protected)

export default router;
