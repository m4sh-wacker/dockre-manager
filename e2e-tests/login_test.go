package e2e

import (
	"net/http"
	"testing"
)

// TestLogin_Success: valid credentials return 200, a JWT token and the username.
func TestLogin_Success(t *testing.T) {
	requireServer(t)

	resp := doRequest(t, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": adminUser(),
		"password": adminPass(),
	})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, resp.Body)
	}

	var body struct {
		Token    string `json:"token"`
		Username string `json:"username"`
	}
	resp.json(t, &body)

	if body.Token == "" {
		t.Errorf("expected a non-empty token, got none: %s", resp.Body)
	}
	if body.Username != adminUser() {
		t.Errorf("expected username %q, got %q", adminUser(), body.Username)
	}
}

// TestLogin_WrongPassword: a valid user with the wrong password is rejected.
func TestLogin_WrongPassword(t *testing.T) {
	requireServer(t)

	resp := doRequest(t, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": adminUser(),
		"password": "definitely-not-the-password",
	})

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong password, got %d: %s", resp.StatusCode, resp.Body)
	}
	if got := resp.field(t, "token"); got != "" {
		t.Errorf("a failed login must not return a token, got %q", got)
	}
}

// TestLogin_UnknownUser: a username that does not exist is rejected with 401.
func TestLogin_UnknownUser(t *testing.T) {
	requireServer(t)

	resp := doRequest(t, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": "no-such-user-xyz",
		"password": "whatever",
	})

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unknown user, got %d: %s", resp.StatusCode, resp.Body)
	}
}

// TestLogin_MissingFields: empty username/password is a 400 Bad Request.
func TestLogin_MissingFields(t *testing.T) {
	requireServer(t)

	cases := []struct {
		name string
		body map[string]string
	}{
		{"empty both", map[string]string{"username": "", "password": ""}},
		{"empty password", map[string]string{"username": adminUser(), "password": ""}},
		{"empty username", map[string]string{"username": "", "password": adminPass()}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := doRequest(t, http.MethodPost, "/api/auth/login", "", tc.body)
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", resp.StatusCode, resp.Body)
			}
		})
	}
}

// TestLogin_TokenWorksOnProtectedRoute: the token returned by login must
// actually grant access to an authenticated endpoint (here: GET /api/containers).
func TestLogin_TokenWorksOnProtectedRoute(t *testing.T) {
	requireServer(t)

	token := adminToken(t)

	// Without the token the protected route must reject us.
	noAuth := doRequest(t, http.MethodGet, "/api/containers", "", nil)
	if noAuth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("protected route without token expected 401, got %d: %s", noAuth.StatusCode, noAuth.Body)
	}

	// With the token it must succeed.
	withAuth := doRequest(t, http.MethodGet, "/api/containers", token, nil)
	if withAuth.StatusCode != http.StatusOK {
		t.Fatalf("protected route with token expected 200, got %d: %s", withAuth.StatusCode, withAuth.Body)
	}
}

// TestLogin_RejectsTamperedToken: a garbage / tampered bearer token is rejected.
func TestLogin_RejectsTamperedToken(t *testing.T) {
	requireServer(t)

	resp := doRequest(t, http.MethodGet, "/api/containers", "this.is.not.a.valid.jwt", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for tampered token, got %d: %s", resp.StatusCode, resp.Body)
	}
}
