import express from 'express';
import { 
  getTasks, 
  createTask, 
  completeTask, 
  updateTask, 
  deleteTask,
  addSubtask,
  getTaskAnalytics
} from '../controllers/taskController.js';
import { verifyUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes with authentication middleware
router.use(verifyUser);

// Task management routes
router.route('/')
  .get(getTasks)          // Get all tasks for the authenticated user
  .post(createTask);      // Create a new task

// Analytics route
router.route('/analytics')
  .get(getTaskAnalytics); // Get task analytics for the user

// Task-specific routes
router.route('/:id')
  .patch(updateTask)      // Update a specific task
  .delete(deleteTask);    // Delete a specific task

// Task completion route
router.route('/:id/complete')
  .patch(completeTask);   // Mark a task as completed

// Subtask route
router.route('/:id/subtasks')
  .post(addSubtask);     // Add a subtask to a task

export default router;
