.PHONY: all backend frontend install install-backend install-frontend clean help

# Default target
all: help

# Install all dependencies
install: install-backend install-frontend

install-backend:
	@echo "📦 Installing backend dependencies..."
	cd backend && pip3 install -r requirements.txt

install-frontend:
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install

# Start services
backend:
	@echo "🚀 Starting backend server on http://localhost:8000..."
	cd backend && python3 -m uvicorn app.main:app --reload --port 8000

frontend:
	@echo "🚀 Starting frontend dev server on http://localhost:5173..."
	cd frontend && npm run dev

# Start all services (backend in background, frontend in foreground)
start:
	@echo "🚀 Starting all services..."
	@make backend &
	@sleep 2
	@make frontend

# Start with separate terminals (macOS)
dev:
	@echo "🚀 Opening backend and frontend in separate terminals..."
	@osascript -e 'tell app "Terminal" to do script "cd $(PWD) && make backend"'
	@osascript -e 'tell app "Terminal" to do script "cd $(PWD) && make frontend"'

# Build frontend for production
build:
	@echo "🔨 Building frontend for production..."
	cd frontend && npm run build

# Run stats scripts directly
stats-claude:
	@echo "📊 Running Claude Code stats..."
	python3 backend/scripts/claude_code_stats.py --week

stats-cursor:
	@echo "📊 Running Cursor stats..."
	@if [ -f output/*.csv ]; then \
		python3 backend/scripts/cursor_stats.py output/*.csv --week; \
	else \
		echo "No CSV files found in output/"; \
	fi

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf frontend/dist frontend/node_modules/.vite
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Help
help:
	@echo "Usage Stats Dashboard - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install all dependencies"
	@echo "  make install-backend  Install backend (Python) dependencies"
	@echo "  make install-frontend Install frontend (Node) dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make backend          Start backend server (port 8000)"
	@echo "  make frontend         Start frontend dev server (port 5173)"
	@echo "  make start            Start both (backend background, frontend foreground)"
	@echo "  make dev              Open both in separate Terminal windows (macOS)"
	@echo ""
	@echo "Build:"
	@echo "  make build            Build frontend for production"
	@echo "  make clean            Clean build artifacts"
	@echo ""
	@echo "Stats (CLI):"
	@echo "  make stats-claude     Run Claude Code stats for this week"
	@echo "  make stats-cursor     Run Cursor stats (requires CSV in output/)"
