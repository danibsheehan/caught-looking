package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
)

// CORS returns chi CORS middleware configured for browser calls from the React SPA.
// X-Request-ID is exposed so cross-origin clients (VITE_API_BASE) can correlate errors with slog.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "HEAD", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: false,
		MaxAge:           300,
	})
}
