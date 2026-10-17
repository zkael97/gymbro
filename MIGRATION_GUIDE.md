# GymBro Migration Guide: Supabase (PostgreSQL) + Railway -> Firebase (Firestore + Cloud Functions)

This guide documents the architecture, database schema, data migration, security rules, and deployment procedures.

---

## 1. Architecture & Schema Mapping

### Collections & Document Models

#### `users`
- **Document ID**: `cleanUsername` (e.g. `john_doe`, lowercased and trimmed)
- **Fields**:
  - `username` (string): Username identifier.
  - `passwordHash` (string): Bcrypt hashed password (cost 10).
  - `createdAt` (Timestamp): Registration timestamp.
  - `lastLogin` (Timestamp | null): Last successful login timestamp.
  - `legacyPgId` (optional number): Preserved reference from PostgreSQL `users.id`.

#### `gym_moves`
- **Document ID**: Auto-generated Firestore document ID.
- **Fields**:
  - `username` (string | null): Username for user-created custom moves, or `null` for global/system moves.
  - `title` (string): Exercise name (e.g. "Barbell Bench Press").
  - `description` (string): Description of the movement.
  - `type` ("upper" | "lower"): Target muscle group area.
  - `category` (string): Specific muscle target (e.g. "Chest", "Quadriceps").
  - `createdAt` (Timestamp): Creation timestamp.
  - `legacyPgId` (optional number): Preserved reference from PostgreSQL `gym_moves.id`.

#### `workout_logs`
- **Document ID**: Auto-generated Firestore document ID.
- **Fields**:
  - `username` (string): Owner of the log entry.
  - `moveId` (string | null): Reference to Firestore `gym_moves` document ID.
  - `moveTitle` (string): Cached title of the exercise.
  - `weight` (number): Weight used (kg/lbs).
  - `reps` (number[]): Array of reps completed per set (e.g. `[10, 8, 8]`).
  - `date` (string): ISO date string `YYYY-MM-DD`.
  - `createdAt` (Timestamp): Creation timestamp.
  - `legacyPgId` (optional number): Preserved reference from PostgreSQL `workout_logs.id`.

---

## 2. Directory Structure

```
├── firestore.rules          # Strict security rules for Firestore access
├── firestore.indexes.json   # Composite indexes for querying moves and logs
├── firebase.json            # Firebase configuration for Functions & Firestore
├── functions/               # Modular Cloud Functions v2 backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── firebase.ts      # Firebase Admin SDK init & constants
│       ├── types.ts         # TypeScript schema & response types
│       ├── auth.ts          # /api/register, /api/login, /api/logout, /api/forgot-password
│       ├── gymMoves.ts      # GET & POST /api/gym-moves
│       ├── workoutLogs.ts   # GET & POST /api/workout-logs
│       └── index.ts         # Express server & CORS configuration
└── scripts/
    ├── package.json
    └── migrate-supabase-to-firestore.ts # Batch migration script from PG to Firestore
```

---

## 3. Data Migration (Supabase to Firestore)

### Running the Migration:
1. Ensure your PostgreSQL connection string (from Supabase) is set in your `.env` or exported in your shell:
   ```bash
   export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
   ```
2. If using a Firebase Service Account key file:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH="/path/to/serviceAccountKey.json"
   ```
   *(Alternatively, run `firebase login` and use default credentials if authenticated)*.
3. Execute the migration:
   ```bash
   cd scripts
   npm install
   npx ts-node migrate-supabase-to-firestore.ts
   ```
4. The migration script executes atomic batches (max 400 writes per batch) mapping legacy foreign keys (`move_id`) to new Firestore document IDs.

---

## 4. Deploying to Firebase

1. **Login to Firebase**:
   ```bash
   firebase login
   ```
2. **Associate or Select Your Firebase Project**:
   ```bash
   firebase use <your-firebase-project-id>
   ```
3. **Deploy Firestore Rules & Indexes**:
   ```bash
   firebase deploy --only firestore
   ```
4. **Deploy Cloud Functions**:
   ```bash
   firebase deploy --only functions
   ```
5. **Update Frontend Environment**:
   After deployment, Firebase CLI will output your function URL:
   `https://<region>-<project-id>.cloudfunctions.net/api`
   
   Update `frontend/src/environments/environment.prod.ts` with this URL.
