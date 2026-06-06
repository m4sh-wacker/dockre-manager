package main

import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "os"
        "path/filepath"
        "strings"
        "time"

        "github.com/gorilla/mux"
)

// POST /api/compose/deploy - Deploy raw YAML as a docker compose project
func handleComposeDeploy(w http.ResponseWriter, r *http.Request) {
        var req ComposeDeployRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                respondError(w, http.StatusBadRequest, "Invalid request body")
                return
        }

        if req.Name == "" {
                respondError(w, http.StatusBadRequest, "Project name is required")
                return
        }

        if req.YAML == "" {
                respondError(w, http.StatusBadRequest, "YAML content is required")
                return
        }

        // Create a temp directory for the compose file
        tmpDir := filepath.Join(os.TempDir(), "docker-manager-deploy")
        if err := os.MkdirAll(tmpDir, 0755); err != nil {
                respondError(w, http.StatusInternalServerError, "Failed to create temp directory: "+err.Error())
                return
        }

        // Write YAML to a temp file
        composeFile := filepath.Join(tmpDir, fmt.Sprintf("%s-compose.yaml", req.Name))
        if err := os.WriteFile(composeFile, []byte(req.YAML), 0644); err != nil {
                respondError(w, http.StatusInternalServerError, "Failed to write compose file: "+err.Error())
                return
        }
        defer os.Remove(composeFile)

        // Extract port variables from YAML
        portVars := extractPortVars(req.YAML)

        // Allocate ports for each variable
        allocatedPorts := make(map[string]int)
        for _, varName := range portVars {
                port := allocatePort(req.Name, varName)
                if port == 0 {
                        respondError(w, http.StatusInternalServerError, "Failed to allocate port for variable: "+varName)
                        return
                }
                allocatedPorts[varName] = port
        }

        // Create .env file with port assignments
        if len(allocatedPorts) > 0 {
                envPath := filepath.Join(tmpDir, fmt.Sprintf("%s.env", req.Name))
                var envContent strings.Builder
                for varName, port := range allocatedPorts {
                        envContent.WriteString(fmt.Sprintf("%s=%d\n", varName, port))
                }
                if err := os.WriteFile(envPath, []byte(envContent.String()), 0644); err != nil {
                        log.Printf("Warning: failed to write .env file: %v", err)
                }
                defer os.Remove(envPath)
        }

        // Build docker compose command
        // Use --env-file to specify the .env file location
        cmd := fmt.Sprintf("docker compose -p %s -f %s up -d", req.Name, composeFile)
        if len(allocatedPorts) > 0 {
                envFile := filepath.Join(tmpDir, fmt.Sprintf("%s.env", req.Name))
                cmd = fmt.Sprintf("docker compose -p %s -f %s --env-file %s up -d", req.Name, composeFile, envFile)
        }

        log.Printf("Deploying compose project %s: %s", req.Name, cmd)
        output, err := execCommandWithTimeout(120*time.Second, "bash", "-c", cmd)
        if err != nil {
                respondError(w, http.StatusInternalServerError, "Deployment failed: "+err.Error()+"\nOutput: "+output)
                return
        }

        // Save deployment to database
        portsJSON, _ := json.Marshal(allocatedPorts)
        _, _ = db.Exec(
                "INSERT INTO deployments (name, template, status, ports_json) VALUES (?, ?, 'running', ?)",
                req.Name, "custom-compose", string(portsJSON),
        )

        respondJSON(w, http.StatusOK, map[string]interface{}{
                "message": fmt.Sprintf("Compose project %s deployed successfully", req.Name),
                "project": req.Name,
                "ports":   allocatedPorts,
                "output":  output,
        })
}

// Register deploy routes
func registerDeployRoutes(r *mux.Router) {
        deploy := r.PathPrefix("/api/compose").Subrouter()
        deploy.Use(authMiddleware)
        deploy.HandleFunc("/deploy", handleComposeDeploy).Methods("POST")
}
