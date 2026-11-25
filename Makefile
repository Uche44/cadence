PY := backend/.venv/bin/python
VENV := backend/.venv
PORT ?= 8000

.PHONY: help install install-backend install-frontend dev-api dev-web migrate test test-backend test-frontend check-pwa check-layout icons lint format build harness verify clean

help:
	@echo "install          set up backend venv and frontend packages"
	@echo "dev-api          run the API on :8000 (terminal 1)"
	@echo "dev-web          run the frontend on :5173 (terminal 2)"
	@echo "migrate          apply database migrations"
	@echo "test             run both test suites"
	@echo "lint             ruff, eslint, and typecheck"
	@echo "format           apply ruff format and prettier"
	@echo "build            build the frontend into frontend/dist"
	@echo "check-pwa        verify manifest, icons, service worker"
	@echo "check-layout     drive real Chromium at 320/390/430px"
	@echo "icons            regenerate app icons and artwork"
	@echo "harness          prove both test runners can fail"
	@echo "verify           lint + test + build + pwa + layout + harness"

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

migrate:
	cd backend && .venv/bin/alembic upgrade head

test: test-backend test-frontend

test-backend:
	cd backend && .venv/bin/python -m pytest

test-frontend:
	cd frontend && npm test

check-pwa:
	cd frontend && npm run check:pwa

check-layout:
	cd frontend && npm run check:layout

icons:
	backend/.venv/bin/python scripts/generate_icons.py
	backend/.venv/bin/python scripts/prepare_assets.py

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

verify: lint test build check-pwa check-layout harness
	@echo
	@echo "All milestone checks passed."

clean:
	rm -rf frontend/dist
	rm -rf backend/.pytest_cache backend/.ruff_cache
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
