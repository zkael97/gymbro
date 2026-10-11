package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type User struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	Password    string    `json:"password"`
	CreatedDate time.Time `json:"createdDate"`
	LastLogin   time.Time `json:"lastLogin"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token   string `json:"token,omitempty"`
	Message string `json:"message"`
	User    *User  `json:"user,omitempty"`
}

var usersDB = make(map[string]User)
var nextID = 1

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:4200")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
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

	if _, exists := usersDB[req.Username]; exists {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(LoginResponse{
			Message: "Username already exists",
		})
		return
	}

	newUser := User{
		ID:          fmt.Sprintf("%d", nextID),
		Username:    req.Username,
		Password:    req.Password,
		CreatedDate: time.Now(),
	}
	nextID++

	usersDB[req.Username] = newUser

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(LoginResponse{
		Message: "Registration successful",
		User:    &newUser,
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

	user, exists := usersDB[req.Username]
	if exists && user.Password == req.Password {
		user.LastLogin = time.Now()
		usersDB[req.Username] = user

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(LoginResponse{
			Token:   "dummy-jwt-token-12345",
			Message: "Login successful",
			User:    &user,
		})
		return
	}

	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(LoginResponse{
		Message: "Invalid username or password",
	})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logout successful",
	})
}

type ForgotPasswordRequest struct {
	Username    string `json:"username"`
	NewPassword string `json:"newPassword"`
}

type GymMove struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Type        string    `json:"type"`     // "upper" or "lower"
	Category    string    `json:"category"` // upper: Chest, back, shoulders, arms, others; lower: quadriceps, hamstring, glutes, calves, others
	CreatedDate time.Time `json:"createdDate"`
}

var (
	gymMovesMutex sync.Mutex
	gymMovesFile  = "gym_moves.json"
	gymMovesDB    []GymMove
	nextGymMoveID = 1
)

var defaultGymMoves = []GymMove{
	{
		ID:          "1",
		Title:       "Barbell Bench Press",
		Description: "Compound chest movement targeting pectoralis major, anterior deltoids, and triceps.",
		Type:        "upper",
		Category:    "Chest",
		CreatedDate: time.Now(),
	},
	{
		ID:          "2",
		Title:       "Deadlift",
		Description: "Full-body powerhouse movement engaging posterior chain, glutes, and lower back.",
		Type:        "lower",
		Category:    "hamstring",
		CreatedDate: time.Now(),
	},
	{
		ID:          "3",
		Title:       "Barbell Back Squat",
		Description: "Fundamental lower body exercise for quadriceps, hamstrings, and core stability.",
		Type:        "lower",
		Category:    "quadriceps",
		CreatedDate: time.Now(),
	},
}

func initGymMovesStorage() {
	gymMovesMutex.Lock()
	defer gymMovesMutex.Unlock()

	data, err := os.ReadFile(gymMovesFile)
	if err == nil && len(data) > 0 {
		var moves []GymMove
		if err := json.Unmarshal(data, &moves); err == nil && len(moves) > 0 {
			gymMovesDB = moves
			maxID := 0
			for _, m := range moves {
				var idInt int
				fmt.Sscanf(m.ID, "%d", &idInt)
				if idInt > maxID {
					maxID = idInt
				}
			}
			nextGymMoveID = maxID + 1
			return
		}
	}

	gymMovesDB = defaultGymMoves
	nextGymMoveID = 4
	saveGymMovesToFile()
}

func saveGymMovesToFile() {
	data, err := json.MarshalIndent(gymMovesDB, "", "  ")
	if err == nil {
		os.WriteFile(gymMovesFile, data, 0644)
	}
}

func forgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if req.Username == "" || req.NewPassword == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(LoginResponse{
			Message: "Username and new password are required",
		})
		return
	}

	user, exists := usersDB[req.Username]
	if !exists {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(LoginResponse{
			Message: "Username not found",
		})
		return
	}

	user.Password = req.NewPassword
	usersDB[req.Username] = user

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(LoginResponse{
		Message: "Password has been successfully updated",
	})
}

func gymMovesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		json.NewEncoder(w).Encode(gymMovesDB)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Type        string `json:"type"`
			Category    string `json:"category"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Title == "" || req.Type == "" || req.Category == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"message": "Title, type, and category are required",
			})
			return
		}

		newMove := GymMove{
			ID:          fmt.Sprintf("%d", nextGymMoveID),
			Title:       req.Title,
			Description: req.Description,
			Type:        req.Type,
			Category:    req.Category,
			CreatedDate: time.Now(),
		}
		nextGymMoveID++

		gymMovesMutex.Lock()
		gymMovesDB = append([]GymMove{newMove}, gymMovesDB...)
		saveGymMovesToFile()
		gymMovesMutex.Unlock()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newMove)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

type WorkoutLog struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	MoveID      string    `json:"moveId"`
	MoveTitle   string    `json:"moveTitle"`
	Weight      float64   `json:"weight"` // in kg
	Reps        int       `json:"reps"`
	Date        string    `json:"date"` // YYYY-MM-DD
	CreatedDate time.Time `json:"createdDate"`
}

var workoutLogsDB = []WorkoutLog{
	{
		ID:          "1",
		Username:    "admin",
		MoveID:      "1",
		MoveTitle:   "Barbell Bench Press",
		Weight:      70,
		Reps:        8,
		Date:        time.Now().Format("2006-01-02"),
		CreatedDate: time.Now().Add(-2 * time.Hour),
	},
	{
		ID:          "2",
		Username:    "admin",
		MoveID:      "3",
		MoveTitle:   "Barbell Back Squat",
		Weight:      90,
		Reps:        6,
		Date:        time.Now().AddDate(0, 0, -1).Format("2006-01-02"),
		CreatedDate: time.Now().AddDate(0, 0, -1),
	},
}
var nextWorkoutLogID = 3

func workoutLogsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		usernameQuery := r.URL.Query().Get("username")
		var result []WorkoutLog
		for _, log := range workoutLogsDB {
			if usernameQuery == "" || log.Username == usernameQuery {
				result = append(result, log)
			}
		}
		if result == nil {
			result = []WorkoutLog{}
		}
		json.NewEncoder(w).Encode(result)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Username  string  `json:"username"`
			MoveID    string  `json:"moveId"`
			MoveTitle string  `json:"moveTitle"`
			Weight    float64 `json:"weight"`
			Reps      int     `json:"reps"`
			Date      string  `json:"date"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.MoveTitle == "" || req.Reps <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"message": "Exercise and valid repetitions are required",
			})
			return
		}

		logDate := req.Date
		if logDate == "" {
			logDate = time.Now().Format("2006-01-02")
		}

		newLog := WorkoutLog{
			ID:          fmt.Sprintf("%d", nextWorkoutLogID),
			Username:    req.Username,
			MoveID:      req.MoveID,
			MoveTitle:   req.MoveTitle,
			Weight:      req.Weight,
			Reps:        req.Reps,
			Date:        logDate,
			CreatedDate: time.Now(),
		}
		nextWorkoutLogID++

		workoutLogsDB = append([]WorkoutLog{newLog}, workoutLogsDB...)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newLog)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func main() {
	initGymMovesStorage()

	http.HandleFunc("/api/login", enableCORS(loginHandler))
	http.HandleFunc("/api/register", enableCORS(registerHandler))
	http.HandleFunc("/api/logout", enableCORS(logoutHandler))
	http.HandleFunc("/api/forgot-password", enableCORS(forgotPasswordHandler))
	http.HandleFunc("/api/gym-moves", enableCORS(gymMovesHandler))
	http.HandleFunc("/api/workout-logs", enableCORS(workoutLogsHandler))

	port := ":8080"
	fmt.Printf("Starting backend server on port %s...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
