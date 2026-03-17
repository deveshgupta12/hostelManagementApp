#!/usr/bin/env bash
set -euo pipefail

# HostelHub India full Linux installer
# Usage:
#   bash install.sh
# Optional environment variables:
#   DB_NAME=hostelhub DB_USER=postgres DB_PASSWORD=postgres DB_HOST=localhost DB_PORT=5432 APPLY_SCHEMA=1 bash install.sh

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

DB_NAME="${DB_NAME:-hostelhub}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
APPLY_SCHEMA="${APPLY_SCHEMA:-0}"

log() {
  printf "\n[HostelHub Installer] %s\n" "$1"
}

warn() {
  printf "\n[HostelHub Installer] WARNING: %s\n" "$1"
}

fail() {
  printf "\n[HostelHub Installer] ERROR: %s\n" "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  if command_exists sudo; then
    SUDO="sudo"
  else
    fail "This script needs elevated privileges (sudo). Install sudo or run as root."
  fi
fi

if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
  fail "Could not find backend/ and frontend/. Run this script from project root."
fi

detect_package_manager() {
  if command_exists apt-get; then
    echo "apt"
    return
  fi
  if command_exists dnf; then
    echo "dnf"
    return
  fi
  if command_exists pacman; then
    echo "pacman"
    return
  fi
  fail "Unsupported Linux package manager. Supported: apt, dnf, pacman."
}

PKG_MANAGER="$(detect_package_manager)"

install_system_dependencies() {
  log "Installing system dependencies via $PKG_MANAGER"

  case "$PKG_MANAGER" in
    apt)
      $SUDO apt-get update
      $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        curl ca-certificates git \
        python3 python3-pip python3-venv \
        build-essential libpq-dev \
        postgresql postgresql-contrib \
        nodejs npm
      ;;
    dnf)
      $SUDO dnf install -y \
        curl ca-certificates git \
        python3 python3-pip python3-devel \
        gcc gcc-c++ make \
        postgresql-server postgresql postgresql-devel \
        nodejs npm
      ;;
    pacman)
      $SUDO pacman -Sy --noconfirm \
        curl ca-certificates git \
        python python-pip \
        base-devel \
        postgresql \
        nodejs npm
      ;;
  esac
}

resolve_python() {
  if command_exists python3; then
    echo "python3"
    return
  fi
  if command_exists python; then
    echo "python"
    return
  fi
  fail "Python not found after installation."
}

start_postgres_service() {
  log "Starting PostgreSQL service"

  local services=("postgresql" "postgresql-16" "postgresql-15" "postgresql-14")

  if command_exists systemctl; then
    for service_name in "${services[@]}"; do
      if $SUDO systemctl list-unit-files | grep -q "^${service_name}\.service"; then
        $SUDO systemctl enable --now "$service_name" || true
      fi
    done
  fi

  if ! command_exists pg_isready; then
    fail "pg_isready command not found. PostgreSQL installation is incomplete."
  fi

  if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    if [ "$PKG_MANAGER" = "dnf" ] && command_exists postgresql-setup; then
      log "Initializing PostgreSQL data directory (dnf-based system)"
      $SUDO postgresql-setup --initdb || true
      if command_exists systemctl; then
        $SUDO systemctl enable --now postgresql || true
      fi
    fi
  fi

  if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    fail "PostgreSQL is not reachable on ${DB_HOST}:${DB_PORT}."
  fi
}

configure_database() {
  log "Configuring PostgreSQL role and database"

  if ! command_exists psql; then
    fail "psql is not installed."
  fi

  if [ "$DB_USER" = "postgres" ]; then
    $SUDO -u postgres psql -v ON_ERROR_STOP=1 -d postgres -c "ALTER USER postgres WITH PASSWORD '${DB_PASSWORD}';"
  else
    $SUDO -u postgres psql -v ON_ERROR_STOP=1 -d postgres <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL
  fi

  $SUDO -u postgres psql -v ON_ERROR_STOP=1 -d postgres <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') THEN
    CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
  END IF;
END
\$\$;
SQL
}

apply_schema_if_requested() {
  if [ "$APPLY_SCHEMA" != "1" ]; then
    return
  fi

  local schema_file="$BACKEND_DIR/db/schema.sql"
  if [ ! -f "$schema_file" ]; then
    warn "APPLY_SCHEMA=1 set, but schema file not found at $schema_file. Skipping schema apply."
    return
  fi

  log "Applying SQL schema from backend/db/schema.sql"
  if [ "$DB_USER" = "postgres" ]; then
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$schema_file"
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$schema_file"
  fi
}

run_pip_install() {
  local pip_args=("$@")
  local output

  set +e
  output=$($PYTHON_CMD -m pip "${pip_args[@]}" 2>&1)
  local status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    printf "%s\n" "$output"
    return 0
  fi

  if printf "%s" "$output" | grep -qi "externally-managed-environment"; then
    log "Detected externally managed Python (PEP 668). Retrying with --break-system-packages."
    $PYTHON_CMD -m pip "${pip_args[@]}" --break-system-packages
    return 0
  fi

  printf "%s\n" "$output" >&2
  return "$status"
}

write_backend_env() {
  log "Preparing backend .env"

  local env_file="$BACKEND_DIR/.env"
  local db_url="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

  if [ -f "$BACKEND_DIR/.env.example" ]; then
    cp "$BACKEND_DIR/.env.example" "$env_file"
  fi

  if [ ! -f "$env_file" ]; then
    cat > "$env_file" <<EOF
APP_NAME=HostelHub India API
API_V1_PREFIX=/api/v1
DATABASE_URL=${db_url}
JWT_SECRET_KEY=replace-with-secure-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
EOF
  else
    if grep -q '^DATABASE_URL=' "$env_file"; then
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${db_url}|" "$env_file"
    else
      printf "\nDATABASE_URL=%s\n" "$db_url" >> "$env_file"
    fi
  fi
}

install_backend_dependencies() {
  log "Installing backend dependencies"
  cd "$BACKEND_DIR"
  run_pip_install install --upgrade pip
  run_pip_install install -r requirements.txt
}

install_frontend_dependencies() {
  if ! command_exists npm; then
    fail "npm is not installed."
  fi

  log "Installing frontend dependencies"
  cd "$FRONTEND_DIR"
  npm install
}

check_versions() {
  log "Checking installed versions"
  $PYTHON_CMD --version || true
  if command_exists node; then
    node --version || true
  fi
  if command_exists npm; then
    npm --version || true
  fi
  psql --version || true
}

main() {
  install_system_dependencies
  PYTHON_CMD="$(resolve_python)"
  check_versions
  start_postgres_service
  configure_database
  apply_schema_if_requested
  write_backend_env
  install_backend_dependencies
  install_frontend_dependencies

  cat <<EOF

Installation complete.

Configured values:
- DATABASE_URL=postgresql+psycopg2://${DB_USER}:********@${DB_HOST}:${DB_PORT}/${DB_NAME}
- APPLY_SCHEMA=${APPLY_SCHEMA}

Next steps:
1) Start backend:
   cd backend
   python3 -m uvicorn app.main:app --reload

2) Start frontend in a new terminal:
   cd frontend
   npm run dev

3) Open app:
   Frontend: http://127.0.0.1:5173
   Backend docs: http://127.0.0.1:8000/docs

EOF
}

main
