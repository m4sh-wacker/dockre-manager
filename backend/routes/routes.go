package routes

import (
	"docker-manager-backend/config"
	"docker-manager-backend/handlers"
	"docker-manager-backend/middleware"

	"github.com/gofiber/fiber/v2"
)

func Setup(app *fiber.App) {

	api := app.Group("/api")

	api.Post("/auth/login", handlers.Login(config.Load().JWTSecret))

	containers := api.Group(
		"/containers",
		middleware.Auth(config.Load().JWTSecret),
	)

	containers.Get("/", handlers.ListContainers)
	containers.Post("/", handlers.CreateContainer)
	containers.Post("/:id/start", handlers.StartContainer)
	containers.Post("/:id/stop", handlers.StopContainer)
	containers.Delete("/:id", handlers.DeleteContainer)
}
