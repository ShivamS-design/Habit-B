import express from 'express';
import { 
  getHabits, 
  createHabit, 
  completeHabit, 
  updateHabit, 
  deleteHabit,
  getHabitAnalytics,
  calculateStreaks
} from '../controllers/habitController.js';
import { verifyUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes with authentication middleware
router.use(verifyUser);

// Habit management routes
router.route('/')
  .get(getHabits)          // Get all habits for the authenticated user
  .post(createHabit);      // Create a new habit

// Analytics routes
router.route('/analytics')
  .get(getHabitAnalytics); // Get habit analytics for the user

// Streak calculation route
router.route('/calculate-streaks')
  .post(calculateStreaks); // Calculate streaks for habits

// Habit-specific routes
router.route('/:id')
  .patch(updateHabit)      // Update a specific habit
  .delete(deleteHabit);    // Delete a specific habit

// Habit completion route
router.route('/:id/complete')
  .patch(completeHabit);   // Mark a habit as completed

export default router;
