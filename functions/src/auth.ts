import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { Timestamp } from "firebase-admin/firestore";
import { db, COLLECTIONS } from "./firebase";
import { UserDoc } from "./types";

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string" || !password || typeof password !== "string") {
      res.status(400).json({ message: "Username and password are required" });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      res.status(400).json({ message: "Username must be at least 3 characters" });
      return;
    }

    const userRef = db.collection(COLLECTIONS.USERS).doc(cleanUsername);

    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists) {
        throw new Error("ALREADY_EXISTS");
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser: UserDoc = {
        username: cleanUsername,
        passwordHash,
        createdAt: Timestamp.now(),
        lastLogin: null,
      };

      transaction.set(userRef, newUser);
    });

    res.status(201).json({
      message: "Registration successful",
      user: { id: cleanUsername, username: cleanUsername },
    });
  } catch (error: any) {
    if (error.message === "ALREADY_EXISTS") {
      res.status(409).json({ message: "Username already exists" });
      return;
    }
    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required" });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const userRef = db.collection(COLLECTIONS.USERS).doc(cleanUsername);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    const userData = userSnap.data() as UserDoc;
    let passwordMatches = false;

    // Check bcrypt hash
    if (userData.passwordHash.startsWith("$2a$") || userData.passwordHash.startsWith("$2b$") || userData.passwordHash.startsWith("$2y$")) {
      passwordMatches = await bcrypt.compare(password, userData.passwordHash);
    } else if (userData.passwordHash === password) {
      // Legacy plaintext migration fallback
      passwordMatches = true;
      const upgradedHash = await bcrypt.hash(password, 10);
      await userRef.update({ passwordHash: upgradedHash });
    }

    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    await userRef.update({ lastLogin: Timestamp.now() });

    res.status(200).json({
      token: "dummy-jwt-token-12345",
      message: "Login successful",
      user: { id: cleanUsername, username: cleanUsername },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

authRouter.post("/logout", (_req: Request, res: Response): void => {
  res.status(200).json({ message: "Logout successful" });
});

authRouter.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      res.status(400).json({ message: "Username and new password are required" });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const userRef = db.collection(COLLECTIONS.USERS).doc(cleanUsername);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).json({ message: "Username not found" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRef.update({ passwordHash });

    res.status(200).json({ message: "Password has been successfully updated" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
