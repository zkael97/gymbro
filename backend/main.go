package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

// ─── DB Pool ────────────────────────────────────────────────────────────────

var db *pgxpool.Pool

func initDB() {
	// Load .env file if present (ignored if not found)
	if err := godotenv.Load(); err != nil {
		log.Println("[INFO] .env file not found, reading env vars from system")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DB_URL")
	}
	if dsn == "" {
		log.Fatal("DATABASE_URL or DB_URL environment variable must be set")
	}

	var err error
	db, err = pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatalf("Unable to create database pool: %v\n", err)
	}

	if err = db.Ping(context.Background()); err != nil {
		log.Fatalf("Database ping failed: %v\n", err)
	}

	// Auto-migration: ensure username column exists on gym_moves for per-user moves
	_, err = db.Exec(context.Background(), `
		ALTER TABLE gym_moves ADD COLUMN IF NOT EXISTS username VARCHAR(100);
		CREATE INDEX IF NOT EXISTS idx_gym_moves_username ON gym_moves(username);
	`)
	if err != nil {
		log.Printf("[WARN] Failed to auto-migrate gym_moves username column: %v", err)
	}

	log.Println("Connected to PostgreSQL ✓")
}

// ─── CORS Middleware ────────────────────────────────────────────────────────

// allowedOrigins holds the parsed list from ALLOWED_ORIGINS env var.
// If empty, CORS falls back to reflecting the request Origin (dev mode).
var allowedOrigins []string

func initCORS() {
	raw := os.Getenv("ALLOWED_ORIGINS") // e.g. "https://gymbro.vercel.app,https://www.gymbro.com"
	if raw != "" {
		for _, o := range strings.Split(raw, ",") {
			trimmed := strings.TrimSpace(o)
			if trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
		log.Printf("CORS allowed origins: %v", allowedOrigins)
	} else {
		log.Println("[INFO] ALLOWED_ORIGINS not set — CORS will reflect request origin (dev mode)")
	}
}

func isOriginAllowed(origin string) bool {
	if len(allowedOrigins) == 0 {
		return true // dev/default mode: allow any origin
	}
	for _, allowed := range allowedOrigins {
		if allowed == "*" || origin == allowed || strings.HasSuffix(origin, ".vercel.app") {
			return true
		}
	}
	return false
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin != "" {
			if isOriginAllowed(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		} else {
			// Fallback if no Origin header provided (or non-browser curl requests)
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next(w, r)
	}
}

// ─── AUTH ───────────────────────────────────────────────────────────────────

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token   string      `json:"token,omitempty"`
	Message string      `json:"message"`
	User    interface{} `json:"user,omitempty"`
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if req.Username == "" || req.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Username and password are required"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Hash password error: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Internal server error"})
		return
	}

	var id int
	err = db.QueryRow(context.Background(),
		`INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id`,
		req.Username, string(hashedPassword),
	).Scan(&id)

	if err != nil {
		// Check for unique violation (username already exists)
		if isPgUniqueViolation(err) {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(LoginResponse{Message: "Username already exists"})
			return
		}
		log.Printf("Register error: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Internal server error"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(LoginResponse{
		Message: "Registration successful",
		User:    map[string]interface{}{"id": id, "username": req.Username},
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var id int
	var storedPassword string
	err := db.QueryRow(context.Background(),
		`SELECT id, password FROM users WHERE username = $1`,
		req.Username,
	).Scan(&id, &storedPassword)

	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Invalid username or password"})
		return
	}

	// Verify bcrypt hash, with fallback to plaintext for existing users prior to hashing
	passwordMatches := false
	if bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(req.Password)) == nil {
		passwordMatches = true
	} else if storedPassword == req.Password {
		// Legacy plaintext password support & auto-upgrade to bcrypt hash
		passwordMatches = true
		if newHashed, hashErr := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost); hashErr == nil {
			_, _ = db.Exec(context.Background(), `UPDATE users SET password = $1 WHERE id = $2`, string(newHashed), id)
		}
	}

	if !passwordMatches {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Invalid username or password"})
		return
	}

	// Update last_login
	db.Exec(context.Background(),
		`UPDATE users SET last_login = NOW() WHERE id = $1`, id)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(LoginResponse{
		Token:   "dummy-jwt-token-12345",
		Message: "Login successful",
		User:    map[string]interface{}{"id": id, "username": req.Username},
	})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logout successful"})
}

func forgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username    string `json:"username"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if req.Username == "" || req.NewPassword == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Username and new password are required"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Hash password error: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Internal server error"})
		return
	}

	tag, err := db.Exec(context.Background(),
		`UPDATE users SET password = $1 WHERE username = $2`,
		string(hashedPassword), req.Username,
	)
	if err != nil || tag.RowsAffected() == 0 {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(LoginResponse{Message: "Username not found"})
		return
	}

	json.NewEncoder(w).Encode(LoginResponse{Message: "Password has been successfully updated"})
}

// ─── GYM MOVES ──────────────────────────────────────────────────────────────

type GymMove struct {
	ID          int       `json:"id"`
	Username    string    `json:"username,omitempty"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Type        string    `json:"type"`
	Category    string    `json:"category"`
	CreatedDate time.Time `json:"createdDate"`
}

func gymMovesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		usernameQuery := r.URL.Query().Get("username")
		if usernameQuery == "" {
			json.NewEncoder(w).Encode([]GymMove{})
			return
		}

		rows, err := db.Query(context.Background(),
			`SELECT id, COALESCE(username, ''), title, COALESCE(description,''), type, category, created_at 
			 FROM gym_moves 
			 WHERE username = $1 
			 ORDER BY id DESC`,
			usernameQuery,
		)

		if err != nil {
			log.Printf("gymMovesHandler GET error: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		moves := []GymMove{}
		for rows.Next() {
			var m GymMove
			if err := rows.Scan(&m.ID, &m.Username, &m.Title, &m.Description, &m.Type, &m.Category, &m.CreatedDate); err != nil {
				continue
			}
			moves = append(moves, m)
		}
		json.NewEncoder(w).Encode(moves)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Username    string `json:"username"`
			Title       string `json:"title"`
			Description string `json:"description"`
			Type        string `json:"type"`
			Category    string `json:"category"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Username == "" || req.Title == "" || req.Type == "" || req.Category == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"message": "Username, title, type, and category are required"})
			return
		}

		var m GymMove
		err := db.QueryRow(context.Background(),
			`INSERT INTO gym_moves (username, title, description, type, category)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, COALESCE(username, ''), title, COALESCE(description,''), type, category, created_at`,
			req.Username, req.Title, req.Description, req.Type, req.Category,
		).Scan(&m.ID, &m.Username, &m.Title, &m.Description, &m.Type, &m.Category, &m.CreatedDate)

		if err != nil {
			log.Printf("gymMovesHandler POST error: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(m)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// ─── WORKOUT LOGS ────────────────────────────────────────────────────────────

type WorkoutLog struct {
	ID          int       `json:"id"`
	Username    string    `json:"username"`
	MoveID      *int      `json:"moveId"`
	MoveTitle   string    `json:"moveTitle"`
	Weight      float64   `json:"weight"`
	Reps        []int     `json:"reps"`
	Date        string    `json:"date"`
	CreatedDate time.Time `json:"createdDate"`
}

func workoutLogsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		usernameQuery := r.URL.Query().Get("username")

		var rows interface {
			Next() bool
			Scan(...interface{}) error
			Close()
		}
		var err error

		if usernameQuery != "" {
			rows, err = db.Query(context.Background(),
				`SELECT id, username, move_id, move_title, weight, reps, date::text, created_at
				 FROM workout_logs WHERE username = $1 ORDER BY date DESC, id DESC`,
				usernameQuery)
		} else {
			rows, err = db.Query(context.Background(),
				`SELECT id, username, move_id, move_title, weight, reps, date::text, created_at
				 FROM workout_logs ORDER BY date DESC, id DESC`)
		}

		if err != nil {
			log.Printf("workoutLogsHandler GET error: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		logs := []WorkoutLog{}
		for rows.Next() {
			var l WorkoutLog
			if err := rows.Scan(&l.ID, &l.Username, &l.MoveID, &l.MoveTitle, &l.Weight, &l.Reps, &l.Date, &l.CreatedDate); err != nil {
				log.Printf("workoutLogsHandler scan error: %v", err)
				continue
			}
			if l.Reps == nil {
				l.Reps = []int{}
			}
			logs = append(logs, l)
		}
		json.NewEncoder(w).Encode(logs)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Username  string          `json:"username"`
			MoveID    *int            `json:"moveId"`
			MoveTitle string          `json:"moveTitle"`
			Weight    float64         `json:"weight"`
			Reps      json.RawMessage `json:"reps"`
			Date      string          `json:"date"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Parse reps: can be []int or single int
		var parsedReps []int
		var multiReps []int
		var singleRep int
		if err := json.Unmarshal(req.Reps, &multiReps); err == nil {
			for _, r := range multiReps {
				if r > 0 {
					parsedReps = append(parsedReps, r)
				}
			}
		} else if err := json.Unmarshal(req.Reps, &singleRep); err == nil {
			if singleRep > 0 {
				parsedReps = append(parsedReps, singleRep)
			}
		}

		if req.MoveTitle == "" || len(parsedReps) == 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"message": "Exercise and at least 1 valid repetition are required"})
			return
		}

		logDate := req.Date
		if logDate == "" {
			logDate = time.Now().Format("2006-01-02")
		}

		var l WorkoutLog
		err := db.QueryRow(context.Background(),
			`INSERT INTO workout_logs (username, move_id, move_title, weight, reps, date)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 RETURNING id, username, move_id, move_title, weight, reps, date::text, created_at`,
			req.Username, req.MoveID, req.MoveTitle, req.Weight, parsedReps, logDate,
		).Scan(&l.ID, &l.Username, &l.MoveID, &l.MoveTitle, &l.Weight, &l.Reps, &l.Date, &l.CreatedDate)

		if err != nil {
			log.Printf("workoutLogsHandler POST error: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if l.Reps == nil {
			l.Reps = []int{}
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(l)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// isPgUniqueViolation checks for PostgreSQL unique constraint violation (code 23505)
func isPgUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	return len(err.Error()) > 5 && (contains(err.Error(), "23505") || contains(err.Error(), "unique constraint") || contains(err.Error(), "duplicate key"))
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsStr(s, sub))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

func main() {
	initDB()
	defer db.Close()

	initCORS()

	http.HandleFunc("/api/login", enableCORS(loginHandler))
	http.HandleFunc("/api/register", enableCORS(registerHandler))
	http.HandleFunc("/api/logout", enableCORS(logoutHandler))
	http.HandleFunc("/api/forgot-password", enableCORS(forgotPasswordHandler))
	http.HandleFunc("/api/gym-moves", enableCORS(gymMovesHandler))
	http.HandleFunc("/api/workout-logs", enableCORS(workoutLogsHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := port
	if !strings.HasPrefix(addr, ":") {
		addr = ":" + addr
	}

	log.Printf("GymBro backend listening on %s (PORT=%s)...\n", addr, port)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
