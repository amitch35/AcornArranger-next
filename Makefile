# AcornArranger monorepo - orchestration for the Next.js web app + Python
# VRPTW scheduler sidecar.
#
# Local targets manage both processes from the repo root. The scheduler's own
# Makefile lives at acornarranger-scheduler/Makefile and is re-used here; the
# Next app is driven through its package.json scripts.
#
# VPS / systemd targets call systemctl on both acorn-web.service and
# acorn-scheduler.service. They no-op locally where systemctl is unavailable.
#
# Usage:
#   make                # show this help
#   make install        # bootstrap both packages
#   make dev            # start scheduler detached, run Next dev in foreground
#   make stop           # stop both local processes
#   make health         # probe both /health endpoints

.DEFAULT_GOAL := help

WEB_DIR       := AcornArranger
SCHED_DIR     := acornarranger-scheduler
WEB_PORT      ?= 3000
SCHED_PORT    ?= 8001
WEB_SERVICE   ?= acorn-web.service
SCHED_SERVICE ?= acorn-scheduler.service

.PHONY: help install dev stop build status health test \
        systemd-status systemd-restart systemd-logs

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo

# ---- Local development -----------------------------------------------------

install: ## Install JS + Python dependencies for both packages
	cd $(WEB_DIR) && npm ci
	$(MAKE) -C $(SCHED_DIR) install

dev: ## Start scheduler detached, then run Next dev in foreground (Ctrl+C stops web; run `make stop` to kill scheduler)
	$(MAKE) -C $(SCHED_DIR) start
	cd $(WEB_DIR) && npm run dev

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
	cd $(WEB_DIR) && npm run build

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

# ---- Linode VPS (systemd) --------------------------------------------------
# Drive both units together. Each target runs the matching systemctl command
# first on the web unit, then on the scheduler, so ordering mirrors production.

systemd-status: ## sudo systemctl status on both units
	sudo systemctl status $(WEB_SERVICE) --no-pager || true
	sudo systemctl status $(SCHED_SERVICE) --no-pager || true

systemd-restart: ## sudo systemctl restart both units, then status
	sudo systemctl restart $(WEB_SERVICE)
	sudo systemctl restart $(SCHED_SERVICE)
	@sleep 1
	$(MAKE) --no-print-directory systemd-status

systemd-logs: ## journalctl -u on both units (follow)
	sudo journalctl -u $(WEB_SERVICE) -u $(SCHED_SERVICE) -f
