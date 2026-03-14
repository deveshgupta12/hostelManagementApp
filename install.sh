#!/usr/bin/env bash
set -euo pipefail

# HostelHub India Linux installation script
# Usage:
#   bash install.sh
# Optional environment variables:
#   CREATE_DB=1 DB_NAME=hostelhub DB_USER=postgres DB_HOST=localhost DB_PORT=5432 bash install.sh

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

DB_NAME="${DB_NAME:-hostelhub}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
CREATE_DB="${CREATE_DB:-0}"

log() {
  printf "\n[HostelHub Installer] %s\n" "$1"
}

fail() {
  printf "\n[HostelHub Installer] ERROR: %s\n" "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
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
  fail "Python is not installed. Install Python 3.11+ and rerun."
}

resolve_pip() {
  if command_exists pip3; then
    echo "pip3"
    return
  fi
  if command_exists pip; then
    echo "pip"
    return
  fi
  fail "pip is not installed. Install pip and rerun."
}

PYTHON_CMD="$(resolve_python)"
PIP_CMD="$(resolve_pip)"

if ! command_exists npm; then
  fail "npm is not installed. Install Node.js (20+) and rerun."
fi

if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
  fail "Could not find backend/ and frontend/ folders. Run this script from project root."
fi

log "Installing backend Python dependencies"
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  "$PYTHON_CMD" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
"$PIP_CMD" install --upgrade pip
"$PIP_CMD" install -r requirements.txt

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  log "Created backend/.env from backend/.env.example"
fi

deactivate || true

log "Installing frontend Node dependencies"
cd "$FRONTEND_DIR"
npm install

if [ "$CREATE_DB" = "1" ]; then
  if command_exists psql; then
    log "Attempting PostgreSQL database creation: $DB_NAME"
    DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
    if [ "$DB_EXISTS" = "1" ]; then
      log "Database $DB_NAME already exists."
    else
      createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
      log "Database $DB_NAME created successfully."
    fi
  else
    log "Skipping DB creation because psql is not installed."
  fi
fi

cat <<EOF

Installation complete.

Next steps:
1) Start backend:
   cd backend
   source .venv/bin/activate
   uvicorn app.main:app --reload

2) Start frontend in a new terminal:
   cd frontend
   npm run dev

3) Open app:
   Frontend: http://127.0.0.1:5173
   Backend docs: http://127.0.0.1:8000/docs

EOF
