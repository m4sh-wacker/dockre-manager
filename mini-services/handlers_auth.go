package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
)

// POST /api/auth/login - User login
func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Username and password are required")
		return
	}

	// Get user from database
	user, err := getUserByUsername(req.Username)
	if err != nil {
		log.Printf("Login failed for user %s: %v", req.Username, err)
		respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		log.Printf("Invalid password for user %s", req.Username)
		respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Generate JWT token
	token, err := generateToken(user.ID, user.Username)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	respondJSON(w, http.StatusOK, LoginResponse{
		Token:    token,
		Username: user.Username,
	})
}

// POST /api/auth/register - User registration (optional, for initial setup)
func handleRegister(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Username and password are required")
		return
	}

	// Check if user already exists
	if _, err := getUserByUsername(req.Username); err == nil {
		respondError(w, http.StatusConflict, "Username already exists")
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash password: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Create user
	user := User{
		ID:           generateID("user"),
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		CreatedAt:    nowString(),
	}

	if err := createUser(&user); err != nil {
		log.Printf("Failed to create user: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Generate token
	token, err := generateToken(user.ID, user.Username)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	respondJSON(w, http.StatusCreated, LoginResponse{
		Token:    token,
		Username: user.Username,
	})
}

// POST /api/auth/change-password - Change user password
func handleChangePassword(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	userID := getUserIDFromContext(r)
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		respondError(w, http.StatusBadRequest, "Current and new passwords are required")
		return
	}

	// Get user from database
	user, err := getUserByID(userID)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		respondError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash password: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	// Update password
	if err := updateUserPassword(userID, string(hashedPassword)); err != nil {
		log.Printf("Failed to update password: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Password updated successfully",
	})
}

// Register auth routes
func registerAuthRoutes(r *mux.Router) {
	auth := r.PathPrefix("/api/auth").Subrouter()
	auth.HandleFunc("/login", handleLogin).Methods("POST")
	auth.HandleFunc("/register", handleRegister).Methods("POST")
	
	// Protected routes
	authProtected := auth.PathPrefix("").Subrouter()
	authProtected.Use(authMiddleware)
	authProtected.HandleFunc("/change-password", handleChangePassword).Methods("POST")
}
