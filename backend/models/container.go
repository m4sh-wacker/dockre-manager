// models/container.go
package models

import "time"

type ContainerStatus string

const (
	StatusRunning ContainerStatus = "running"
	StatusStopped ContainerStatus = "stopped"
	StatusExited  ContainerStatus = "exited"
)

type Container struct {
	ID        string          `gorm:"primaryKey" json:"id"`
	Name      string          `json:"name"`
	Image     string          `json:"image"`
	DockerID  string          `json:"docker_id"`
	Status    ContainerStatus `json:"status"`
	ExpiresAt *time.Time      `json:"expires_at"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}
