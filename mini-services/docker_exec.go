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

// countComposeProjects returns the number of distinct Docker Compose projects
// across all containers (used for the overview "projects" metric).
func countComposeProjects() int {
	containers, err := execDockerPS()
	if err != nil {
		return 0
	}

	seen := make(map[string]bool)
	for _, c := range containers {
		if c.Project != "" {
			seen[c.Project] = true
		}
	}
	return len(seen)
}
