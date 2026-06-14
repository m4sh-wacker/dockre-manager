package e2e

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// uniqueUsername builds a username that is unique per test run so we never
// collide with an existing account (there is no delete-user endpoint, so each
// run leaves a throwaway user behind — that is intentional and harmless).
func uniqueUsername(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

// register creates a brand-new user and returns its token. The backend's
// /api/auth/register returns 201 with a token on success.
func register(t *testing.T, username, password string) string {
	t.Helper()
	resp := doRequest(t, http.MethodPost, "/api/auth/register", "", map[string]string{
		"username": username,
		"password": password,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register %q expected 201, got %d: %s", username, resp.StatusCode, resp.Body)
	}
	token := resp.field(t, "token")
	if token == "" {
		t.Fatalf("register response had no token: %s", resp.Body)
	}
	return token
}

// TestChangePassword_FullFlow is the core "reset password" end-to-end journey:
// register → change password → old password stops working → new password works.
//
// It runs against a freshly-registered throwaway user so it never touches the
// admin account.
func TestChangePassword_FullFlow(t *testing.T) {
	requireServer(t)

	user := uniqueUsername("pwflow")
	oldPass := "OldPassw0rd!"
	newPass := "NewPassw0rd!"

	// 1. Register and obtain a token.
	token := register(t, user, oldPass)

	// 2. Sanity: the old password logs in.
	login(t, user, oldPass)

	// 3. Change the password.
	change := doRequest(t, http.MethodPost, "/api/auth/change-password", token, map[string]string{
		"current_password": oldPass,
		"new_password":     newPass,
	})
	if change.StatusCode != http.StatusOK {
		t.Fatalf("change-password expected 200, got %d: %s", change.StatusCode, change.Body)
	}

	// 4. The OLD password must now be rejected.
	oldLogin := doRequest(t, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": user,
		"password": oldPass,
	})
	if oldLogin.StatusCode != http.StatusUnauthorized {
		t.Fatalf("old password should be rejected after change, got %d: %s", oldLogin.StatusCode, oldLogin.Body)
	}

	// 5. The NEW password must work.
	newLogin := doRequest(t, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": user,
		"password": newPass,
	})
	if newLogin.StatusCode != http.StatusOK {
		t.Fatalf("new password should work after change, got %d: %s", newLogin.StatusCode, newLogin.Body)
	}
	if newLogin.field(t, "token") == "" {
		t.Errorf("login with new password returned no token: %s", newLogin.Body)
	}
}

// TestChangePassword_RequiresAuth: the endpoint is protected; no token => 401.
func TestChangePassword_RequiresAuth(t *testing.T) {
	requireServer(t)

	resp := doRequest(t, http.MethodPost, "/api/auth/change-password", "", map[string]string{
		"current_password": "a",
		"new_password":     "b",
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without auth, got %d: %s", resp.StatusCode, resp.Body)
	}
}

// TestChangePassword_WrongCurrent: the wrong current password is rejected and
// the account is left untouched (the original password still logs in).
func TestChangePassword_WrongCurrent(t *testing.T) {
	requireServer(t)

	user := uniqueUsername("pwwrong")
	pass := "CorrectHorse1!"
	token := register(t, user, pass)

	resp := doRequest(t, http.MethodPost, "/api/auth/change-password", token, map[string]string{
		"current_password": "this-is-wrong",
		"new_password":     "Whatever123!",
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong current password, got %d: %s", resp.StatusCode, resp.Body)
	}

	// The original password must still be valid (no silent change happened).
	login(t, user, pass)
}

// TestChangePassword_MissingFields: empty current/new password => 400.
func TestChangePassword_MissingFields(t *testing.T) {
	requireServer(t)

	user := uniqueUsername("pwmissing")
	token := register(t, user, "SomePass123!")

	cases := []struct {
		name string
		body map[string]string
	}{
		{"empty both", map[string]string{"current_password": "", "new_password": ""}},
		{"empty new", map[string]string{"current_password": "SomePass123!", "new_password": ""}},
		{"empty current", map[string]string{"current_password": "", "new_password": "NewPass123!"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := doRequest(t, http.MethodPost, "/api/auth/change-password", token, tc.body)
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", resp.StatusCode, resp.Body)
			}
		})
	}
}

// TestRegister_DuplicateUsername: registering an existing username => 409.
func TestRegister_DuplicateUsername(t *testing.T) {
	requireServer(t)

	user := uniqueUsername("dup")
	register(t, user, "FirstPass123!")

	resp := doRequest(t, http.MethodPost, "/api/auth/register", "", map[string]string{
		"username": user,
		"password": "SecondPass123!",
	})
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 for duplicate username, got %d: %s", resp.StatusCode, resp.Body)
	}
}
