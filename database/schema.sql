-- =============================================================
-- GymBro Database Schema (PostgreSQL)
-- Run once to initialize the database:
--   psql -U gymbro_user -d gymbro -f schema.sql
-- =============================================================

-- ---------------------
-- USERS TABLE
-- ---------------------
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login  TIMESTAMP WITH TIME ZONE
);

-- ---------------------
-- GYM MOVES TABLE
-- ---------------------
CREATE TABLE IF NOT EXISTS gym_moves (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100),
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('upper', 'lower')),
    category    VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------
-- WORKOUT LOGS TABLE
-- ---------------------
CREATE TABLE IF NOT EXISTS workout_logs (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    move_id     INTEGER REFERENCES gym_moves(id) ON DELETE SET NULL,
    move_title  VARCHAR(200) NOT NULL,
    weight      NUMERIC(6,2) DEFAULT 0,
    reps        INTEGER[]    NOT NULL,
    date        DATE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_workout_logs_username ON workout_logs(username);
CREATE INDEX IF NOT EXISTS idx_workout_logs_date     ON workout_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_gym_moves_username    ON gym_moves(username);
CREATE INDEX IF NOT EXISTS idx_gym_moves_type        ON gym_moves(type);

-- ---------------------
-- DEFAULT GYM MOVES (seed data)
-- ---------------------
INSERT INTO gym_moves (title, description, type, category) VALUES
    ('Barbell Bench Press', 'Compound chest movement targeting pectoralis major, anterior deltoids, and triceps.', 'upper', 'Chest'),
    ('Pull Up',             'Bodyweight vertical pull movement targeting latissimus dorsi and biceps.',              'upper', 'Back'),
    ('Overhead Press',      'Shoulder dominant pressing movement engaging deltoids, triceps, and upper traps.',     'upper', 'Shoulders'),
    ('Barbell Curl',        'Isolation movement targeting biceps brachii and brachialis.',                          'upper', 'Arms'),
    ('Tricep Pushdown',     'Cable isolation for triceps brachii, all three heads.',                               'upper', 'Arms'),
    ('Barbell Back Squat',  'Fundamental lower body exercise for quadriceps, hamstrings, and core stability.',     'lower', 'Quadriceps'),
    ('Leg Press',           'Machine-based quad dominant lower body push movement.',                               'lower', 'Quadriceps'),
    ('Romanian Deadlift',   'Hip hinge movement targeting hamstrings, glutes, and erector spinae.',                'lower', 'Hamstring'),
    ('Deadlift',            'Full-body powerhouse movement engaging posterior chain, glutes, and lower back.',     'lower', 'Hamstring'),
    ('Hip Thrust',          'Glute dominant movement with barbell load for maximum posterior activation.',         'lower', 'Glutes'),
    ('Standing Calf Raise', 'Isolation movement targeting the gastrocnemius and soleus muscles.',                  'lower', 'Calves')
ON CONFLICT DO NOTHING;
