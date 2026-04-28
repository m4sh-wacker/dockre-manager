package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func Auth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {

		auth := c.Get("Authorization")
		if auth == "" {
			return fiber.ErrUnauthorized
		}

		tokenString := strings.Replace(auth, "Bearer ", "", 1)

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			return fiber.ErrUnauthorized
		}

		return c.Next()
	}
}
