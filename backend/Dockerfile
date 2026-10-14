# Gunakan image resmi Go
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Salin file dependencies
COPY go.mod go.sum ./
RUN go mod download

# Salin seluruh source code backend
COPY . .

# Build aplikasi Go menjadi binary bernama "main"
RUN go build -o main .

# Jalankan binary pada container yang ringan
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .

EXPOSE 8080
CMD ["./main"]
