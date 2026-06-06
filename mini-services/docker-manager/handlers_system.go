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

        respondJSON(w, http.StatusOK, resources)
}

// Register system routes
func registerSystemRoutes(r *mux.Router) {
        system := r.PathPrefix("/api/system").Subrouter()
        system.Use(authMiddleware)
        system.HandleFunc("/resources", handleSystemResources).Methods("GET")
}
