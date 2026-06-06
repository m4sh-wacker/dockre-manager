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

        "github.com/gorilla/mux"
)

// Template directory from env with default (relative to the backend binary,
// pointing at the project-root /templates folder).
func getTemplateDir() string {
        return getEnv("TEMPLATE_DIR", "../../templates")
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

        // A template is deployed straight from its docker-compose file.
        composePath := findComposeFile(templatePath)
        if composePath == "" {
                respondError(w, http.StatusBadRequest, "Template has no docker-compose file: "+templateName)
                return
        }

        // Extract ${VAR} port placeholders and allocate a host port for each.
        var portVars []string
        if content, err := os.ReadFile(composePath); err == nil {
                portVars = extractPortVars(string(content))
        }
        allocatedPorts := make(map[string]int)
        for _, varName := range portVars {
                port := allocatePort(req.Name, varName)
                if port == 0 {
                        respondError(w, http.StatusInternalServerError, "Failed to allocate port for variable: "+varName)
                        return
                }
                allocatedPorts[varName] = port
        }

        // Write the allocated ports into the template's .env so `build: .`
        // contexts and ${VAR} substitutions resolve correctly.
        envFile := ""
        if len(allocatedPorts) > 0 {
                envFile = filepath.Join(templatePath, ".env")
                if err := writeEnvFile(envFile, allocatedPorts); err != nil {
                        log.Printf("Warning: failed to write .env file: %v", err)
                }
        }

        output, err := runComposeUp(req.Name, composePath, envFile)
        if err != nil {
                addLog(req.Name, "error", fmt.Sprintf("Deployment of %s from template %s failed", req.Name, templateName))
                respondError(w, http.StatusInternalServerError, "Deployment failed: "+err.Error()+"\nOutput: "+output)
                return
        }

        addLog(req.Name, "info", fmt.Sprintf("Deployed %s from template %s", req.Name, templateName))
        respondJSON(w, http.StatusOK, map[string]interface{}{
                "message":  fmt.Sprintf("Template %s deployed as project %s", templateName, req.Name),
                "project":  req.Name,
                "template": templateName,
                "ports":    allocatedPorts,
                "output":   output,
        })
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
