
import Habit from '../models/habit.js';

// Get all habits for a user
const getHabits = async (req, res) => {
  const habits = await Habit.find({ userId: req.user.id });
  res.json({ habits });
};

// Create a new habit
const createHabit = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Habit name is required' });

  const newHabit = new Habit({ userId: req.user.id, name });
  await newHabit.save();

  res.status(201).json({ message: 'Habit created', habit: newHabit });
};

// Mark habit as completed
const completeHabit = async (req, res) => {
  const habit = await Habit.findById(req.params.habitId);
  if (!habit) return res.status(404).json({ message: 'Habit not found' });

  habit.completed = true;
  habit.xp += 10; // Reward XP
  await habit.save();

  res.json({ message: 'Habit completed', habit });
};

// Delete a habit
const deleteHabit = async (req, res) => {
  await Habit.findByIdAndDelete(req.params.habitId);
  res.json({ message: 'Habit deleted' });
};

module.exports = { getHabits, createHabit, completeHabit, deleteHabit };