package main

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// GET /api/logs - List recent activity log entries
func handleListLogs(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 && val <= 1000 {
			limit = val
		}
	}

	logs, err := getLogs(limit)
	if err != nil {
		respondJSON(w, http.StatusOK, []LogEntry{})
		return
	}

	respondJSON(w, http.StatusOK, logs)
}

// Register log routes
func registerLogRoutes(r *mux.Router) {
	logs := r.PathPrefix("/api/logs").Subrouter()
	logs.Use(authMiddleware)
	logs.HandleFunc("", handleListLogs).Methods("GET")
}
