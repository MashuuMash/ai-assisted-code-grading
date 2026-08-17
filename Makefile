.PHONY: help install backend-install backend-lint backend-test backend-migrations frontend-install frontend-build frontend-lint docker-up docker-down docker-logs

help:
	@echo "AI-Assisted Code Grading Platform"
	@echo ""
	@echo "Backend targets:"
	@echo "  backend-install      Install backend dependencies"
	@echo "  backend-lint         Run backend linting (ruff)"
	@echo "  backend-test         Run backend tests"
	@echo "  backend-migrations   Run database migrations"
	@echo ""
	@echo "Frontend targets:"
	@echo "  frontend-install     Install frontend dependencies"
	@echo "  frontend-build       Build frontend for production"
	@echo "  frontend-lint        Run frontend linting"
	@echo ""
	@echo "Docker targets:"
	@echo "  docker-up            Start all services with Docker Compose"
	@echo "  docker-down          Stop all services"
	@echo "  docker-logs          View Docker logs"

backend-install:
	cd backend && python -m venv venv && venv/Scripts/pip install -r requirements.txt

backend-lint:
	cd backend && ruff check .

backend-test:
	cd backend && pytest -v

backend-migrations:
	cd backend && alembic upgrade head

frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build

frontend-lint:
	cd frontend && npm run lint

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f
