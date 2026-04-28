package handlers

import (
	"docker-manager-backend/database"
	"docker-manager-backend/models"
	"docker-manager-backend/utils"

	"github.com/gofiber/fiber/v2"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func Login(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {

		var body LoginRequest
		if err := c.BodyParser(&body); err != nil {
			return fiber.ErrBadRequest
		}

		var user models.User
		if err := database.DB.Where("username = ?", body.Username).First(&user).Error; err != nil {
			return fiber.ErrUnauthorized
		}

		if !user.CheckPassword(body.Password) {
			return fiber.ErrUnauthorized
		}

		token, err := utils.GenerateToken(user.ID, secret)
		if err != nil {
			return fiber.ErrInternalServerError
		}

		return c.JSON(fiber.Map{
			"token": token,
		})
	}
}
