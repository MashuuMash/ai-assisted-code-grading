.PHONY: help check-emoji backend-lint backend-test frontend-lint frontend-build

help:
	@echo "Available commands:"
	@echo "  make check-emoji    - Enforce strict no-emoji policy across codebase"
	@echo "  make backend-lint   - Run Ruff linter on backend and scripts"
	@echo "  make backend-test   - Run pytest suite on backend"
	@echo "  make frontend-lint  - Run frontend linter"
	@echo "  make frontend-build - Run frontend production build"

check-emoji:
	python scripts/check_no_emoji.py

backend-lint:
	ruff check backend scripts

backend-test:
	pytest backend/tests

frontend-lint:
	cd frontend && npm run lint

frontend-build:
	cd frontend && npm run build
