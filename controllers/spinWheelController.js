import User from '../models/User.js';

const rewards = [
  { xp: 10 }, { xp: 20 }, { xp: 30 }, { xp: 40 }, { xp: 50 }, { xp: 60 }
];

// Spin the wheel and assign a reward
export const spinWheel = async (req, res) => {
  try {
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    
    const user = await User.findById(req.user.id);
    user.xp += reward.xp;
    await user.save();

    res.json({ message: `You won ${reward.xp} XP!`, xp: user.xp });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
