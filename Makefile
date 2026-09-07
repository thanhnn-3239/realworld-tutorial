COMPOSE := HOST_USER_ID=$(shell id -u) HOST_GROUP_ID=$(shell id -g) docker compose
EXEC_IN_WORKSPACE := $(COMPOSE) exec -w /app app

.PHONY: dev stop down restart logs test test-e2e lint build generate migrate seed shell run-in-workspace

dev:
	@test -f .env || { echo "Missing .env; run: cp .env.example .env" >&2; exit 2; }
	$(COMPOSE) up --detach --build --wait --remove-orphans

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down --remove-orphans

restart:
	$(COMPOSE) restart app

logs:
	$(COMPOSE) logs --tail=500 --follow app

test:
	$(EXEC_IN_WORKSPACE) pnpm test

test-e2e:
	$(EXEC_IN_WORKSPACE) pnpm test:e2e

lint:
	$(EXEC_IN_WORKSPACE) pnpm lint:ci

build:
	docker build --target build .

generate:
	$(EXEC_IN_WORKSPACE) pnpm db:generate

migrate:
	$(EXEC_IN_WORKSPACE) pnpm db:migrate:deploy

seed:
	$(EXEC_IN_WORKSPACE) pnpm db:seed

shell:
	$(EXEC_IN_WORKSPACE) /bin/sh

run-in-workspace:
	@test -n "$(strip $(command))" || { echo "Usage: make run-in-workspace command='pnpm test'" >&2; exit 2; }
	$(EXEC_IN_WORKSPACE) $(command)
