export const calculateStreakBonus = (streak) => {
  return Math.min(Math.floor(streak / 3) * 5, 100); // Max 100 bonus
};

export const calculateHabitXP = (difficulty, streak) => {
  const difficultyMultipliers = {
    easy: 1,
    medium: 1.5,
    hard: 2,
    extreme: 3
  };
  const baseXP = 10;
  return baseXP * difficultyMultipliers[difficulty] + calculateStreakBonus(streak);
};