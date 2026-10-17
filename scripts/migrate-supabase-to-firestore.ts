import * as dotenv from "dotenv";
import { Client } from "pg";
import * as admin from "firebase-admin";

dotenv.config();

// Ensure service account or default credentials
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }
}

const firestore = admin.firestore();

interface MigrationStats {
  usersMigrated: number;
  gymMovesMigrated: number;
  workoutLogsMigrated: number;
  errors: string[];
}

async function migrate() {
  const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DB_URL must be specified in the environment");
  }

  const pgClient = new Client({
    connectionString,
    ssl: process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  console.log("Connecting to PostgreSQL...");
  await pgClient.connect();
  console.log("Connected to PostgreSQL ✓");

  const stats: MigrationStats = {
    usersMigrated: 0,
    gymMovesMigrated: 0,
    workoutLogsMigrated: 0,
    errors: [],
  };

  try {
    // 1. Migrate Users
    console.log("\n[1/3] Migrating users...");
    const usersResult = await pgClient.query("SELECT id, username, password, created_at, last_login FROM users");
    const userBatch = firestore.batch();

    for (const row of usersResult.rows) {
      try {
        const username = String(row.username).trim().toLowerCase();
        const userRef = firestore.collection("users").doc(username);
        userBatch.set(
          userRef,
          {
            username,
            passwordHash: row.password,
            createdAt: row.created_at ? admin.firestore.Timestamp.fromDate(new Date(row.created_at)) : admin.firestore.Timestamp.now(),
            lastLogin: row.last_login ? admin.firestore.Timestamp.fromDate(new Date(row.last_login)) : null,
            legacyPgId: row.id,
          },
          { merge: true }
        );
        stats.usersMigrated++;
      } catch (err: any) {
        stats.errors.push(`User error (${row.username}): ${err.message}`);
      }
    }
    await userBatch.commit();
    console.log(`✓ Migrated ${stats.usersMigrated} users`);

    // 2. Migrate Gym Moves
    console.log("\n[2/3] Migrating gym moves...");
    const movesResult = await pgClient.query("SELECT id, username, title, description, type, category, created_at FROM gym_moves");
    const moveIdMap = new Map<number, string>(); // Map pgId -> firestoreDocId

    for (const row of movesResult.rows) {
      try {
        const moveRef = firestore.collection("gym_moves").doc();
        await moveRef.set({
          username: row.username ? String(row.username).trim().toLowerCase() : null,
          title: String(row.title).trim(),
          description: row.description || "",
          type: row.type === "lower" ? "lower" : "upper",
          category: String(row.category).trim(),
          createdAt: row.created_at ? admin.firestore.Timestamp.fromDate(new Date(row.created_at)) : admin.firestore.Timestamp.now(),
          legacyPgId: row.id,
        });
        moveIdMap.set(row.id, moveRef.id);
        stats.gymMovesMigrated++;
      } catch (err: any) {
        stats.errors.push(`Gym move error (id ${row.id}): ${err.message}`);
      }
    }
    console.log(`✓ Migrated ${stats.gymMovesMigrated} gym moves`);

    // 3. Migrate Workout Logs (in chunks of 400 for Firestore batch limit)
    console.log("\n[3/3] Migrating workout logs...");
    const logsResult = await pgClient.query("SELECT id, username, move_id, move_title, weight, reps, date, created_at FROM workout_logs ORDER BY id ASC");
    
    let currentBatch = firestore.batch();
    let batchCount = 0;

    for (const row of logsResult.rows) {
      try {
        const mappedMoveId = row.move_id ? (moveIdMap.get(row.move_id) || String(row.move_id)) : null;
        const logRef = firestore.collection("workout_logs").doc();
        
        let repsArray: number[] = [];
        if (Array.isArray(row.reps)) {
          repsArray = row.reps.map(Number).filter((n) => !isNaN(n) && n > 0);
        } else if (typeof row.reps === "number") {
          repsArray = [row.reps];
        }

        const dateStr = row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date);

        currentBatch.set(logRef, {
          username: String(row.username).trim().toLowerCase(),
          moveId: mappedMoveId,
          moveTitle: String(row.move_title || "").trim(),
          weight: Number(row.weight) || 0,
          reps: repsArray,
          date: dateStr,
          createdAt: row.created_at ? admin.firestore.Timestamp.fromDate(new Date(row.created_at)) : admin.firestore.Timestamp.now(),
          legacyPgId: row.id,
        });

        stats.workoutLogsMigrated++;
        batchCount++;

        if (batchCount >= 400) {
          await currentBatch.commit();
          currentBatch = firestore.batch();
          batchCount = 0;
        }
      } catch (err: any) {
        stats.errors.push(`Workout log error (id ${row.id}): ${err.message}`);
      }
    }

    if (batchCount > 0) {
      await currentBatch.commit();
    }
    console.log(`✓ Migrated ${stats.workoutLogsMigrated} workout logs`);

  } finally {
    await pgClient.end();
  }

  console.log("\n================ Migration Summary ================");
  console.log(`Users:        ${stats.usersMigrated}`);
  console.log(`Gym Moves:    ${stats.gymMovesMigrated}`);
  console.log(`Workout Logs: ${stats.workoutLogsMigrated}`);
  if (stats.errors.length > 0) {
    console.warn(`Errors encountered (${stats.errors.length}):`);
    stats.errors.forEach((e) => console.warn(" -", e));
  } else {
    console.log("Migration completed with ZERO errors! ✓");
  }
}

migrate().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
