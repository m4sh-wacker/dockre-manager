package main

import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "os"
        "path/filepath"
        "regexp"
        "strings"
        "time"

        "github.com/gorilla/mux"
)

// Template directory from env with default
func getTemplateDir() string {
        return getEnv("TEMPLATE_DIR", "/home/z/my-project/templates/")
}

// extractPortVars parses a docker-compose YAML content and extracts ${VAR_NAME} patterns
func extractPortVars(content string) []string {
        re := regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)\}`)
        matches := re.FindAllStringSubmatch(content, -1)

        seen := make(map[string]bool)
        var vars []string
        for _, match := range matches {
                if len(match) >= 2 && !seen[match[1]] {
                        seen[match[1]] = true
                        vars = append(vars, match[1])
                }
        }
        return vars
}

// GET /api/templates - List all templates
func handleListTemplates(w http.ResponseWriter, r *http.Request) {
        templateDir := getTemplateDir()
        var templates []TemplateInfo

        entries, err := os.ReadDir(templateDir)
        if err != nil {
                log.Printf("Error reading template directory %s: %v", templateDir, err)
                respondJSON(w, http.StatusOK, []TemplateInfo{})
                return
        }

        for _, entry := range entries {
                if !entry.IsDir() {
                        continue
                }

                name := entry.Name()
                // Skip hidden directories
                if strings.HasPrefix(name, ".") {
                        continue
                }

                templatePath := filepath.Join(templateDir, name)
                info := TemplateInfo{
                        Name:     name,
                        PortVars: []string{},
                }

                // Check for docker-compose.yaml or docker-compose.yml
                composePath := ""
                if _, err := os.Stat(filepath.Join(templatePath, "docker-compose.yaml")); err == nil {
                        composePath = filepath.Join(templatePath, "docker-compose.yaml")
                        info.HasCompose = true
                } else if _, err := os.Stat(filepath.Join(templatePath, "docker-compose.yml")); err == nil {
                        composePath = filepath.Join(templatePath, "docker-compose.yml")
                        info.HasCompose = true
                }

                // Read install.json if it exists
                installJSONPath := filepath.Join(templatePath, "install.json")
                if data, err := os.ReadFile(installJSONPath); err == nil {
                        info.HasInstallJSON = true
                        var installData InstallJSON
                        if err := json.Unmarshal(data, &installData); err == nil {
                                info.InstallJSON = &installData
                                info.Description = installData.StartCommand // Will be overridden by name field if present
                        }

                        // Try to read name/description from install.json
                        var raw map[string]interface{}
                        if err := json.Unmarshal(data, &raw); err == nil {
                                if desc, ok := raw["description"].(string); ok {
                                        info.Description = desc
                                } else if displayName, ok := raw["name"].(string); ok {
                                        info.Description = displayName
                                }
                        }
                }

                // Extract port variables from docker-compose.yaml
                if composePath != "" {
                        if content, err := os.ReadFile(composePath); err == nil {
                                info.PortVars = extractPortVars(string(content))
                        }
                }

                templates = append(templates, info)
        }

        if templates == nil {
                templates = []TemplateInfo{}
        }

        respondJSON(w, http.StatusOK, templates)
}

// GET /api/templates/{name} - Get full template info
func handleGetTemplate(w http.ResponseWriter, r *http.Request) {
        vars := mux.Vars(r)
        name := vars["name"]

        templateDir := getTemplateDir()
        templatePath := filepath.Join(templateDir, name)

        // Check if template directory exists
        if info, err := os.Stat(templatePath); err != nil || !info.IsDir() {
                respondError(w, http.StatusNotFound, "Template not found: "+name)
                return
        }

        templateInfo := TemplateInfo{
                Name:     name,
                PortVars: []string{},
        }

        // Check for docker-compose.yaml
        composePath := ""
        if _, err := os.Stat(filepath.Join(templatePath, "docker-compose.yaml")); err == nil {
                composePath = filepath.Join(templatePath, "docker-compose.yaml")
                templateInfo.HasCompose = true
        } else if _, err := os.Stat(filepath.Join(templatePath, "docker-compose.yml")); err == nil {
                composePath = filepath.Join(templatePath, "docker-compose.yml")
                templateInfo.HasCompose = true
        }

        // Read compose content
        if composePath != "" {
                if content, err := os.ReadFile(composePath); err == nil {
                        templateInfo.ComposeContent = string(content)
                        templateInfo.PortVars = extractPortVars(string(content))
                }
        }

        // Read install.json
        installJSONPath := filepath.Join(templatePath, "install.json")
        if data, err := os.ReadFile(installJSONPath); err == nil {
                templateInfo.HasInstallJSON = true
                var installData InstallJSON
                if err := json.Unmarshal(data, &installData); err == nil {
                        templateInfo.InstallJSON = &installData
                }

                var raw map[string]interface{}
                if err := json.Unmarshal(data, &raw); err == nil {
                        if desc, ok := raw["description"].(string); ok {
                                templateInfo.Description = desc
                        } else if displayName, ok := raw["name"].(string); ok {
                                templateInfo.Description = displayName
                        }
                }
        }

        respondJSON(w, http.StatusOK, templateInfo)
}

// POST /api/templates/{name}/deploy - Deploy a template
func handleDeployTemplate(w http.ResponseWriter, r *http.Request) {
        vars := mux.Vars(r)
        templateName := vars["name"]

        var req DeployRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                respondError(w, http.StatusBadRequest, "Invalid request body")
                return
        }

        if req.Name == "" {
                respondError(w, http.StatusBadRequest, "Project name is required")
                return
        }

        templateDir := getTemplateDir()
        templatePath := filepath.Join(templateDir, templateName)

        // Check if template directory exists
        if info, err := os.Stat(templatePath); err != nil || !info.IsDir() {
                respondError(w, http.StatusNotFound, "Template not found: "+templateName)
                return
        }

        // Read install.json
        installJSONPath := filepath.Join(templatePath, "install.json")
        installData, err := readInstallJSON(installJSONPath)
        if err != nil {
                respondError(w, http.StatusInternalServerError, "Failed to read install.json: "+err.Error())
                return
        }

        // Find compose file and extract port variables
        composePath := findComposeFile(templatePath)
        var portVars []string
        if composePath != "" {
                if content, err := os.ReadFile(composePath); err == nil {
                        portVars = extractPortVars(string(content))
                }
        }

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

        // Create .env file in the template directory with port assignments
        if len(allocatedPorts) > 0 {
                envPath := filepath.Join(templatePath, ".env")
                var envContent strings.Builder
                for varName, port := range allocatedPorts {
                        envContent.WriteString(fmt.Sprintf("%s=%d\n", varName, port))
                }
                if err := os.WriteFile(envPath, []byte(envContent.String()), 0644); err != nil {
                        log.Printf("Warning: failed to write .env file: %v", err)
                }
        }

        // Replace placeholders in start_command
        startCmd := installData.StartCommand
        startCmd = strings.ReplaceAll(startCmd, "{name}", req.Name)
        startCmd = strings.ReplaceAll(startCmd, "{template_dir}", templatePath)

        // Execute start_command
        log.Printf("Deploying template %s as project %s: %s", templateName, req.Name, startCmd)
        output, err := execCommandWithTimeout(120*time.Second, "bash", "-c", startCmd)
        if err != nil {
                respondError(w, http.StatusInternalServerError, "Deployment failed: "+err.Error()+"\nOutput: "+output)
                return
        }

        // Execute final_command if it exists
        if installData.FinalCommand != nil && *installData.FinalCommand != "" {
                finalCmd := *installData.FinalCommand
                finalCmd = strings.ReplaceAll(finalCmd, "{name}", req.Name)
                finalCmd = strings.ReplaceAll(finalCmd, "{template_dir}", templatePath)

                log.Printf("Running final command for project %s: %s", req.Name, finalCmd)
                finalOutput, err := execCommandWithTimeout(120*time.Second, "bash", "-c", finalCmd)
                if err != nil {
                        log.Printf("Warning: final command failed: %v, output: %s", err, finalOutput)
                        // Don't fail the deployment, just log the warning
                }
        }

        // Save deployment to database
        portsJSON, _ := json.Marshal(allocatedPorts)
        _, _ = db.Exec(
                "INSERT INTO deployments (name, template, status, ports_json) VALUES (?, ?, 'running', ?)",
                req.Name, templateName, string(portsJSON),
        )

        respondJSON(w, http.StatusOK, map[string]interface{}{
                "message":  fmt.Sprintf("Template %s deployed as project %s", templateName, req.Name),
                "project":  req.Name,
                "template": templateName,
                "ports":    allocatedPorts,
                "output":   output,
        })
}

// readInstallJSON reads and parses an install.json file
func readInstallJSON(path string) (*InstallJSON, error) {
        data, err := os.ReadFile(path)
        if err != nil {
                return nil, fmt.Errorf("failed to read install.json: %w", err)
        }

        var installData InstallJSON
        if err := json.Unmarshal(data, &installData); err != nil {
                return nil, fmt.Errorf("failed to parse install.json: %w", err)
        }

        return &installData, nil
}

// findComposeFile finds the docker-compose file in a template directory
func findComposeFile(templatePath string) string {
        candidates := []string{"docker-compose.yaml", "docker-compose.yml"}
        for _, name := range candidates {
                path := filepath.Join(templatePath, name)
                if _, err := os.Stat(path); err == nil {
                        return path
                }
        }
        return ""
}

// Register template routes
func registerTemplateRoutes(r *mux.Router) {
        templates := r.PathPrefix("/api/templates").Subrouter()
        templates.Use(authMiddleware)
        templates.HandleFunc("", handleListTemplates).Methods("GET")
        templates.HandleFunc("/{name}", handleGetTemplate).Methods("GET")
        templates.HandleFunc("/{name}/deploy", handleDeployTemplate).Methods("POST")
}
