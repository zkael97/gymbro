export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface ExerciseSet {
  setNumber: number;
  targetReps: number;
  targetWeightKg?: number;
  restSeconds?: number;
}

export interface TrainingExercise {
  id?: string;
  gymMoveId?: string; // Reference to GymMoveItem if selected
  name: string;
  category?: string; // e.g. Chest, Back, Legs
  notes?: string;
  sets: ExerciseSet[];
}

export interface WorkoutDay {
  dayOfWeek: DayOfWeek;
  title: string; // e.g., "Push Day A", "Leg Hypertrophy", "Rest Day"
  isRestDay: boolean;
  notes?: string;
  exercises: TrainingExercise[];
}

export interface TrainingPlan {
  id?: string;
  username: string;
  title: string; // e.g., "PPL 6-Day Hypertrophy"
  description?: string;
  isActive: boolean; // Active current routine
  days: WorkoutDay[];
  createdDate?: string;
  updatedDate?: string;
}

export type CreateTrainingPlanDto = Omit<TrainingPlan, 'id' | 'createdDate' | 'updatedDate'>;
export type UpdateTrainingPlanDto = Partial<Omit<TrainingPlan, 'id' | 'username' | 'createdDate'>>;
