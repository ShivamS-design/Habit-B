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

// User profile routes
router.route('/me')
  .get(getUserProfile)
  .patch(upload.single('avatar'), validateUserUpdate, updateUserProfile)
  .delete(deleteUserAccount);

// Stats and settings
router.route('/stats').get(getUserStats);
router.route('/settings').patch(updateUserSettings);

// Inventory and purchases
router.route('/inventory').get(getUserInventory);
router.route('/purchase/:itemId').post(purchaseItem);

// Achievements and leaderboard
router.route('/achievements').get(getUserAchievements);
router.route('/leaderboard-position').get(getLeaderboardPosition);

// Admin-only routes
router.use(restrictTo('admin'));
router.route('/:id')
  .get(getUserProfile)
  .patch(upload.single('avatar'), validateUserUpdate, updateUserProfile)
  .delete(deleteUserAccount);

export default router;
