package main

import "github.com/golang-jwt/jwt/v5"

type User struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"created_at"`
}

type ContainerInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	Status  string `json:"status"`
	Ports   string `json:"ports"`
	Project string `json:"project"`
	Service string `json:"service"`
	State   string `json:"state"`
}

type ProjectGroup struct {
	Name       string          `json:"name"`
	Containers []ContainerInfo `json:"containers"`
}

type TemplateInfo struct {
	Name           string       `json:"name"`
	Description    string       `json:"description"`
	HasCompose     bool         `json:"has_compose"`
	HasInstallJSON bool         `json:"has_install_json"`
	PortVars       []string     `json:"port_vars"`
	InstallJSON    *InstallJSON `json:"install_json,omitempty"`
	ComposeContent string       `json:"compose_content,omitempty"`
}

type InstallJSON struct {
	StartCommand string  `json:"start_command"`
	FinalCommand *string `json:"final_command"`
}

type DeployRequest struct {
	Name string `json:"name"`
}

type ComposeDeployRequest struct {
	Name string `json:"name"`
	YAML string `json:"yaml"`
}

type ExecRequest struct {
	Command string `json:"command"`
}

type SystemResources struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryTotal   uint64  `json:"memory_total"`
	MemoryUsed    uint64  `json:"memory_used"`
	MemoryPercent float64 `json:"memory_percent"`
	DiskTotal     uint64  `json:"disk_total"`
	DiskUsed      uint64  `json:"disk_used"`
	DiskPercent   float64 `json:"disk_percent"`
	DockerRunning int     `json:"docker_running"`
	DockerTotal   int     `json:"docker_total"`
	ProjectTotal  int     `json:"project_total"`
	Timestamp     string  `json:"timestamp"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type LoginResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

type APIError struct {
	Error string `json:"error"`
}

type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// LogProject is the nested project info returned with a log entry.
type LogProject struct {
	Name string `json:"name"`
}

// LogEntry is a single activity-log record shown in the dashboard.
type LogEntry struct {
	ID        string      `json:"id"`
	ProjectID string      `json:"projectId"`
	Level     string      `json:"level"`
	Message   string      `json:"message"`
	Timestamp string      `json:"timestamp"`
	Project   *LogProject `json:"project,omitempty"`
}
