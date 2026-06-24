package authlogic

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrMissingCredentials = errors.New("username and password are required")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrLoginUnavailable   = errors.New("login unavailable")
)

type User struct {
	ID           string
	Username     string
	PasswordHash string
}

type LoginResponse struct {
	Token    string
	Username string
}

type UserLookup func(username string) (*User, error)

type TokenGenerator func(userID, username string) (string, error)

func Login(username, password string, lookup UserLookup, generateToken TokenGenerator) (LoginResponse, error) {
	if username == "" || password == "" {
		return LoginResponse{}, ErrMissingCredentials
	}
	if lookup == nil || generateToken == nil {
		return LoginResponse{}, ErrLoginUnavailable
	}

	user, err := lookup(username)
	if err != nil || user == nil {
		return LoginResponse{}, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return LoginResponse{}, ErrInvalidCredentials
	}

	token, err := generateToken(user.ID, user.Username)
	if err != nil {
		return LoginResponse{}, err
	}

	return LoginResponse{
		Token:    token,
		Username: user.Username,
	}, nil
}
