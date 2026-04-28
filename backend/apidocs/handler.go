package apidocs

import (
	"embed"
	"net/http"
)

//go:embed openapi.yaml swagger.html
var assets embed.FS

// OpenAPISpec serves the checked-in OpenAPI document.
func OpenAPISpec() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, assets, "openapi.yaml")
	})
}

// SwaggerUI serves a minimal Swagger UI page that reads /openapi.yaml.
func SwaggerUI() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, assets, "swagger.html")
	})
}
