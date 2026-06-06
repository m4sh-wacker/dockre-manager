package main

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func initDatabase(dsn string) error {
	var err error
	
	// Parse DSN to get connection parameters
	// Format: user:password@tcp(host:port)/dbname
	if dsn == "" {
		dsn = "root:@tcp(127.0.0.1:3306)/docker_manager?parseTime=true&charset=utf8mb4"
	}

	// Open MySQL connection
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Create database if it doesn't exist
	dbName := "docker_manager"
	_, err = db.Exec(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", dbName))
	if err != nil {
		log.Printf("Warning: could not create database: %v", err)
	}

	// Use the database
	_, err = db.Exec(fmt.Sprintf("USE %s", dbName))
	if err != nil {
		return fmt.Errorf("failed to use database: %w", err)
	}

	if err := runMigrations(); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	if err := createDefaultUser(); err != nil {
		return fmt.Errorf("failed to create default user: %w", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

func runMigrations() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(255) PRIMARY KEY,
			username VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_username (username)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS port_allocations (
			id INTEGER PRIMARY KEY AUTO_INCREMENT,
			project_name VARCHAR(255) NOT NULL,
			port_var VARCHAR(255) NOT NULL,
			port_number INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_project (project_name),
			INDEX idx_port (port_number)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS deployments (
			id INTEGER PRIMARY KEY AUTO_INCREMENT,
			name VARCHAR(255) NOT NULL,
			template VARCHAR(255) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'running',
			ports_json TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_name (name),
			INDEX idx_status (status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			log.Printf("Migration error: %v", err)
		}
	}
	return nil
}

func createDefaultUser() error {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	_, err = db.Exec(
		"INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
		"admin-001", "admin", string(hash),
	)
	if err != nil {
		return err
	}

	log.Println("Default admin user created (username: admin, password: admin123)")
	return nil
}

func closeDatabase() {
	if db != nil {
		db.Close()
	}
}

func getLastAllocatedPort() int {
	var maxPort sql.NullInt64
	err := db.QueryRow("SELECT MAX(port_number) FROM port_allocations").Scan(&maxPort)
	if err != nil || !maxPort.Valid {
		return 7999
	}
	return int(maxPort.Int64)
}

func allocatePort(projectName, portVar string) int {
	lastPort := getLastAllocatedPort()
	newPort := lastPort + 1

	_, err := db.Exec(
		"INSERT INTO port_allocations (project_name, port_var, port_number) VALUES (?, ?, ?)",
		projectName, portVar, newPort,
	)
	if err != nil {
		log.Printf("Error allocating port: %v", err)
		newPort = lastPort + 2
		_, err = db.Exec(
			"INSERT INTO port_allocations (project_name, port_var, port_number) VALUES (?, ?, ?)",
			projectName, portVar, newPort,
		)
		if err != nil {
			log.Printf("Error allocating port (retry): %v", err)
			return 0
		}
	}

	return newPort
}

func getProjectPorts(projectName string) map[string]int {
	ports := make(map[string]int)
	rows, err := db.Query(
		"SELECT port_var, port_number FROM port_allocations WHERE project_name = ?",
		projectName,
	)
	if err != nil {
		return ports
	}
	defer rows.Close()

	for rows.Next() {
		var portVar string
		var portNumber int
		if err := rows.Scan(&portVar, &portNumber); err == nil {
			ports[portVar] = portNumber
		}
	}
	return ports
}

func isPortAllocated(portNumber int) bool {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM port_allocations WHERE port_number = ?", portNumber).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

func getNextAvailablePort() int {
	lastPort := getLastAllocatedPort()
	candidate := lastPort + 1
	for isPortAllocated(candidate) && candidate < 65535 {
		candidate++
	}
	return candidate
}

func formatPortNumber(port int) string {
	return strconv.Itoa(port)
}

// User management functions

func getUserByUsername(username string) (*User, error) {
	var user User
	err := db.QueryRow(
		"SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
		username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt)
	
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func getUserByID(userID string) (*User, error) {
	var user User
	err := db.QueryRow(
		"SELECT id, username, password_hash, created_at FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt)
	
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func createUser(user *User) error {
	_, err := db.Exec(
		"INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
		user.ID, user.Username, user.PasswordHash, user.CreatedAt,
	)
	return err
}

func updateUserPassword(userID, passwordHash string) error {
	_, err := db.Exec(
		"UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		passwordHash, userID,
	)
	return err
}
