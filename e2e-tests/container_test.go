package e2e

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// projectGroup mirrors the backend's ProjectGroup JSON shape (see
// ../mini-services/models.go) so we can assert on the /api/containers response.
type projectGroup struct {
	Name       string `json:"name"`
	Containers []struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Image   string `json:"image"`
		State   string `json:"state"`
		Project string `json:"project"`
		Ports   string `json:"ports"`
	} `json:"containers"`
}

// testImage is the image used for deploy tests. Kept tiny and overridable so
// CI can point at a pre-pulled image.
func testImage() string { return env("E2E_TEST_IMAGE", "alpine:3.20") }

// requireDocker skips the test unless a working Docker engine is reachable.
func requireDocker(t *testing.T) {
	t.Helper()
	if os.Getenv("E2E_SKIP_DOCKER") == "1" {
		t.Skip("E2E_SKIP_DOCKER=1 — skipping Docker-dependent test")
	}
	cmd := exec.Command("docker", "version")
	if err := cmd.Run(); err != nil {
		t.Skipf("Docker engine not available (%v) — skipping container creation test", err)
	}
}

// uniqueProject returns a docker-compose-safe project name unique per run.
func uniqueProject(prefix string) string {
	return fmt.Sprintf("%s%d", prefix, time.Now().UnixNano())
}

// fetchProjects logs in (uses provided token) and returns the grouped container
// list from GET /api/containers.
func fetchProjects(t *testing.T, token string) []projectGroup {
	t.Helper()
	resp := doRequest(t, http.MethodGet, "/api/containers", token, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/containers expected 200, got %d: %s", resp.StatusCode, resp.Body)
	}
	var groups []projectGroup
	resp.json(t, &groups)
	return groups
}

// findProject returns the group for the given project name, or nil.
func findProject(groups []projectGroup, name string) *projectGroup {
	for i := range groups {
		if strings.EqualFold(groups[i].Name, name) {
			return &groups[i]
		}
	}
	return nil
}

// teardownProject removes every container belonging to a project via the API
// (DELETE /api/containers/{id}?force=true) and, as a safety net, runs
// `docker compose -p <name> down -v` directly.
func teardownProject(t *testing.T, token, project string) {
	t.Helper()
	for _, g := range fetchProjects(t, token) {
		if !strings.EqualFold(g.Name, project) {
			continue
		}
		for _, c := range g.Containers {
			resp := doRequest(t, http.MethodDelete, "/api/containers/"+c.ID+"?force=true", token, nil)
			if resp.StatusCode != http.StatusOK {
				t.Logf("cleanup: failed to remove container %s (%d): %s", c.ID, resp.StatusCode, resp.Body)
			}
		}
	}
	// Best-effort: also tear down the compose project (networks/volumes).
	_ = exec.Command("docker", "compose", "-p", project, "down", "-v").Run()
}

// ---- input validation (no Docker required) ------------------------------

// TestComposeDeploy_RequiresAuth: the deploy endpoint is protected.
func TestComposeDeploy_RequiresAuth(t *testing.T) {
	requireServer(t)

	resp := doRequest(t, http.MethodPost, "/api/compose/deploy", "", map[string]string{
		"name": "x", "yaml": "services:\n  a:\n    image: alpine",
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without auth, got %d: %s", resp.StatusCode, resp.Body)
	}
}

// TestComposeDeploy_Validation: missing name or yaml => 400.
func TestComposeDeploy_Validation(t *testing.T) {
	requireServer(t)
	token := adminToken(t)

	cases := []struct {
		name string
		body map[string]string
	}{
		{"missing name", map[string]string{"name": "", "yaml": "services:\n  a:\n    image: alpine"}},
		{"missing yaml", map[string]string{"name": "proj", "yaml": ""}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := doRequest(t, http.MethodPost, "/api/compose/deploy", token, tc.body)
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", resp.StatusCode, resp.Body)
			}
		})
	}
}

// ---- real container creation (Docker required) --------------------------

// TestCreateContainer_ComposeDeploy is the full "create a container" journey:
// log in → deploy a compose project with an auto-allocated port → confirm the
// container shows up in the list → clean up.
func TestCreateContainer_ComposeDeploy(t *testing.T) {
	requireServer(t)
	requireDocker(t)

	token := adminToken(t)
	project := uniqueProject("e2ec")

	// A minimal long-lived service with a ${VAR} so the backend's port
	// allocator is exercised end-to-end.
	yaml := fmt.Sprintf(`services:
  app:
    image: %s
    command: ["sleep", "600"]
    ports:
      - "${APP_PORT}:8080"
`, testImage())

	// Make sure we always clean up, even on assertion failure.
	t.Cleanup(func() { teardownProject(t, token, project) })

	resp := doRequest(t, http.MethodPost, "/api/compose/deploy", token, map[string]string{
		"name": project,
		"yaml": yaml,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("compose deploy expected 200, got %d: %s", resp.StatusCode, resp.Body)
	}

	// The response must echo the project and the allocated ports.
	var deploy struct {
		Project string         `json:"project"`
		Ports   map[string]int `json:"ports"`
	}
	resp.json(t, &deploy)
	if deploy.Project != project {
		t.Errorf("expected project %q in response, got %q", project, deploy.Project)
	}
	port, ok := deploy.Ports["APP_PORT"]
	if !ok {
		t.Errorf("expected APP_PORT to be allocated, ports=%v", deploy.Ports)
	} else if port < 8000 {
		t.Errorf("expected allocated port >= 8000, got %d", port)
	}

	// The container must now appear in the grouped listing.
	groups := fetchProjects(t, token)
	pg := findProject(groups, project)
	if pg == nil {
		t.Fatalf("project %q not found in container list after deploy", project)
	}
	if len(pg.Containers) == 0 {
		t.Fatalf("project %q has no containers after deploy", project)
	}

	// Sanity: the running container uses the image we asked for.
	found := false
	for _, c := range pg.Containers {
		if strings.Contains(c.Image, strings.SplitN(testImage(), ":", 2)[0]) {
			found = true
		}
	}
	if !found {
		t.Errorf("none of the project's containers use image %q: %+v", testImage(), pg.Containers)
	}
}

// TestCreateContainer_FromTemplate deploys whichever template the backend
// reports first via GET /api/templates. Skipped if no templates are installed.
func TestCreateContainer_FromTemplate(t *testing.T) {
	requireServer(t)
	requireDocker(t)

	token := adminToken(t)

	// Discover available templates.
	listResp := doRequest(t, http.MethodGet, "/api/templates", token, nil)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/templates expected 200, got %d: %s", listResp.StatusCode, listResp.Body)
	}
	var templates []struct {
		Name       string `json:"name"`
		HasCompose bool   `json:"has_compose"`
	}
	listResp.json(t, &templates)

	var templateName string
	for _, tpl := range templates {
		if tpl.HasCompose {
			templateName = tpl.Name
			break
		}
	}
	if templateName == "" {
		t.Skip("no deployable template (with docker-compose) found — skipping")
	}

	project := uniqueProject("e2et")
	t.Cleanup(func() { teardownProject(t, token, project) })

	resp := doRequest(t, http.MethodPost, "/api/templates/"+templateName+"/deploy", token, map[string]string{
		"name": project,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("template deploy expected 200, got %d: %s", resp.StatusCode, resp.Body)
	}

	var deploy struct {
		Project  string `json:"project"`
		Template string `json:"template"`
	}
	resp.json(t, &deploy)
	if deploy.Project != project {
		t.Errorf("expected project %q, got %q", project, deploy.Project)
	}
	if deploy.Template != templateName {
		t.Errorf("expected template %q, got %q", templateName, deploy.Template)
	}

	// Confirm the deployed project is visible.
	if pg := findProject(fetchProjects(t, token), project); pg == nil || len(pg.Containers) == 0 {
		t.Fatalf("template-deployed project %q not found / empty after deploy", project)
	}
}

// TestDeployTemplate_NotFound: deploying a non-existent template => 404.
func TestDeployTemplate_NotFound(t *testing.T) {
	requireServer(t)
	token := adminToken(t)

	resp := doRequest(t, http.MethodPost, "/api/templates/no-such-template-xyz/deploy", token, map[string]string{
		"name": uniqueProject("e2emiss"),
	})
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown template, got %d: %s", resp.StatusCode, resp.Body)
	}
}
