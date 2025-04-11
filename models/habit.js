import mongoose from 'mongoose';
const HabitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  completed: { type: Boolean, default: false },
  xp: { type: Number, default: 10 },
});
export default mongoose.model('Habit', HabitSchema);