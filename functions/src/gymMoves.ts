import { Router, Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db, COLLECTIONS } from "./firebase";
import { GymMoveDoc, GymMoveResponse, MoveType } from "./types";

export const gymMovesRouter = Router();

// GET /api/gym-moves?username=...
gymMovesRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const usernameQuery = req.query.username ? String(req.query.username).trim().toLowerCase() : "";
    if (!usernameQuery) {
      res.status(200).json([]);
      return;
    }

    const movesRef = db.collection(COLLECTIONS.GYM_MOVES);
    const querySnapshot = await movesRef
      .where("username", "==", usernameQuery)
      .orderBy("createdAt", "desc")
      .get();

    const moves: GymMoveResponse[] = querySnapshot.docs.map((doc) => {
      const data = doc.data() as GymMoveDoc;
      return {
        id: doc.id,
        username: data.username || "",
        title: data.title,
        description: data.description || "",
        type: data.type,
        category: data.category,
        createdDate: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    res.status(200).json(moves);
  } catch (error) {
    console.error("gymMoves GET error:", error);
    res.status(500).json({ message: "Database error" });
  }
});

// POST /api/gym-moves
gymMovesRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, title, description, type, category } = req.body;

    const cleanUsername = username ? String(username).trim().toLowerCase() : "";
    if (!cleanUsername || !title || !type || !category) {
      res.status(400).json({ message: "Username, title, type, and category are required" });
      return;
    }

    const normalizedType = String(type).toLowerCase() as MoveType;
    if (normalizedType !== "upper" && normalizedType !== "lower") {
      res.status(400).json({ message: "Type must be either 'upper' or 'lower'" });
      return;
    }

    const newDoc: GymMoveDoc = {
      username: cleanUsername,
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      type: normalizedType,
      category: String(category).trim(),
      createdAt: Timestamp.now(),
    };

    const docRef = await db.collection(COLLECTIONS.GYM_MOVES).add(newDoc);

    const response: GymMoveResponse = {
      id: docRef.id,
      username: newDoc.username || "",
      title: newDoc.title,
      description: newDoc.description,
      type: newDoc.type,
      category: newDoc.category,
      createdDate: newDoc.createdAt.toDate().toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("gymMoves POST error:", error);
    res.status(500).json({ message: "Database error" });
  }
});
