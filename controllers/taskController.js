import Task from '../models/Task.js';
import User from '../models/User.js';
import AppError from '../utils/appError.js';
import mongoose from 'mongoose';
import { calculateTaskXP } from '../utils/gamificationUtils.js';

/**
 * @desc    Get all tasks for a user with advanced filtering
 * @route   GET /api/tasks
 * @access  Private
 */
export const getTasks = async (req, res, next) => {
  try {
    // Build query based on filters
    const query = { userId: req.user.id };
    
    // Apply filters from query params
    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.category) query.category = req.query.category;
    if (req.query.completed) query.completed = req.query.completed === 'true';
    if (req.query.dueSoon) {
      query.dueDate = { 
        $gte: new Date(),
        $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
      };
    }

    const tasks = await Task.find(query)
      .populate('subtasks', 'title completed dueDate')
      .populate('relatedHabits', 'name currentStreak')
      .sort('-priority dueDate createdAt')
      .lean();

    res.status(200).json({
      status: 'success',
      results: tasks.length,
      data: { tasks }
    });
  } catch (error) {
    next(new AppError('Failed to fetch tasks', 500));
  }
};

/**
 * @desc    Create a new task with gamification
 * @route   POST /api/tasks
 * @access  Private
 */
export const createTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { title, priority, dueDate, estimatedDuration } = req.body;

    const task = await Task.create([{
      userId: req.user.id,
      title,
      priority,
      dueDate,
      estimatedDuration,
      baseXP: calculateTaskXP(priority, estimatedDuration),
      ...req.body
    }], { session });

    // Update user's task statistics
    await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { 'gameStats.taskCount': 1 } },
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      status: 'success',
      data: { task: task[0] }
    });
  } catch (error) {
    await session.abortTransaction();
    next(new AppError('Failed to create task', 400));
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Complete a task with XP rewards
 * @route   PATCH /api/tasks/:id/complete
 * @access  Private
 */
export const completeTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).session(session);

    if (!task) {
      throw new AppError('Task not found or not owned by user', 404);
    }

    // Mark as completed
    task.completed = true;
    task.status = 'done';
    task.completionDate = new Date();
    task.completionNotes = req.body.notes || '';

    // Calculate XP with potential bonuses
    const xpEarned = task.totalXP;
    const onTimeBonus = !task.isOverdue ? xpEarned * 0.2 : 0; // 20% bonus for on-time completion
    const totalXP = xpEarned + onTimeBonus;

    // Update user stats
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $inc: { 
          xp: totalXP,
          'gameStats.totalXP': totalXP,
          'gameStats.completedTasks': 1,
          ...(onTimeBonus > 0 && { 'gameStats.onTimeTasks': 1 })
        }
      },
      { new: true, session }
    );

    // Check for level up
    const newLevel = Math.floor(user.xp / 100) + 1;
    if (newLevel > user.level) {
      await User.findByIdAndUpdate(
        req.user.id,
        { $set: { level: newLevel } },
        { session }
      );
    }

    await task.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: { 
        task,
        xpEarned: totalXP,
        levelUp: newLevel > user.level ? newLevel : null,
        bonuses: {
          onTime: onTimeBonus
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Update task details
 * @route   PATCH /api/tasks/:id
 * @access  Private
 */
export const updateTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true, session }
    );

    if (!task) {
      throw new AppError('Task not found or not owned by user', 404);
    }

    // Recalculate XP if priority or duration changed
    if (req.body.priority || req.body.estimatedDuration) {
      task.baseXP = calculateTaskXP(
        req.body.priority || task.priority,
        req.body.estimatedDuration || task.estimatedDuration
      );
      await task.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: { task }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Delete a task
 * @route   DELETE /api/tasks/:id
 * @access  Private
 */
export const deleteTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    }).session(session);

    if (!task) {
      throw new AppError('Task not found or not owned by user', 404);
    }

    // Update user's task count
    await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { 'gameStats.taskCount': -1 } },
      { session }
    );

    // Delete all subtasks
    if (task.subtasks.length > 0) {
      await Task.deleteMany(
        { _id: { $in: task.subtasks } },
        { session }
      );
    }

    await session.commitTransaction();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Add a subtask
 * @route   POST /api/tasks/:id/subtasks
 * @access  Private
 */
export const addSubtask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const parentTask = await Task.findById(req.params.id).session(session);
    if (!parentTask) {
      throw new AppError('Parent task not found', 404);
    }

    const subtask = await parentTask.addSubtask({
      userId: req.user.id,
      ...req.body
    });

    await session.commitTransaction();

    res.status(201).json({
      status: 'success',
      data: { subtask }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get task analytics
 * @route   GET /api/tasks/analytics
 * @access  Private
 */
export const getTaskAnalytics = async (req, res, next) => {
  try {
    const tasks = await Task.find({ userId: req.user.id });
    const completedTasks = tasks.filter(t => t.completed);

    const analytics = {
      totalTasks: tasks.length,
      completedCount: completedTasks.length,
      completionRate: tasks.length > 0 
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : 0,
      priorityDistribution: {
        low: tasks.filter(t => t.priority === 'low').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        high: tasks.filter(t => t.priority === 'high').length,
        critical: tasks.filter(t => t.priority === 'critical').length
      },
      overdueTasks: tasks.filter(t => t.isOverdue).length,
      averageCompletionTime: calculateAverageCompletionTime(completedTasks),
      categoryDistribution: calculateCategoryDistribution(tasks)
    };

    res.status(200).json({
      status: 'success',
      data: { analytics }
    });
  } catch (error) {
    next(new AppError('Failed to generate task analytics', 500));
  }
};

// Helper function to calculate average completion time
function calculateAverageCompletionTime(completedTasks) {
  if (completedTasks.length === 0) return null;
  
  const totalDuration = completedTasks.reduce((sum, task) => {
    if (task.completionDate && task.createdAt) {
      return sum + (task.completionDate - task.createdAt);
    }
    return sum;
  }, 0);

  const averageMs = totalDuration / completedTasks.length;
  return Math.round(averageMs / (1000 * 60 * 60 * 24)); // Convert to days
}

// Helper function to calculate category distribution
function calculateCategoryDistribution(tasks) {
  const distribution = {};
  tasks.forEach(task => {
    distribution[task.category] = (distribution[task.category] || 0) + 1;
  });
  return distribution;
}