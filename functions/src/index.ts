import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";
import { authRouter } from "./auth";
import { gymMovesRouter } from "./gymMoves";
import { workoutLogsRouter } from "./workoutLogs";

const app = express();

// Allowed origins configuration (parity with previous Go backend)
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// Routes mounting
app.use("/api", authRouter);
app.use("/api/gym-moves", gymMovesRouter);
app.use("/api/workout-logs", workoutLogsRouter);

// Root healthcheck
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Export Cloud Function v2 HTTPS handler
export const api = functions.https.onRequest(app);
