// Package e2e contains end-to-end (black-box) tests for the Docker Manager
// Go backend (the service under ../mini-services).
//
// These tests talk to a *running* backend over HTTP, exactly like the real
// Next.js frontend does. Nothing is mocked: real router, real MySQL database,
// real JWT auth and — for the container tests — the real Docker engine.
//
// Run the backend first, then:
//
//	cd e2e-tests
//	go test -v ./...
//
// Configuration (all optional, sensible defaults shown):
//
//	E2E_BASE_URL   backend base URL          default http://localhost:3030
//	E2E_USERNAME   admin username to log in  default admin
//	E2E_PASSWORD   admin password            default admin123
//	E2E_SKIP_DOCKER  set to "1" to skip the Docker-dependent container tests
package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

// ---- configuration -------------------------------------------------------

func baseURL() string  { return env("E2E_BASE_URL", "http://localhost:3030") }
func adminUser() string { return env("E2E_USERNAME", "admin") }
func adminPass() string { return env("E2E_PASSWORD", "admin123") }

func env(key, def string) string {
	if v := os.Getenv(key); strings.TrimSpace(v) != "" {
		return v
	}
	return def
}

// httpClient is shared across tests with a generous timeout because some
// operations (compose up --build) can be slow.
var httpClient = &http.Client{Timeout: 200 * time.Second}

// ---- low-level request helper -------------------------------------------

// apiResponse is a tiny wrapper that decodes the JSON body once and keeps the
// raw bytes around for assertions / debugging.
type apiResponse struct {
	StatusCode int
	Body       []byte
}

// json decodes the response body into v. Fails the test on decode error.
func (r apiResponse) json(t *testing.T, v interface{}) {
	t.Helper()
	if err := json.Unmarshal(r.Body, v); err != nil {
		t.Fatalf("failed to decode JSON response: %v\nbody: %s", err, string(r.Body))
	}
}

// field returns a single top-level string field from a JSON object body.
func (r apiResponse) field(t *testing.T, key string) string {
	t.Helper()
	var m map[string]interface{}
	r.json(t, &m)
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// doRequest performs an HTTP request against the backend.
//   - method:  GET / POST / DELETE ...
//   - path:    e.g. "/api/auth/login"
//   - token:   bearer token (empty string = no Authorization header)
//   - body:    request payload, marshalled to JSON (nil = no body)
func doRequest(t *testing.T, method, path, token string, body interface{}) apiResponse {
	t.Helper()

	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
		reader = bytes.NewReader(raw)
	}

	req, err := http.NewRequest(method, baseURL()+path, reader)
	if err != nil {
		t.Fatalf("failed to build request %s %s: %v", method, path, err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		t.Fatalf("request %s %s failed (is the backend running at %s?): %v",
			method, path, baseURL(), err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	return apiResponse{StatusCode: resp.StatusCode, Body: data}
}

// ---- higher-level helpers -----------------------------------------------

// login authenticates and returns the JWT token. Fails the test if login does
// not succeed.
func login(t *testing.T, username, password string) string {
	t.Helper()
	resp := doRequest(t, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": username,
		"password": password,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login as %q expected 200, got %d: %s", username, resp.StatusCode, resp.Body)
	}
	token := resp.field(t, "token")
	if token == "" {
		t.Fatalf("login response had no token: %s", resp.Body)
	}
	return token
}

// adminToken logs in as the configured admin user.
func adminToken(t *testing.T) string {
	t.Helper()
	return login(t, adminUser(), adminPass())
}

// serverUp is set by TestMain; tests skip themselves if the backend is down so
// the suite degrades gracefully instead of producing a wall of failures.
var serverUp bool

func requireServer(t *testing.T) {
	t.Helper()
	if !serverUp {
		t.Skipf("backend not reachable at %s — start ../mini-services first", baseURL())
	}
}

// TestMain probes the health endpoint once before any test runs.
func TestMain(m *testing.M) {
	serverUp = waitForHealth(15 * time.Second)
	if !serverUp {
		fmt.Printf("\n[e2e] WARNING: backend not reachable at %s — all tests will be skipped.\n"+
			"      Start the backend:  cd ../mini-services && go run .\n\n", baseURL())
	}
	os.Exit(m.Run())
}

// waitForHealth polls GET /api/health until it returns 200 or the deadline.
func waitForHealth(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		req, err := http.NewRequest(http.MethodGet, baseURL()+"/api/health", nil)
		if err != nil {
			return false
		}
		resp, err := httpClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return true
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	return false
}
