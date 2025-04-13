import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  getUserStats,
  updateUserSettings,
  getUserInventory,
  purchaseItem,
  getUserAchievements,
  getLeaderboardPosition
} from '../controllers/userController.js';
import { verifyUser, restrictTo } from '../middleware/authMiddleware.js';
import { validateUserUpdate } from '../middleware/validationMiddleware.js';
import { upload } from '../utils/fileUpload.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyUser);

/**
 * @desc    Get current user's profile
 * @route   GET /api/users/me
 * @access  Private
 */
router.route('/me')
  .get(getUserProfile)
  .patch(
    upload.single('avatar'),
    validateUserUpdate,
    updateUserProfile
  )
  .delete(deleteUserAccount);

/**
 * @desc    Get user's game statistics
 * @route   GET /api/users/stats
 * @access  Private
 */
router.route('/stats')
  .get(getUserStats);

/**
 * @desc    Update user settings
 * @route   PATCH /api/users/settings
 * @access  Private
 */
router.route('/settings')
  .patch(updateUserSettings);

/**
 * @desc    Get user's inventory
 * @route   GET /api/users/inventory
 * @access  Private
 */
router.route('/inventory')
  .get(getUserInventory);

/**
 * @desc    Purchase shop item
 * @route   POST /api/users/purchase/:itemId
 * @access  Private
 */
router.route('/purchase/:itemId')
  .post(purchaseItem);

/**
 * @desc    Get user's achievements
 * @route   GET /api/users/achievements
 * @access  Private
 */
router.route('/achievements')
  .get(getUserAchievements);

/**
 * @desc    Get user's leaderboard position
 * @route   GET /api/users/leaderboard-position
 * @access  Private
 */
router.route('/leaderboard-position')
  .get(getLeaderboardPosition);

// Admin-only routes
router.use(restrictTo('admin'));

/**
 * @desc    Get any user's profile (Admin only)
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
router.route('/:id')
  .get(getUserProfile);

/**
 * @desc    Update any user's profile (Admin only)
 * @route   PATCH /api/users/:id
 * @access  Private/Admin
 */
router.route('/:id')
  .patch(
    upload.single('avatar'),
    validateUserUpdate,
    updateUserProfile
  );

/**
 * @desc    Delete any user account (Admin only)
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
router.route('/:id')
  .delete(deleteUserAccount);

export default router;
