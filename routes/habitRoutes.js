import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import Habit from '../models/habit.js';

const router = express.Router();

// Get all habits
router.get('/', verifyToken, async (req, res) => {
  const habits = await Habit.find({ userId: req.user.id });
  res.json({ habits });
});

// Create a new habit
router.post('/', verifyToken, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Habit name is required' });

  const newHabit = new Habit({ userId: req.user.id, name });
  await newHabit.save();

  res.status(201).json({ message: 'Habit created', habit: newHabit });
});

export default router;