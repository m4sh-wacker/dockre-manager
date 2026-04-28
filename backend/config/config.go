package config

import (
	"context"
	"os"

	"github.com/docker/docker/client"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	AllowedOrigins string
}

var DockerClient *client.Client

func Load() *Config {
	return &Config{
		DatabaseURL:    getEnv("DATABASE_URL", "file:./docker-manager.db"),
		JWTSecret:      getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
	}
}

func InitDockerClient() error {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}

	_, err = cli.Ping(context.Background())
	if err != nil {
		return err
	}

	DockerClient = cli
	return nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
