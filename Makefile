.PHONY: dev dev:fe dev:be build clean setup

PYTHON := .venv/aircode/bin/python
PIP    := .venv/aircode/bin/pip

setup:
	chmod +x scripts/setup.sh
	./scripts/setup.sh

dev: setup
	@echo "Starting development environment..."
	$(MAKE) dev:fe &
	$(MAKE) dev:be

dev:fe:
	@echo "Starting frontend dev server..."
	cd frontend && npm run dev

dev:be:
	@echo "Starting PyWebView backend..."
	AIRCODE_DEV=1 $(PYTHON) backend/main.py

build:
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Building macOS app..."
	$(PYTHON) -m PyInstaller aircode.spec --noconfirm --clean
	@echo "Build complete: dist/AirCode.app"

clean:
	rm -rf frontend/dist
	rm -rf dist
	rm -rf build
	rm -rf __pycache__
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
