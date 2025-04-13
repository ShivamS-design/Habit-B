export const calculateTaskXP = (priority, estimatedDuration) => {
  const priorityMultipliers = {
    low: 1,
    medium: 1.5,
    high: 2,
    critical: 3
  };
  
  const baseXP = 5;
  const durationMultiplier = Math.min(1 + (estimatedDuration / 60), 3); // Cap at 3x
  
  return Math.round(baseXP * priorityMultipliers[priority] * durationMultiplier);
};

export const calculateStreakBonus = (streak) => {
  return Math.min(Math.floor(streak / 3) * 5, 100); // Max 100 bonus
};