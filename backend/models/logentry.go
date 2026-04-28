package models

import "time"

type LogEntry struct {
	ID          uint      `gorm:"primaryKey"`
	ContainerID string    `json:"container_id"`
	Message     string    `json:"message"`
	CreatedAt   time.Time `json:"created_at"`
}
