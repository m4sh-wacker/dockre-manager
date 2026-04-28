package database

import (
	"log"

	"docker-manager-backend/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect(databaseURL string) {
	var err error
	DB, err = gorm.Open(sqlite.Open(databaseURL), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("✅ Database connected")
}

func Migrate() {
	err := DB.AutoMigrate(
		&models.User{},
		&models.Container{},
		&models.LogEntry{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Println("✅ Database migrated")
}
