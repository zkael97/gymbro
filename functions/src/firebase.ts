import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

export const COLLECTIONS = {
  USERS: "users",
  GYM_MOVES: "gym_moves",
  WORKOUT_LOGS: "workout_logs",
} as const;
