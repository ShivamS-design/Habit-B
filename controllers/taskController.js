const Task = require('../models/Task');

// Get all tasks for a user
const getTasks = async (req, res) => {
  const tasks = await Task.find({ userId: req.user.id });
  res.json({ tasks });
};

// Create a new task
const createTask = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Task name is required' });

  const newTask = new Task({ userId: req.user.id, name });
  await newTask.save();

  res.status(201).json({ message: 'Task created', task: newTask });
};

// Mark task as completed
const completeTask = async (req, res) => {
  const { completed } = req.body;
  const task = await Task.findByIdAndUpdate(req.params.taskId, { completed }, { new: true });
  res.json({ message: 'Task updated', task });
};

// Delete a task
const deleteTask = async (req, res) => {
  await Task.findByIdAndDelete(req.params.taskId);
  res.json({ message: 'Task deleted' });
};

module.exports = { getTasks, createTask, completeTask, deleteTask };