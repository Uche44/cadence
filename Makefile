PY := backend/.venv/bin/python
VENV := backend/.venv
PORT ?= 8000

.PHONY: help install install-backend install-frontend dev-api dev-web test test-backend test-frontend lint format build harness verify clean

help:
	@echo "install          set up backend venv and frontend packages"
	@echo "dev-api          run the API on :8000 (terminal 1)"
	@echo "dev-web          run the frontend on :5173 (terminal 2)"
	@echo "test             run both test suites"
	@echo "lint             ruff, eslint, and typecheck"
	@echo "format           apply ruff format and prettier"
	@echo "build            build the frontend into frontend/dist"
	@echo "harness          prove both test runners can fail"
	@echo "verify           lint + test + build + harness"

install: install-backend install-frontend

install-backend:
	python3 -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -e "./backend[dev]"

install-frontend:
	cd frontend && npm install

dev-api:
	cd backend && .venv/bin/uvicorn app.asgi:app --reload --port $(PORT)

dev-web:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && .venv/bin/python -m pytest

test-frontend:
	cd frontend && npm test

lint:
	cd backend && .venv/bin/ruff check .
	cd backend && .venv/bin/ruff format --check .
	cd frontend && npm run lint
	cd frontend && npm run format
	cd frontend && npm run typecheck

format:
	cd backend && .venv/bin/ruff format .
	cd frontend && npm run format:write

build:
	cd frontend && npm run build

harness:
	bash scripts/verify_harness.sh

verify: lint test build harness
	@echo
	@echo "All milestone checks passed."

clean:
	rm -rf frontend/dist
	rm -rf backend/.pytest_cache backend/.ruff_cache
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
