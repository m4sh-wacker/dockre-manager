package main

import (
        "context"
        "fmt"
        "log"
        "net/http"
        "strings"
        "time"

        "github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("docker-manager-secret-key-2024")

func init() {
        if secret := getEnv("JWT_SECRET", ""); secret != "" {
                jwtSecret = []byte(secret)
        }
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                // Fully permissive CORS (no credentials are used, only Bearer tokens).
                w.Header().Set("Access-Control-Allow-Origin", "*")
                w.Header().Set("Access-Control-Allow-Methods", "*")
                w.Header().Set("Access-Control-Allow-Headers", "Authorization, *")
                w.Header().Set("Access-Control-Expose-Headers", "*")
                w.Header().Set("Access-Control-Max-Age", "86400")

                if r.Method == "OPTIONS" {
                        w.WriteHeader(http.StatusOK)
                        return
                }

                next.ServeHTTP(w, r)
        })
}

// Auth middleware - validates JWT token
func authMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                authHeader := r.Header.Get("Authorization")
                if authHeader == "" {
                        respondError(w, http.StatusUnauthorized, "Authorization header required")
                        return
                }

                parts := strings.SplitN(authHeader, " ", 2)
                if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
                        respondError(w, http.StatusUnauthorized, "Invalid authorization header format")
                        return
                }

                tokenString := parts[1]
                claims := &Claims{}

                token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
                        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
                        }
                        return jwtSecret, nil
                })

                if err != nil || !token.Valid {
                        respondError(w, http.StatusUnauthorized, "Invalid or expired token")
                        return
                }

                // Add claims to context
                ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
                ctx = context.WithValue(ctx, "username", claims.Username)
                next.ServeHTTP(w, r.WithContext(ctx))
        })
}

// Generate JWT token
func generateToken(userID, username string) (string, error) {
        claims := &Claims{
                UserID:   userID,
                Username: username,
                RegisteredClaims: jwt.RegisteredClaims{
                        ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
                        IssuedAt:  jwt.NewNumericDate(time.Now()),
                },
        }

        token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
        return token.SignedString(jwtSecret)
}

// recoveryMiddleware catches panics and returns 500
func recoveryMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                defer func() {
                        if err := recover(); err != nil {
                                log.Printf("PANIC: %v", err)
                                respondError(w, http.StatusInternalServerError, "Internal server error")
                        }
                }()
                next.ServeHTTP(w, r)
        })
}

// loggingMiddleware logs all requests
func loggingMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                start := time.Now()
                next.ServeHTTP(w, r)
                log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
        })
}

func getUserIDFromContext(r *http.Request) string {
        if val, ok := r.Context().Value("user_id").(string); ok {
                return val
        }
        return ""
}

func getUsernameFromContext(r *http.Request) string {
        if val, ok := r.Context().Value("username").(string); ok {
                return val
        }
        return ""
}
