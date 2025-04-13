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
import { verifyUser, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route GET /api/badges
 * @desc Get all badges (public)
 * @access Public
 */
router.get('/', getAllBadges);

/**
 * @route GET /api/badges/:id
 * @desc Get a specific badge by ID (public)
 * @access Public
 */
router.get('/:id', getBadge);

// Apply authentication middleware to all following routes
router.use(verifyUser);

/**
 * @route GET /api/badges/user/:userId
 * @desc Get all badges earned by a user
 * @access Private
 */
router.get('/user/:userId', getUserBadges);

/**
 * @route GET /api/badges/user/:userId/unearned
 * @desc Get badges not yet earned by a user
 * @access Private
 */
router.get('/user/:userId/unearned', getUnearnedBadges);

/**
 * @route GET /api/badges/progress/:userId
 * @desc Get progress towards all badges for a user
 * @access Private
 */
router.get('/progress/:userId', getBadgeProgress);

/**
 * @route POST /api/badges/check-progress/:userId
 * @desc Check and award badges based on user progress
 * @access Private
 */
router.post('/check-progress/:userId', checkAndAwardBadges);

/**
 * @route POST /api/badges/purchase/:badgeId
 * @desc Purchase a badge (if purchasable)
 * @access Private
 */
router.post('/purchase/:badgeId', purchaseBadge);

// Restrict following routes to admin users only
router.use(restrictTo('admin'));

/**
 * @route POST /api/badges
 * @desc Create a new badge (admin only)
 * @access Private/Admin
 */
router.post('/', createBadge);

/**
 * @route PATCH /api/badges/:id
 * @desc Update a badge (admin only)
 * @access Private/Admin
 */
router.patch('/:id', updateBadge);

/**
 * @route DELETE /api/badges/:id
 * @desc Delete a badge (admin only)
 * @access Private/Admin
 */
router.delete('/:id', deleteBadge);

export default router;
