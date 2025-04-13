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
import upload from '../utils/fileUpload.js';

// Create validation middleware directly in routes file
const validateUserUpdate = (req, res, next) => {
  const allowedUpdates = ['name', 'email', 'avatar', 'bio'];
  const updates = Object.keys(req.body);
  
  const isValidOperation = updates.every(update => 
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ 
      status: 'error',
      message: 'Invalid updates! Only name, email, avatar and bio can be updated'
    });
  }

  // Basic validation checks
  if (req.body.name && req.body.name.length < 3) {
    return res.status(400).send({
      status: 'error',
      message: 'Name must be at least 3 characters'
    });
  }

  if (req.body.bio && req.body.bio.length > 200) {
    return res.status(400).send({
      status: 'error',
      message: 'Bio cannot exceed 200 characters'
    });
  }

  next();
};

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyUser);

// User Profile Routes
router.route('/me')
  .get(getUserProfile)
  .patch(
    upload.single('avatar'), // Handle avatar upload
    validateUserUpdate,      // Validate update data
    updateUserProfile       // Process the update
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
