\import express from 'express';
import { 
  getTasks, 
  createTask, 
  completeTask, 
  updateTask, 
  deleteTask,
  addSubtask,
  getTaskAnalytics
} from '../controllers/taskController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getTasks)
  .post(createTask);

router.route('/analytics')
  .get(getTaskAnalytics);

router.route('/:id')
  .patch(updateTask)
  .delete(deleteTask);

router.route('/:id/complete')
  .patch(completeTask);

router.route('/:id/subtasks')
  .post(addSubtask);

export default router;