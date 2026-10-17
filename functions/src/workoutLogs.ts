import { Router, Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db, COLLECTIONS } from "./firebase";
import { WorkoutLogDoc, WorkoutLogResponse } from "./types";

export const workoutLogsRouter = Router();

// GET /api/workout-logs?username=...
workoutLogsRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const usernameQuery = req.query.username ? String(req.query.username).trim().toLowerCase() : "";

    const logsRef = db.collection(COLLECTIONS.WORKOUT_LOGS);
    let querySnapshot;

    if (usernameQuery) {
      querySnapshot = await logsRef
        .where("username", "==", usernameQuery)
        .orderBy("date", "desc")
        .orderBy("createdAt", "desc")
        .get();
    } else {
      querySnapshot = await logsRef
        .orderBy("date", "desc")
        .orderBy("createdAt", "desc")
        .get();
    }

    const logs: WorkoutLogResponse[] = querySnapshot.docs.map((doc) => {
      const data = doc.data() as WorkoutLogDoc;
      return {
        id: doc.id,
        username: data.username,
        moveId: data.moveId !== undefined ? String(data.moveId) : null,
        moveTitle: data.moveTitle || "",
        weight: Number(data.weight) || 0,
        reps: Array.isArray(data.reps) ? data.reps : [],
        date: data.date,
        createdDate: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    res.status(200).json(logs);
  } catch (error) {
    console.error("workoutLogs GET error:", error);
    res.status(500).json({ message: "Database error" });
  }
});

// POST /api/workout-logs
workoutLogsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, moveId, moveTitle, weight, reps, date } = req.body;

    if (!moveTitle) {
      res.status(400).json({ message: "Exercise is required" });
      return;
    }

    // Parse reps: support array of numbers or single number
    const parsedReps: number[] = [];
    if (Array.isArray(reps)) {
      for (const item of reps) {
        const num = Number(item);
        if (!isNaN(num) && num > 0) {
          parsedReps.push(num);
        }
      }
    } else if (typeof reps === "number" && reps > 0) {
      parsedReps.push(reps);
    } else if (typeof reps === "string") {
      const num = Number(reps);
      if (!isNaN(num) && num > 0) {
        parsedReps.push(num);
      }
    }

    if (parsedReps.length === 0) {
      res.status(400).json({ message: "Exercise and at least 1 valid repetition are required" });
      return;
    }

    const logDate = date && typeof date === "string" && date.trim() ? date.trim() : new Date().toISOString().split("T")[0];
    const cleanUsername = username ? String(username).trim().toLowerCase() : "";

    const newDoc: WorkoutLogDoc = {
      username: cleanUsername,
      moveId: moveId !== undefined && moveId !== null ? String(moveId) : null,
      moveTitle: String(moveTitle).trim(),
      weight: Number(weight) || 0,
      reps: parsedReps,
      date: logDate,
      createdAt: Timestamp.now(),
    };

    const docRef = await db.collection(COLLECTIONS.WORKOUT_LOGS).add(newDoc);

    const response: WorkoutLogResponse = {
      id: docRef.id,
      username: newDoc.username,
      moveId: newDoc.moveId,
      moveTitle: newDoc.moveTitle,
      weight: newDoc.weight,
      reps: newDoc.reps,
      date: newDoc.date,
      createdDate: newDoc.createdAt.toDate().toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("workoutLogs POST error:", error);
    res.status(500).json({ message: "Database error" });
  }
});
