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

// runComposeUp brings up a docker compose project from a compose file using the
// docker CLI directly (command-based, no shell wrapper so it works cross-platform).
func runComposeUp(projectName, composeFile, envFile string) (string, error) {
        args := []string{"compose", "-p", projectName, "-f", composeFile}
        if envFile != "" {
                args = append(args, "--env-file", envFile)
        }
        args = append(args, "up", "-d", "--build")

        log.Printf("Deploying project %s: docker %s", projectName, strings.Join(args, " "))
        return execCommandWithTimeout(180*time.Second, "docker", args...)
}

// writeEnvFile writes a map of KEY=value port assignments to an .env file.
func writeEnvFile(path string, ports map[string]int) error {
        var b strings.Builder
        for key, value := range ports {
                b.WriteString(fmt.Sprintf("%s=%d\n", key, value))
        }
        return os.WriteFile(path, []byte(b.String()), 0644)
}

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

        // Write the YAML to a temp directory.
        tmpDir := filepath.Join(os.TempDir(), "docker-manager-deploy", req.Name)
        if err := os.MkdirAll(tmpDir, 0755); err != nil {
                respondError(w, http.StatusInternalServerError, "Failed to create temp directory: "+err.Error())
                return
        }

        composeFile := filepath.Join(tmpDir, "docker-compose.yaml")
        if err := os.WriteFile(composeFile, []byte(req.YAML), 0644); err != nil {
                respondError(w, http.StatusInternalServerError, "Failed to write compose file: "+err.Error())
                return
        }

        // Extract ${VAR} port placeholders and allocate a host port for each.
        portVars := extractPortVars(req.YAML)
        allocatedPorts := make(map[string]int)
        for _, varName := range portVars {
                port := allocatePort(req.Name, varName)
                if port == 0 {
                        respondError(w, http.StatusInternalServerError, "Failed to allocate port for variable: "+varName)
                        return
                }
                allocatedPorts[varName] = port
        }

        envFile := ""
        if len(allocatedPorts) > 0 {
                envFile = filepath.Join(tmpDir, ".env")
                if err := writeEnvFile(envFile, allocatedPorts); err != nil {
                        log.Printf("Warning: failed to write .env file: %v", err)
                }
        }

        output, err := runComposeUp(req.Name, composeFile, envFile)
        if err != nil {
                addLog(req.Name, "error", fmt.Sprintf("Deployment of %s failed", req.Name))
                respondError(w, http.StatusInternalServerError, "Deployment failed: "+err.Error()+"\nOutput: "+output)
                return
        }

        addLog(req.Name, "info", fmt.Sprintf("Deployed %s from custom compose", req.Name))
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
