package authlogic

import "testing"

func TestLogin(t *testing.T) {

	response, err := Login(
		"admin",
		"admin123",
		func(username string) (*User, error) {
			return &User{
				ID:           "admin-001",
				Username:     "admin",
				PasswordHash: "$2b$10$UxwGXzXvHhmD5hbYUxwcpunqmbUuVRGBgDh0B0myIzDPPXKg6.A56",
			}, nil
		},
		func(userID, username string) (string, error) {
			return "unit-test-token", nil
		},
	)

	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	if response.Username != "admin" {
		t.Fatal("wrong username")
	}

	if response.Token == "" {
		t.Fatal("no token")
	}
}
