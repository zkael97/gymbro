import { Timestamp } from "firebase-admin/firestore";

export interface UserDoc {
  username: string;
  passwordHash: string;
  createdAt: Timestamp;
  lastLogin: Timestamp | null;
}

export type MoveType = "upper" | "lower";

export interface GymMoveDoc {
  username?: string | null;
  title: string;
  description: string;
  type: MoveType;
  category: string;
  createdAt: Timestamp;
}

export interface WorkoutLogDoc {
  username: string;
  moveId: string | null;
  moveTitle: string;
  weight: number;
  reps: number[];
  date: string; // "YYYY-MM-DD"
  createdAt: Timestamp;
}

// Client DTOs matching frontend expectations exactly
export interface GymMoveResponse {
  id: string;
  username?: string;
  title: string;
  description: string;
  type: MoveType;
  category: string;
  createdDate: string;
}

export interface WorkoutLogResponse {
  id: string;
  username: string;
  moveId: string | null;
  moveTitle: string;
  weight: number;
  reps: number[];
  date: string;
  createdDate: string;
}
