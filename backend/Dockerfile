# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Cache deps
COPY go.mod go.sum ./
RUN go mod download

# Build binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o gymbro-server .

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /app/gymbro-server .

# Railway injects PORT env var automatically
EXPOSE 8080

CMD ["./gymbro-server"]
