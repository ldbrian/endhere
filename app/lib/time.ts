export type TimeSlice = 'DEEP_NIGHT' | 'DAWN' | 'DAYTIME' | 'DUSK_TO_MIDNIGHT';

export const calculateTimeSlice = (date: Date): TimeSlice => {
  const hour = date.getHours();
  if (hour >= 0 && hour < 5) return 'DEEP_NIGHT';
  if (hour >= 5 && hour < 8) return 'DAWN';
  if (hour >= 8 && hour < 18) return 'DAYTIME';
  return 'DUSK_TO_MIDNIGHT';
};