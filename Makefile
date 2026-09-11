COMPOSE := HOST_USER_ID=$(shell id -u) HOST_GROUP_ID=$(shell id -g) docker compose
EXEC_IN_WORKSPACE := $(COMPOSE) exec -w /app app
E2E_COMPOSE := HOST_USER_ID=$(shell id -u) HOST_GROUP_ID=$(shell id -g) docker compose --project-name realworld-e2e --env-file .env.e2e
E2E_RUN := $(E2E_COMPOSE) run --rm -w /app app
E2E_APP_IMAGE := realworld-e2e-app
E2E_ENV_FILE := .env.e2e
E2E_ENV_TEMPLATE := .env.e2e.example
E2E_TEST_ARGS ?= --maxWorkers=4
E2E_BOOTSTRAP := CI=true pnpm install --frozen-lockfile --prefer-offline && pnpm db:generate &&

.PHONY: dev stop down restart logs test test-e2e lint build generate migrate seed shell run-in-workspace e2e-env e2e-image run-in-e2e stop-e2e down-e2e clean-e2e

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

e2e-env:
	@if [ ! -f $(E2E_ENV_FILE) ]; then cp $(E2E_ENV_TEMPLATE) $(E2E_ENV_FILE); echo "Created $(E2E_ENV_FILE) from $(E2E_ENV_TEMPLATE)"; fi

e2e-image: e2e-env
	@docker image inspect $(E2E_APP_IMAGE) >/dev/null 2>&1 || $(E2E_COMPOSE) build app

test-e2e: e2e-image
	$(E2E_RUN) sh -c '$(E2E_BOOTSTRAP) pnpm test:e2e $(E2E_TEST_ARGS)'

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

run-in-e2e: e2e-image
	@test -n "$(strip $(command))" || { echo "Usage: make run-in-e2e command='pnpm typecheck'" >&2; exit 2; }
	$(E2E_RUN) sh -c '$(E2E_BOOTSTRAP) $(command)'

stop-e2e: e2e-env
	$(E2E_COMPOSE) stop postgres minio

down-e2e: e2e-env
	$(E2E_COMPOSE) down --remove-orphans

clean-e2e: e2e-env
	$(E2E_COMPOSE) down --volumes --remove-orphans
