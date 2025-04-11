import express from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.js';

const router = express.Router();

// Get top users by XP
router.get('/', getLeaderboard);

export default router;
