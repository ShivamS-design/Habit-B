import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import Habit from '../models/habit.js';

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.user.id });
    res.json({ habits });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Habit name is required' });

    const newHabit = new Habit({ userId: req.user.id, name });
    await newHabit.save();
    res.status(201).json({ message: 'Habit created', habit: newHabit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
