package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// GET /api/containers - List all containers grouped by project
func handleListContainers(w http.ResponseWriter, r *http.Request) {
	containers, err := execDockerPS()
	if err != nil {
		log.Printf("Warning: could not list containers: %v", err)
		respondJSON(w, http.StatusOK, []ProjectGroup{})
		return
	}

	// Group containers by project
	projectMap := make(map[string][]ContainerInfo)
	var standalone []ContainerInfo

	for _, c := range containers {
		if c.Project != "" {
			projectMap[c.Project] = append(projectMap[c.Project], c)
		} else {
			standalone = append(standalone, c)
		}
	}

	var groups []ProjectGroup
	for name, containers := range projectMap {
		groups = append(groups, ProjectGroup{
			Name:       name,
			Containers: containers,
		})
	}

	// Add standalone containers as a group
	if len(standalone) > 0 {
		groups = append(groups, ProjectGroup{
			Name:       "standalone",
			Containers: standalone,
		})
	}

	if groups == nil {
		groups = []ProjectGroup{}
	}

	respondJSON(w, http.StatusOK, groups)
}

// GET /api/containers/{id} - Get specific container or project containers
func handleGetContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	containers, err := execDockerPS()
	if err != nil {
		log.Printf("Warning: could not list containers: %v", err)
		respondJSON(w, http.StatusOK, []ContainerInfo{})
		return
	}

	// Try to find by exact ID or name match first
	for _, c := range containers {
		if c.ID == containerID || c.Name == containerID {
			respondJSON(w, http.StatusOK, c)
			return
		}
	}

	// Try to find by project name
	var projectContainers []ContainerInfo
	for _, c := range containers {
		if strings.EqualFold(c.Project, containerID) {
			projectContainers = append(projectContainers, c)
		}
	}

	if len(projectContainers) > 0 {
		respondJSON(w, http.StatusOK, projectContainers)
		return
	}

	respondError(w, http.StatusNotFound, "Container not found")
}

// POST /api/containers/{id}/start - Start a container
func handleStartContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	if err := execDockerStart(containerID); err != nil {
		addLog("", "error", fmt.Sprintf("Failed to start container %s: %s", containerID, err.Error()))
		respondError(w, http.StatusInternalServerError, "Failed to start container: "+err.Error())
		return
	}

	addLog("", "info", fmt.Sprintf("Container %s started", containerID))
	respondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Container %s started successfully", containerID),
	})
}

// POST /api/containers/{id}/stop - Stop a container
func handleStopContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	if err := execDockerStop(containerID); err != nil {
		addLog("", "error", fmt.Sprintf("Failed to stop container %s: %s", containerID, err.Error()))
		respondError(w, http.StatusInternalServerError, "Failed to stop container: "+err.Error())
		return
	}

	addLog("", "info", fmt.Sprintf("Container %s stopped", containerID))
	respondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Container %s stopped successfully", containerID),
	})
}

// POST /api/containers/{id}/restart - Restart a container
func handleRestartContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	if err := execDockerRestart(containerID); err != nil {
		addLog("", "error", fmt.Sprintf("Failed to restart container %s: %s", containerID, err.Error()))
		respondError(w, http.StatusInternalServerError, "Failed to restart container: "+err.Error())
		return
	}

	addLog("", "info", fmt.Sprintf("Container %s restarted", containerID))
	respondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Container %s restarted successfully", containerID),
	})
}

// POST /api/containers/{id}/pause - Pause a container
func handlePauseContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	if err := execDockerPause(containerID); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to pause container: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Container %s paused successfully", containerID),
	})
}

// POST /api/containers/{id}/unpause - Unpause a container
func handleUnpauseContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	if err := execDockerUnpause(containerID); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to unpause container: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Container %s unpaused successfully", containerID),
	})
}

// DELETE /api/containers/{id} - Remove a container
func handleRemoveContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	// Check if force flag is set
	force := r.URL.Query().Get("force") == "true"

	if err := execDockerRemove(containerID, force); err != nil {
		addLog("", "error", fmt.Sprintf("Failed to remove container %s: %s", containerID, err.Error()))
		respondError(w, http.StatusInternalServerError, "Failed to remove container: "+err.Error())
		return
	}

	addLog("", "warn", fmt.Sprintf("Container %s removed", containerID))
	respondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Container %s removed successfully", containerID),
	})
}

// GET /api/containers/{id}/logs - Get container logs
func handleContainerLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	tail := 100
	if tailStr := r.URL.Query().Get("tail"); tailStr != "" {
		if val, err := strconv.Atoi(tailStr); err == nil && val > 0 {
			tail = val
		}
	}

	logs, err := execDockerLogs(containerID, tail)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get container logs: "+err.Error())
		return
	}

	if logs == nil {
		logs = []string{}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"container_id": containerID,
		"logs":         logs,
	})
}

// POST /api/containers/{id}/exec - Execute command in container
func handleContainerExec(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	var req ExecRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Command == "" {
		respondError(w, http.StatusBadRequest, "Command is required")
		return
	}

	output, err := execDockerExec(containerID, req.Command)
	if err != nil {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"container_id": containerID,
			"output":       output,
			"error":        err.Error(),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"container_id": containerID,
		"output":       output,
	})
}

// GET /api/containers/{id}/inspect - Inspect container
func handleContainerInspect(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	if containerID == "" {
		respondError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	output, err := execDockerInspect(containerID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to inspect container: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(output))
}

// Register container routes
func registerContainerRoutes(r *mux.Router) {
	containers := r.PathPrefix("/api/containers").Subrouter()
	containers.Use(authMiddleware)
	containers.HandleFunc("", handleListContainers).Methods("GET")
	containers.HandleFunc("/{id}", handleGetContainer).Methods("GET")
	containers.HandleFunc("/{id}/start", handleStartContainer).Methods("POST")
	containers.HandleFunc("/{id}/stop", handleStopContainer).Methods("POST")
	containers.HandleFunc("/{id}/restart", handleRestartContainer).Methods("POST")
	containers.HandleFunc("/{id}/pause", handlePauseContainer).Methods("POST")
	containers.HandleFunc("/{id}/unpause", handleUnpauseContainer).Methods("POST")
	containers.HandleFunc("/{id}", handleRemoveContainer).Methods("DELETE")
	containers.HandleFunc("/{id}/logs", handleContainerLogs).Methods("GET")
	containers.HandleFunc("/{id}/exec", handleContainerExec).Methods("POST")
	containers.HandleFunc("/{id}/inspect", handleContainerInspect).Methods("GET")
}
