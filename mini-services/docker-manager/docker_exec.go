package main

import (
	"fmt"
	"log"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

// execCommand runs a system command and returns its output
func execCommand(cmd string, args ...string) (string, error) {
	start := time.Now()
	c := exec.Command(cmd, args...)
	output, err := c.CombinedOutput()
	elapsed := time.Since(start)

	if err != nil {
		log.Printf("Command '%s %v' failed in %v: %v, output: %s", cmd, args, elapsed, err, string(output))
		return string(output), fmt.Errorf("command failed: %w", err)
	}

	log.Printf("Command '%s %v' completed in %v", cmd, args, elapsed)
	return string(output), nil
}

// execCommandWithTimeout runs a system command with a timeout
func execCommandWithTimeout(timeout time.Duration, cmd string, args ...string) (string, error) {
	start := time.Now()
	c := exec.Command(cmd, args...)

	type result struct {
		output string
		err    error
	}

	done := make(chan result, 1)
	go func() {
		output, err := c.CombinedOutput()
		done <- result{string(output), err}
	}()

	select {
	case res := <-done:
		elapsed := time.Since(start)
		if res.err != nil {
			log.Printf("Command '%s %v' failed in %v: %v", cmd, args, elapsed, res.err)
			return res.output, fmt.Errorf("command failed: %w", res.err)
		}
		log.Printf("Command '%s %v' completed in %v", cmd, args, elapsed)
		return res.output, nil
	case <-time.After(timeout):
		if c.Process != nil {
			c.Process.Kill()
		}
		return "", fmt.Errorf("command timed out after %v", timeout)
	}
}

// execDockerPS runs docker ps -a and parses the output into ContainerInfo structs
func execDockerPS() ([]ContainerInfo, error) {
	format := "{{.ID}}|||{{.Names}}|||{{.Image}}|||{{.Status}}|||{{.Ports}}|||{{.Label \"com.docker.compose.project\"}}|||{{.Label \"com.docker.compose.service\"}}|||{{.State}}"
	output, err := execCommandWithTimeout(30*time.Second, "docker", "ps", "-a", "--format", format)
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	var containers []ContainerInfo
	lines := strings.Split(strings.TrimSpace(output), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		fields := strings.Split(line, "|||")
		if len(fields) < 8 {
			for len(fields) < 8 {
				fields = append(fields, "")
			}
		}

		container := ContainerInfo{
			ID:      strings.TrimSpace(fields[0]),
			Name:    strings.TrimSpace(fields[1]),
			Image:   strings.TrimSpace(fields[2]),
			Status:  strings.TrimSpace(fields[3]),
			Ports:   strings.TrimSpace(fields[4]),
			Project: strings.TrimSpace(fields[5]),
			Service: strings.TrimSpace(fields[6]),
			State:   strings.ToLower(strings.TrimSpace(fields[7])),
		}

		containers = append(containers, container)
	}

	return containers, nil
}

// execDockerStart starts a container
func execDockerStart(containerID string) error {
	_, err := execCommandWithTimeout(30*time.Second, "docker", "start", containerID)
	if err != nil {
		return fmt.Errorf("failed to start container %s: %w", containerID, err)
	}
	return nil
}

// execDockerStop stops a container
func execDockerStop(containerID string) error {
	_, err := execCommandWithTimeout(30*time.Second, "docker", "stop", "-t", "10", containerID)
	if err != nil {
		return fmt.Errorf("failed to stop container %s: %w", containerID, err)
	}
	return nil
}

// execDockerRestart restarts a container
func execDockerRestart(containerID string) error {
	_, err := execCommandWithTimeout(30*time.Second, "docker", "restart", "-t", "10", containerID)
	if err != nil {
		return fmt.Errorf("failed to restart container %s: %w", containerID, err)
	}
	return nil
}

// execDockerPause pauses a container
func execDockerPause(containerID string) error {
	_, err := execCommandWithTimeout(30*time.Second, "docker", "pause", containerID)
	if err != nil {
		return fmt.Errorf("failed to pause container %s: %w", containerID, err)
	}
	return nil
}

// execDockerUnpause unpauses a container
func execDockerUnpause(containerID string) error {
	_, err := execCommandWithTimeout(30*time.Second, "docker", "unpause", containerID)
	if err != nil {
		return fmt.Errorf("failed to unpause container %s: %w", containerID, err)
	}
	return nil
}

// execDockerRemove removes a container
func execDockerRemove(containerID string, force bool) error {
	args := []string{"rm"}
	if force {
		args = append(args, "-f")
	}
	args = append(args, containerID)
	_, err := execCommandWithTimeout(30*time.Second, "docker", args...)
	if err != nil {
		return fmt.Errorf("failed to remove container %s: %w", containerID, err)
	}
	return nil
}

// execDockerLogs gets container logs
func execDockerLogs(containerID string, tail int) ([]string, error) {
	tailStr := strconv.Itoa(tail)
	output, err := execCommandWithTimeout(30*time.Second, "docker", "logs", "--tail", tailStr, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs for container %s: %w", containerID, err)
	}

	lines := strings.Split(output, "\n")
	var result []string
	for _, line := range lines {
		cleaned := strings.TrimSpace(line)
		if cleaned != "" {
			result = append(result, cleaned)
		}
	}

	return result, nil
}

// execDockerExec executes a command inside a running container
func execDockerExec(containerID, command string) (string, error) {
	output, err := execCommandWithTimeout(30*time.Second, "docker", "exec", containerID, "/bin/sh", "-c", command)
	if err != nil {
		return output, fmt.Errorf("failed to exec in container %s: %w", containerID, err)
	}
	return output, nil
}

// execDockerInspect gets detailed container information
func execDockerInspect(containerID string) (string, error) {
	output, err := execCommandWithTimeout(10*time.Second, "docker", "inspect", containerID)
	if err != nil {
		return "", fmt.Errorf("failed to inspect container %s: %w", containerID, err)
	}
	return output, nil
}

// execDockerImages lists all docker images
func execDockerImages() ([]ImageInfo, error) {
	format := "{{.ID}}|||{{.Repository}}|||{{.Tag}}|||{{.Size}}|||{{.CreatedAt}}"
	output, err := execCommandWithTimeout(30*time.Second, "docker", "images", "--format", format)
	if err != nil {
		return nil, fmt.Errorf("failed to list images: %w", err)
	}

	var images []ImageInfo
	lines := strings.Split(strings.TrimSpace(output), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		fields := strings.Split(line, "|||")
		if len(fields) < 5 {
			continue
		}

		image := ImageInfo{
			ID:         strings.TrimSpace(fields[0]),
			Repository: strings.TrimSpace(fields[1]),
			Tag:        strings.TrimSpace(fields[2]),
			Size:       strings.TrimSpace(fields[3]),
			Created:    strings.TrimSpace(fields[4]),
		}

		images = append(images, image)
	}

	return images, nil
}

// getSystemResources retrieves real system resource information using gopsutil
func getSystemResources() (SystemResources, error) {
	var resources SystemResources

	// 1. CPU
	if cpuPercent, err := cpu.Percent(500*time.Millisecond, false); err == nil && len(cpuPercent) > 0 {
		resources.CPUPercent = cpuPercent[0]
	}

	// 2. Memory
	if vm, err := mem.VirtualMemory(); err == nil {
		// Convert bytes to MB for easier frontend handling
		resources.MemoryTotal = vm.Total / (1024 * 1024)
		resources.MemoryUsed = vm.Used / (1024 * 1024)
		resources.MemoryPercent = vm.UsedPercent
	}

	// 3. Disk
	root := "/"
	if runtime.GOOS == "windows" {
		root = "C:\\"
	}
	if du, err := disk.Usage(root); err == nil {
		// Convert bytes to GB for easier frontend handling
		resources.DiskTotal = du.Total / (1024 * 1024 * 1024)
		resources.DiskUsed = du.Used / (1024 * 1024 * 1024)
		resources.DiskPercent = du.UsedPercent
	}

	// 4. Docker Counts
	if runCmd, err := exec.Command("docker", "ps", "-q").Output(); err == nil {
		lines := strings.Split(strings.TrimSpace(string(runCmd)), "\n")
		count := 0
		for _, l := range lines {
			if strings.TrimSpace(l) != "" {
				count++
			}
		}
		resources.DockerRunning = count
	}

	if totCmd, err := exec.Command("docker", "ps", "-a", "-q").Output(); err == nil {
		lines := strings.Split(strings.TrimSpace(string(totCmd)), "\n")
		count := 0
		for _, l := range lines {
			if strings.TrimSpace(l) != "" {
				count++
			}
		}
		resources.DockerTotal = count
	}

	return resources, nil
}

// execDockerComposeServices lists all Docker Compose projects (services) with their images
func execDockerComposeServices() ([]ServiceInfo, error) {
	// Get unique project names
	projectCmd := `docker ps -a --format '{{.Label "com.docker.compose.project"}}' | sort | uniq`
	output, err := execCommandWithTimeout(30*time.Second, "sh", "-c", projectCmd)
	if err != nil {
		return nil, fmt.Errorf("failed to list compose projects: %w", err)
	}

	var services []ServiceInfo
	projects := strings.Split(strings.TrimSpace(output), "\n")

	for _, project := range projects {
		project = strings.TrimSpace(project)
		if project == "" {
			continue
		}

		// Get images for this project
		imageCmd := fmt.Sprintf(`docker ps -a --filter "label=com.docker.compose.project=%s" --format '{{.Image}}' | sort -u`, project)
		imageOutput, err := execCommandWithTimeout(30*time.Second, "sh", "-c", imageCmd)
		if err != nil {
			log.Printf("Warning: failed to get images for project %s: %v", project, err)
			continue
		}

		var images []string
		imageLines := strings.Split(strings.TrimSpace(imageOutput), "\n")
		for _, img := range imageLines {
			img = strings.TrimSpace(img)
			if img != "" {
				images = append(images, img)
			}
		}

		services = append(services, ServiceInfo{
			Name:   project,
			Images: images,
		})
	}

	return services, nil
}

// Docker Compose Stack Operations

// execDockerComposeUp starts a Docker Compose stack
func execDockerComposeUp(projectName string) error {
	_, err := execCommandWithTimeout(60*time.Second, "docker", "compose", "-p", projectName, "up", "-d")
	if err != nil {
		return fmt.Errorf("failed to start stack %s: %w", projectName, err)
	}
	return nil
}

// execDockerComposeDown stops and removes a Docker Compose stack
func execDockerComposeDown(projectName string) error {
	_, err := execCommandWithTimeout(60*time.Second, "docker", "compose", "-p", projectName, "down")
	if err != nil {
		return fmt.Errorf("failed to stop stack %s: %w", projectName, err)
	}
	return nil
}

// execDockerComposeRestart restarts a Docker Compose stack
func execDockerComposeRestart(projectName string) error {
	_, err := execCommandWithTimeout(60*time.Second, "docker", "compose", "-p", projectName, "restart")
	if err != nil {
		return fmt.Errorf("failed to restart stack %s: %w", projectName, err)
	}
	return nil
}

// execDockerComposeStop stops a Docker Compose stack without removing
func execDockerComposeStop(projectName string) error {
	_, err := execCommandWithTimeout(60*time.Second, "docker", "compose", "-p", projectName, "stop")
	if err != nil {
		return fmt.Errorf("failed to stop stack %s: %w", projectName, err)
	}
	return nil
}

// execDockerComposeStart starts a stopped Docker Compose stack
func execDockerComposeStart(projectName string) error {
	_, err := execCommandWithTimeout(60*time.Second, "docker", "compose", "-p", projectName, "start")
	if err != nil {
		return fmt.Errorf("failed to start stack %s: %w", projectName, err)
	}
	return nil
}

// execDockerComposeLogs gets logs from a Docker Compose stack
func execDockerComposeLogs(projectName string, tail int) ([]string, error) {
	tailStr := strconv.Itoa(tail)
	output, err := execCommandWithTimeout(30*time.Second, "docker", "compose", "-p", projectName, "logs", "--tail", tailStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs for stack %s: %w", projectName, err)
	}

	lines := strings.Split(output, "\n")
	var result []string
	for _, line := range lines {
		cleaned := strings.TrimSpace(line)
		if cleaned != "" {
			result = append(result, cleaned)
		}
	}

	return result, nil
}
