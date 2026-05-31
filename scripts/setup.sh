#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== AirCode Setup ==="

# Python virtual environment
if [ ! -d "$PROJECT_DIR/.venv/aircode" ]; then
    echo "Creating Python 3.12 virtual environment..."
    python3.12 -m venv "$PROJECT_DIR/.venv/aircode"
fi

echo "Installing Python dependencies..."
source "$PROJECT_DIR/.venv/aircode/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_DIR/backend/requirements.txt"

# Frontend dependencies
if [ -f "$PROJECT_DIR/frontend/package.json" ]; then
    echo "Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    npm install
fi

echo "=== Setup complete ==="
echo "Run 'make dev' to start development."
