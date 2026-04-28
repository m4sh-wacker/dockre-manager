package handlers

import (
	"context"
	"docker-manager-backend/config"
	"docker-manager-backend/database"
	"docker-manager-backend/models"

	"github.com/docker/docker/api/types/container"
	"github.com/gofiber/fiber/v2"
)

func ListContainers(c *fiber.Ctx) error {
	var containers []models.Container
	database.DB.Find(&containers)

	return c.JSON(containers)
}

func CreateContainer(c *fiber.Ctx) error {

	type Req struct {
		Name  string `json:"name"`
		Image string `json:"image"`
	}

	var body Req
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}

	ctx := context.Background()

	resp, err := config.DockerClient.ContainerCreate(
		ctx,
		&container.Config{
			Image: body.Image,
		},
		nil,
		nil,
		nil,
		body.Name,
	)

	if err != nil {
		return err
	}

	cont := models.Container{
		ID:       resp.ID,
		Name:     body.Name,
		Image:    body.Image,
		DockerID: resp.ID,
		Status:   models.StatusStopped,
	}

	database.DB.Create(&cont)

	return c.JSON(cont)
}

func StartContainer(c *fiber.Ctx) error {

	id := c.Params("id")

	err := config.DockerClient.ContainerStart(
		context.Background(),
		id,
		container.StartOptions{},
	)

	if err != nil {
		return err
	}

	database.DB.Model(&models.Container{}).
		Where("id = ?", id).
		Update("status", models.StatusRunning)

	return c.JSON(fiber.Map{"status": "started"})
}

func StopContainer(c *fiber.Ctx) error {

	id := c.Params("id")

	err := config.DockerClient.ContainerStop(
		context.Background(),
		id,
		container.StopOptions{},
	)

	if err != nil {
		return err
	}

	database.DB.Model(&models.Container{}).
		Where("id = ?", id).
		Update("status", models.StatusStopped)

	return c.JSON(fiber.Map{"status": "stopped"})
}

func DeleteContainer(c *fiber.Ctx) error {

	id := c.Params("id")

	err := config.DockerClient.ContainerRemove(
		context.Background(),
		id,
		container.RemoveOptions{Force: true},
	)

	if err != nil {
		return err
	}

	database.DB.Delete(&models.Container{}, "id = ?", id)

	return c.JSON(fiber.Map{"deleted": true})
}
