import express from 'express';
import {
  getAllBadges,
  getBadge,
  createBadge,
  updateBadge,
  deleteBadge,
  getUserBadges,
  getUnearnedBadges,
  checkAndAwardBadges,
  purchaseBadge,
  getBadgeProgress
} from '../controllers/badgeController.js';
import { verifyToken, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllBadges);
router.get('/:id', getBadge);

// Authentication middleware for protected routes
router.use(verifyToken);

// User-specific badge routes
router.get('/user/:userId', getUserBadges);
router.get('/user/:userId/unearned', getUnearnedBadges);
router.get('/progress/:userId', getBadgeProgress);
router.post('/check-progress/:userId', checkAndAwardBadges);
router.post('/purchase/:badgeId', purchaseBadge);

// Admin-only routes
router.use(restrictTo('admin'));

router.post('/', createBadge);
router.patch('/:id', updateBadge);
router.delete('/:id', deleteBadge);

export default router;