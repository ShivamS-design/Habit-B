import mongoose from 'mongoose';
import { User, Habit, Task, LocalData } from '../models/index.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Optional: Create indexes
    await User.init();
    await Habit.init();
    await Task.init();
    await LocalData.init();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;