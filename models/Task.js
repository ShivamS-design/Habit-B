import mongoose from 'mongoose';
import AppError from '../utils/appError.js';

const TaskSchema = new mongoose.Schema({
  // Core Task Properties
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'A task must belong to a user']
  },
  title: {
    type: String,
    required: [true, 'A task must have a title'],
    trim: true,
    maxlength: [100, 'Task title cannot exceed 100 characters'],
    minlength: [3, 'Task title must be at least 3 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Status Tracking
  completed: {
    type: Boolean,
    default: false
  },
  completionDate: Date,
  completionNotes: String,
  status: {
    type: String,
    enum: ['backlog', 'todo', 'in-progress', 'done', 'archived'],
    default: 'todo'
  },

  // Priority and Categorization
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  tags: [{
    type: String,
    maxlength: [20, 'Tags cannot exceed 20 characters']
  }],
  category: {
    type: String,
    enum: ['work', 'personal', 'health', 'learning', 'other'],
    default: 'personal'
  },

  // Time Management
  dueDate: Date,
  startDate: Date,
  estimatedDuration: { // in minutes
    type: Number,
    min: [1, 'Duration must be at least 1 minute']
  },
  actualDuration: { // in minutes
    type: Number,
    min: 0
  },
  reminder: {
    enabled: Boolean,
    time: Date
  },

  // Task Relationships
  parentTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  subtasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  blockedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  relatedHabits: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Habit'
  }],

  // Gamification
  baseXP: {
    type: Number,
    default: 5,
    min: 1
  },
  priorityMultiplier: {
    type: Number,
    default: 1.0,
    min: 1.0,
    max: 3.0
  },
  streakBonus: {
    type: Number,
    default: 0,
    min: 0
  },

  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  },
  lastUpdated: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
TaskSchema.index({ userId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ completed: 1 });
TaskSchema.index({ category: 1 });
TaskSchema.index({ tags: 1 });

// Virtual Properties
TaskSchema.virtual('totalXP').get(function() {
  return Math.round(this.baseXP * this.priorityMultiplier + this.streakBonus);
});

TaskSchema.virtual('urgencyScore').get(function() {
  if (!this.dueDate) return 0;
  
  const now = new Date();
  const hoursRemaining = (this.dueDate - now) / (1000 * 60 * 60);
  
  if (hoursRemaining <= 24) return 100;
  if (hoursRemaining <= 72) return 75;
  if (hoursRemaining <= 168) return 50;
  return 25;
});

TaskSchema.virtual('isOverdue').get(function() {
  return this.dueDate && new Date() > this.dueDate && !this.completed;
});

TaskSchema.virtual('progress').get(function() {
  if (this.completed) return 100;
  if (this.subtasks.length === 0) return 0;
  
  const completedSubtasks = this.subtasks.filter(t => t.completed).length;
  return Math.round((completedSubtasks / this.subtasks.length) * 100);
});

// Pre-save hooks
TaskSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  
  // Auto-calculate priority multiplier
  this.priorityMultiplier = {
    low: 1.0,
    medium: 1.5,
    high: 2.0,
    critical: 3.0
  }[this.priority] || 1.0;

  next();
});

// Static Methods
TaskSchema.statics.getUserTasks = async function(userId, filters = {}) {
  const defaultFilters = {
    status: { $ne: 'archived' },
    isActive: true
  };
  
  const finalFilters = { userId, ...defaultFilters, ...filters };
  
  return this.find(finalFilters)
    .populate('subtasks', 'title completed')
    .populate('relatedHabits', 'name currentStreak')
    .sort('-priority dueDate');
};

TaskSchema.statics.calculateCompletionStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      avgDuration: { $avg: '$estimatedDuration' }
    }},
    { $project: {
      status: '$_id',
      count: 1,
      avgDuration: 1,
      _id: 0
    }}
  ]);
  
  return stats.reduce((acc, curr) => {
    acc[curr.status] = curr;
    return acc;
  }, {});
};

// Instance Methods
TaskSchema.methods.complete = async function(notes = '') {
  this.completed = true;
  this.status = 'done';
  this.completionDate = new Date();
  this.completionNotes = notes;
  
  // Update all subtasks
  if (this.subtasks.length > 0) {
    await this.model('Task').updateMany(
      { _id: { $in: this.subtasks } },
      { $set: { completed: true, status: 'done' } }
    );
  }
  
  await this.save();
  return this;
};

TaskSchema.methods.addSubtask = async function(taskData) {
  const subtask = await this.model('Task').create({
    ...taskData,
    userId: this.userId,
    parentTask: this._id
  });
  
  this.subtasks.push(subtask._id);
  await this.save();
  return subtask;
};

TaskSchema.methods.setReminder = function(hoursBefore = 24) {
  if (!this.dueDate) {
    throw new AppError('Cannot set reminder without due date', 400);
  }
  
  const reminderTime = new Date(this.dueDate);
  reminderTime.setHours(reminderTime.getHours() - hoursBefore);
  
  this.reminder = {
    enabled: true,
    time: reminderTime
  };
  
  return this.save();
};

const Task = mongoose.model('Task', TaskSchema);

export default Task;