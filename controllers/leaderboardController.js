import User from '../models/User.js';

// Get leaderboard (Top 10 users by XP)

export const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.find().sort({ xp: -1 }).limit(10);
    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


