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
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getHabits)
  .post(createHabit);

router.route('/analytics')
  .get(getHabitAnalytics);

router.route('/calculate-streaks')
  .post(calculateStreaks);

router.route('/:id')
  .patch(updateHabit)
  .delete(deleteHabit);

router.route('/:id/complete')
  .patch(completeHabit);

export default router;