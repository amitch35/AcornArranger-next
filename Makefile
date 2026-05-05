# AcornArranger monorepo - orchestration for the Next.js web app + Python
# VRPTW scheduler sidecar.
#
# Local targets manage both processes from the repo root. The scheduler's own
# Makefile lives at acornarranger-scheduler/Makefile and is re-used here; the
# Next app is driven through its package.json scripts.
#
# VPS / PM2 targets drive both apps via the root ecosystem.config.js. PM2 is
# expected to be installed globally on the host (`npm install -g pm2`); these
# targets no-op locally where the `pm2` binary is unavailable.
#
# Usage:
#   make                # show this help
#   make install        # bootstrap both packages
#   make dev            # start scheduler detached, run Next dev in foreground
#   make stop           # stop both local processes
#   make health         # probe both /health endpoints

.DEFAULT_GOAL := help

WEB_DIR    := AcornArranger
SCHED_DIR  := acornarranger-scheduler
WEB_PORT   ?= 3000
SCHED_PORT ?= 8001
PM2_CONFIG ?= ecosystem.config.js
PM2_WEB    ?= acornarranger-web
PM2_SCHED  ?= acornarranger-scheduler

.PHONY: help install dev stop build status health test \
        pm2-start pm2-stop pm2-restart pm2-reload pm2-status pm2-logs pm2-save

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?##"; printf "\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo

# ---- Local development -----------------------------------------------------

install: ## Install JS + Python dependencies for both packages
	cd $(WEB_DIR) && npm ci
	$(MAKE) -C $(SCHED_DIR) install

dev: ## Start scheduler detached, then run Next dev in foreground (Ctrl+C stops web; run `make stop` to kill scheduler)
	$(MAKE) -C $(SCHED_DIR) start
	cd $(WEB_DIR) && npm run dev -- -p $(WEB_PORT)

stop: ## Stop both local processes (scheduler + Next dev on $(WEB_PORT))
	-$(MAKE) -C $(SCHED_DIR) stop
	@pids=$$(lsof -ti tcp:$(WEB_PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
	  echo "stopping web pid(s): $$pids"; \
	  kill $$pids 2>/dev/null || true; \
	  sleep 0.5; \
	  still=$$(lsof -ti tcp:$(WEB_PORT) 2>/dev/null || true); \
	  if [ -n "$$still" ]; then kill -9 $$still 2>/dev/null || true; fi; \
	else \
	  echo "no process listening on $(WEB_PORT)"; \
	fi

build: ## Production build of the Next app
	cd $(WEB_DIR) && NODE_OPTIONS="--max-old-space-size=1024" npm run build

status: ## Show listeners on the web and scheduler ports
	@web=$$(lsof -ti tcp:$(WEB_PORT) 2>/dev/null || true); \
	if [ -n "$$web" ]; then echo "web:       running on 127.0.0.1:$(WEB_PORT) (pid $$web)"; \
	else echo "web:       stopped"; fi
	@sched=$$(lsof -ti tcp:$(SCHED_PORT) 2>/dev/null || true); \
	if [ -n "$$sched" ]; then echo "scheduler: running on 127.0.0.1:$(SCHED_PORT) (pid $$sched)"; \
	else echo "scheduler: stopped"; fi

health: ## curl both /health endpoints
	@echo "web:"
	@curl -fsS http://127.0.0.1:$(WEB_PORT)/api/health | (jq . 2>/dev/null || cat) || echo "  unreachable"
	@echo
	@echo "scheduler:"
	@curl -fsS http://127.0.0.1:$(SCHED_PORT)/health | (jq . 2>/dev/null || cat) || echo "  unreachable"
	@echo

test: ## Run lint + typecheck + tests for the Next app
	cd $(WEB_DIR) && npm run lint && npm run typecheck && npm run test

# ---- Linode VPS (PM2) ------------------------------------------------------
# Drive both apps together via the root ecosystem.config.js. PM2 must be
# installed globally on the host (`npm install -g pm2`). First-time deploy:
# run `make pm2-start` then `make pm2-save` once, and `pm2 startup` once
# (interactive) to install the boot-time resurrection shim.

pm2-start: ## pm2 start both apps from $(PM2_CONFIG)
	pm2 start $(PM2_CONFIG)

pm2-stop: ## pm2 stop both apps
	pm2 stop $(PM2_CONFIG)

pm2-restart: ## pm2 restart both apps, then status
	pm2 restart $(PM2_CONFIG)

pm2-reload: ## pm2 reload (zero-downtime) both apps, then status
	pm2 reload $(PM2_CONFIG)
	@sleep 1
	$(MAKE) --no-print-directory pm2-status

pm2-status: ## pm2 status (all managed processes)
	pm2 status

pm2-logs: ## pm2 logs for both apps (follow)
	pm2 logs $(PM2_WEB) $(PM2_SCHED)

pm2-save: ## Persist the current PM2 process list (for boot resurrection)
	pm2 save
