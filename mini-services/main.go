package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

const (
	defaultPort = 3030
)

// convertPrismaDSNToGoDSN converts Prisma MySQL URL format to Go driver format
// From: mysql://user:password@host:port/database
// To: user:password@tcp(host:port)/database?parseTime=true&charset=utf8mb4
func convertPrismaDSNToGoDSN(prismaDSN string) string {
	// If already in Go format, return as-is
	if !strings.HasPrefix(prismaDSN, "mysql://") {
		return prismaDSN
	}

	// Remove mysql:// prefix
	dsn := strings.TrimPrefix(prismaDSN, "mysql://")
	
	// Parse user:password@host:port/database
	parts := strings.SplitN(dsn, "@", 2)
	if len(parts) != 2 {
		return prismaDSN // Return original if parsing fails
	}
	
	userPass := parts[0]
	hostDB := parts[1]
	
	// Split host:port/database
	dbParts := strings.SplitN(hostDB, "/", 2)
	if len(dbParts) != 2 {
		return prismaDSN
	}
	
	hostPort := dbParts[0]
	database := dbParts[1]
	
	// Build Go driver DSN
	return fmt.Sprintf("%s@tcp(%s)/%s?parseTime=true&charset=utf8mb4", userPass, hostPort, database)
}

func main() {
	log.Println("Starting Docker Manager...")

	// Initialize database with DSN from environment
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "root:@tcp(127.0.0.1:3306)/docker_manager?parseTime=true&charset=utf8mb4"
		log.Println("DATABASE_URL not set, using default MySQL connection")
	} else {
		// Convert Prisma format to Go driver format if needed
		dsn = convertPrismaDSNToGoDSN(dsn)
		log.Println("Using DATABASE_URL from environment")
	}
	
	if err := initDatabase(dsn); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer closeDatabase()

	// Setup router
	router := mux.NewRouter()

	// Apply global middleware. CORS is applied at the top level (wrapping the
	// whole router below) instead of via router.Use, so it also covers preflight
	// OPTIONS requests that don't match a specific route.
	router.Use(recoveryMiddleware)
	router.Use(loggingMiddleware)

	// Health check endpoint
	router.HandleFunc("/api/health", handleHealthCheck).Methods("GET")

	// Register route groups
	registerAuthRoutes(router)
	registerTemplateRoutes(router)
	registerContainerRoutes(router)
	registerDeployRoutes(router)
	registerSystemRoutes(router)
	registerLogRoutes(router)

	// Get port from env
	port := getEnvInt("PORT", defaultPort)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      corsMiddleware(router),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Docker Manager server starting on port %d", port)
		log.Printf("API available at http://localhost:%d/api/", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit
	log.Println("Shutting down server...")

	// Give outstanding requests 15 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}

// Health check handler
func handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"version":   "2.0.0",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Helper functions

func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

func respondError(w http.ResponseWriter, statusCode int, message string) {
	respondJSON(w, statusCode, APIError{Error: message})
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s-%d-%s", prefix, time.Now().UnixNano(), hex.EncodeToString(b)[:6])
}

func nowString() string {
	return time.Now().UTC().Format(time.RFC3339)
}
