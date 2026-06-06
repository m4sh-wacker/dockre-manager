package main

import (
        "net/http"

        "github.com/gorilla/mux"
)

// GET /api/system/resources - Get system resource information
func handleSystemResources(w http.ResponseWriter, r *http.Request) {
        resources, err := getSystemResources()
        if err != nil {
                respondError(w, http.StatusInternalServerError, "Failed to get system resources: "+err.Error())
                return
        }

        // Count distinct compose projects from the running containers
        resources.ProjectTotal = countComposeProjects()
        resources.Timestamp = nowString()

        respondJSON(w, http.StatusOK, resources)
}

// Register system routes
func registerSystemRoutes(r *mux.Router) {
        system := r.PathPrefix("/api/system").Subrouter()
        system.Use(authMiddleware)
        system.HandleFunc("/resources", handleSystemResources).Methods("GET")
}
