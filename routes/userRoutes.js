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
import upload from '../utils/fileUpload.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyUser);

// User Profile Routes
router.route('/me')
  .get(getUserProfile)
  .patch(
    upload.single('avatar'), // Handle single file upload for avatar
    validateUserUpdate,      // Validate update data
    updateUserProfile        // Process the update
  )
  .delete(deleteUserAccount);

// Stats and Analytics Routes
router.route('/stats')
  .get(getUserStats);

router.route('/settings')
  .patch(updateUserSettings);

// Inventory and Shop Routes
router.route('/inventory')
  .get(getUserInventory);

router.route('/purchase/:itemId')
  .post(purchaseItem);

// Achievements and Leaderboard Routes
router.route('/achievements')
  .get(getUserAchievements);

router.route('/leaderboard-position')
  .get(getLeaderboardPosition);

// Admin-only Routes
router.use(restrictTo('admin'));

router.route('/:id')
  .get(getUserProfile)
  .patch(
    upload.single('avatar'),
    validateUserUpdate,
    updateUserProfile
  )
  .delete(deleteUserAccount);

export default router;
