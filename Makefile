.PHONY: dev dev-mock start migrate backend frontend install-linux

# Copy env files on first run: cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env

dev: migrate backend-dev frontend-dev

dev-mock:
	@echo "Starting with NFS_PROVIDER=mock (non-Linux / Windows dev)"
	@cd backend && set NFS_PROVIDER=mock&& set APP_ENV=dev&& go run ./cmd/server &
	@cd frontend && npm run dev

start: migrate
	@cd backend && go run ./cmd/server &
	@cd frontend && npm run start

migrate:
	@cd backend && go run ./cmd/migrate up

backend-dev:
	@cd backend && go run ./cmd/server

frontend-dev:
	@cd frontend && npm run dev

backend:
	@cd backend && go build -o bin/nfs-manager-api ./cmd/server

frontend:
	@cd frontend && npm run build

install-linux:
	@bash scripts/install-linux.sh

docker-up:
	@docker compose -f deploy/docker-compose.yml up -d --build

docker-down:
	@docker compose -f deploy/docker-compose.yml down
