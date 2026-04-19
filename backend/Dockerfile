# Build: from repo root — docker build -t caught-looking-api -f backend/Dockerfile backend
# Cloud Run sets PORT; config already maps PORT → HTTP listen address.

FROM golang:1.22-bookworm AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /server .

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /server /server
USER nonroot:nonroot
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
