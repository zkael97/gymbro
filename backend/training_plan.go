package main

import "time"

// DayOfWeek represents days of the workout plan
type DayOfWeek string

const (
	DayMonday    DayOfWeek = "monday"
	DayTuesday   DayOfWeek = "tuesday"
	DayWednesday DayOfWeek = "wednesday"
	DayThursday  DayOfWeek = "thursday"
	DayFriday    DayOfWeek = "friday"
	DaySaturday  DayOfWeek = "saturday"
	DaySunday    DayOfWeek = "sunday"
)

// ExerciseSet represents the set target specification
type ExerciseSet struct {
	SetNumber      int      `json:"setNumber"`
	TargetReps     int      `json:"targetReps"`
	TargetWeightKg *float64 `json:"targetWeightKg,omitempty"`
	RestSeconds    *int     `json:"restSeconds,omitempty"`
}

// TrainingExercise represents an exercise planned for a workout day
type TrainingExercise struct {
	ID         string        `json:"id,omitempty"`
	GymMoveID  *string       `json:"gymMoveId,omitempty"`
	Name       string        `json:"name"`
	Category   string        `json:"category,omitempty"`
	Notes      string        `json:"notes,omitempty"`
	Sets       []ExerciseSet `json:"sets"`
}

// WorkoutDay represents a scheduled day routine
type WorkoutDay struct {
	DayOfWeek DayOfWeek          `json:"dayOfWeek"`
	Title     string             `json:"title"`
	IsRestDay bool               `json:"isRestDay"`
	Notes     string             `json:"notes,omitempty"`
	Exercises []TrainingExercise `json:"exercises"`
}

// TrainingPlan represents the top-level workout routine
type TrainingPlan struct {
	ID          string       `json:"id,omitempty"`
	Username    string       `json:"username"`
	Title       string       `json:"title"`
	Description string       `json:"description,omitempty"`
	IsActive    bool         `json:"isActive"`
	Days        []WorkoutDay `json:"days"`
	CreatedAt   *time.Time   `json:"createdAt,omitempty"`
	UpdatedAt   *time.Time   `json:"updatedAt,omitempty"`
}
