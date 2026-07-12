# DIU Smart Section Pre-Registration — project task runner
#
#   make            show this help
#   make setup      first-time setup (deps + env check)
#   make dev        run the app locally
#
# Deployment is git-push based (Cloudflare Pages / Vercel), so there is
# deliberately no `deploy` target here — push to `main` to release.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

ENV_FILE      := .env.local
MIGRATION_DIR := supabase/migrations
SEED_FILE     := supabase/SAMPLE_DATA.sql
BACKUP_DIR    := backups

# SCHEMA.sql is a destructive full rebuild (it drops every table first), so it is
# excluded from the incremental `db-migrate` path and only used by `db-reset`.
SCHEMA_FILE   := $(MIGRATION_DIR)/SCHEMA.sql
BATCH_FILES   := $(sort $(filter-out $(SCHEMA_FILE),$(wildcard $(MIGRATION_DIR)/*.sql)))

# Direct Postgres connection string. Not required by the app itself (it talks to
# Supabase over HTTPS) — only by the db-* targets below. Read from the
# environment, falling back to a SUPABASE_DB_URL line in .env.local if present.
# Get it from: Supabase dashboard > Project Settings > Database > Connection string.
SUPABASE_DB_URL ?= $(shell grep -s '^SUPABASE_DB_URL=' $(ENV_FILE) | cut -d= -f2- | tr -d '"'\''')

REQUIRED_ENV_VARS := NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
OPTIONAL_ENV_VARS := REDIS_URL SUPABASE_DB_URL AUTO_LOCK_CRON_SECRET

##@ Getting started

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n"} \
		/^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@echo ""

setup: install env-check ## First-time setup: install deps and verify env
	@echo ""
	@echo "Setup complete. Run 'make dev' to start the app on http://localhost:3000"

install: ## Install npm dependencies
	npm install

ci: ## Clean install from package-lock.json (for CI / reproducible builds)
	npm ci

# Real target: anything needing dependencies depends on this, so a fresh clone
# can run `make dev` directly. Re-runs only when the manifests change.
node_modules: package.json package-lock.json
	npm install
	@touch node_modules

##@ Development

dev: node_modules ## Start the Next.js dev server (http://localhost:3000)
	npm run dev

build: node_modules ## Production build
	npm run build

start: node_modules ## Serve the production build (run `make build` first)
	npm run start

prod: build start ## Build then serve the production build

lint: node_modules ## Run ESLint
	npm run lint

lint-fix: node_modules ## Run ESLint and autofix what it can
	./node_modules/.bin/eslint --fix .

typecheck: node_modules ## Type-check with tsc (no emit)
	./node_modules/.bin/tsc --noEmit

check: lint typecheck build ## Run everything CI would: lint, typecheck, build

ui-add: node_modules ## Add a shadcn/ui component, e.g. make ui-add C=dialog
	@test -n "$(C)" || { echo "Usage: make ui-add C=<component>"; exit 1; }
	./node_modules/.bin/shadcn add $(C)

##@ Database (Supabase / Postgres)

db-migrate: require-db-url ## Apply incremental BATCH*.sql migrations (safe, non-destructive)
	@echo "Applying $(words $(BATCH_FILES)) migration(s) to $$(echo '$(SUPABASE_DB_URL)' | sed 's|://[^@]*@|://***@|')"
	@for f in $(BATCH_FILES); do \
		echo "--> $$f"; \
		psql "$(SUPABASE_DB_URL)" -v ON_ERROR_STOP=1 -q -f "$$f"; \
	done
	@echo "Migrations applied."

db-reset: require-db-url ## DESTRUCTIVE: drop everything and rebuild schema + migrations (CONFIRM=yes)
	@test "$(CONFIRM)" = "yes" || { \
		echo "This DROPS EVERY TABLE and rebuilds from $(SCHEMA_FILE)."; \
		echo "All data in the target database will be lost."; \
		echo "Re-run with: make db-reset CONFIRM=yes"; \
		exit 1; \
	}
	psql "$(SUPABASE_DB_URL)" -v ON_ERROR_STOP=1 -q -f "$(SCHEMA_FILE)"
	@$(MAKE) --no-print-directory db-migrate
	@echo "Database reset. Run 'make db-seed' for sample data."

db-seed: require-db-url ## Load sample/demo data (supabase/SAMPLE_DATA.sql)
	psql "$(SUPABASE_DB_URL)" -v ON_ERROR_STOP=1 -q -f "$(SEED_FILE)"
	@echo "Sample data loaded."

db-shell: require-db-url ## Open a psql shell against the database
	psql "$(SUPABASE_DB_URL)"

db-dump: require-db-url ## Dump the database to backups/<timestamp>.sql
	@mkdir -p $(BACKUP_DIR)
	@out=$(BACKUP_DIR)/dump-$$(date +%Y%m%d-%H%M%S).sql; \
	pg_dump "$(SUPABASE_DB_URL)" --no-owner --no-privileges -f "$$out"; \
	echo "Wrote $$out"

##@ Cache (Redis)

cache-clear: node_modules ## Delete the app's Redis cache keys (home + admin summary)
	@test -f $(ENV_FILE) || { echo "$(ENV_FILE) not found"; exit 1; }
	@node --env-file=$(ENV_FILE) -e "$$CACHE_CLEAR_JS"

##@ Maintenance

env-check: ## Verify required environment variables are present in .env.local
	@test -f $(ENV_FILE) || { echo "Missing $(ENV_FILE) — see README for required values."; exit 1; }
	@missing=0; \
	for v in $(REQUIRED_ENV_VARS); do \
		if grep -qE "^$$v=.+" $(ENV_FILE); then echo "  ok       $$v"; \
		else echo "  MISSING  $$v"; missing=1; fi; \
	done; \
	for v in $(OPTIONAL_ENV_VARS); do \
		if grep -qE "^$$v=.+" $(ENV_FILE); then echo "  ok       $$v (optional)"; \
		else echo "  unset    $$v (optional)"; fi; \
	done; \
	test $$missing -eq 0 || { echo ""; echo "Required variables are missing from $(ENV_FILE)."; exit 1; }

doctor: ## Show tool versions and environment status
	@echo "node    $$(node -v 2>/dev/null || echo 'not installed')"
	@echo "npm     $$(npm -v 2>/dev/null || echo 'not installed')"
	@echo "psql    $$(psql --version 2>/dev/null || echo 'not installed (needed for db-* targets)')"
	@echo "deps    $$(test -d node_modules && echo installed || echo 'not installed — run make install')"
	@echo ""
	@$(MAKE) --no-print-directory env-check

audit: ## Report known vulnerabilities in dependencies
	npm audit

outdated: ## Show outdated dependencies
	npm outdated || true

clean: ## Remove build artifacts (.next, out)
	rm -rf .next out
	@echo "Build artifacts removed."

clean-all: clean ## Remove build artifacts and node_modules
	rm -rf node_modules
	@echo "node_modules removed."

reinstall: clean-all install ## Nuke everything and reinstall from scratch

require-db-url:
	@command -v psql >/dev/null || { echo "psql not found. Install it (brew install libpq) to use db-* targets."; exit 1; }
	@test -n "$(SUPABASE_DB_URL)" || { \
		echo "SUPABASE_DB_URL is not set."; \
		echo "Add it to $(ENV_FILE) or pass it inline:"; \
		echo "  make $(MAKECMDGOALS) SUPABASE_DB_URL='postgresql://...'"; \
		echo "Find it in Supabase: Project Settings > Database > Connection string."; \
		exit 1; \
	}

# Keys mirror src/lib/cache/keys.ts. The /api/cache/invalidate route needs an
# authenticated staff session, so this talks to Redis directly instead.
define CACHE_CLEAR_JS
const { createClient } = require("redis");
const url = process.env.REDIS_URL || process.env.REDIS_CONNECTION_URL;
if (!url) {
  console.error("REDIS_URL is not set in .env.local — no cache to clear.");
  process.exit(1);
}
const keys = ["section-registration:home:v1", "section-registration:admin-summary:v1"];
(async () => {
  const client = createClient({ url });
  client.on("error", () => {});
  await client.connect();
  const deleted = await client.del(keys);
  console.log("Cleared " + deleted + " of " + keys.length + " cache key(s).");
  await client.quit();
})().catch((err) => {
  console.error("Redis error: " + err.message);
  process.exit(1);
});
endef
export CACHE_CLEAR_JS

.PHONY: help setup install ci dev build start prod lint lint-fix typecheck check ui-add \
        db-migrate db-reset db-seed db-shell db-dump cache-clear env-check doctor \
        audit outdated clean clean-all reinstall require-db-url
