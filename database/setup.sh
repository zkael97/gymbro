#!/usr/bin/env bash
# =============================================================
# GymBro – PostgreSQL Setup Script
# Usage: bash database/setup.sh
# =============================================================
set -e

DB_NAME="gymbro"
DB_USER="gymbro_user"
DB_PASS="gymbro_pass"
SCHEMA="$(dirname "$0")/schema.sql"

echo "=== GymBro Database Setup ==="

# Make sure PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
  echo "[INFO] Starting PostgreSQL service..."
  sudo service postgresql start
fi

# Create role if it doesn't exist
echo "[1/3] Creating role '$DB_USER'..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"

# Create database if it doesn't exist
echo "[2/3] Creating database '$DB_NAME'..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Grant privileges
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

# Run schema
echo "[3/3] Applying schema..."
PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA"

# Grant table privileges (needed for SERIAL sequences too)
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"

echo ""
echo "=== Setup Complete! ==="
echo "Connection string:"
echo "  postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?sslmode=disable"
echo ""
echo "Run the backend with:"
echo "  cd backend && DATABASE_URL='postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?sslmode=disable' go run main.go"
