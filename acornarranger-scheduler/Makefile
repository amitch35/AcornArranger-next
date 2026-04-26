# Acorn Arranger Scheduler sidecar - local + VPS management.
#
# Local targets manage a uvicorn process bound to $(HOST):$(PORT). Detached
# starts (`make start`) write logs to $(LOG); foreground targets (`make dev`,
# `make run`) print to the terminal.
#
# Linode targets shell out to systemd and are intended to be run on the VPS
# from the deployed source dir. They no-op locally if systemctl isn't
# present.
#
# Usage:
#   make             # show this help
#   make install     # bootstrap the venv
#   make dev         # foreground with --reload (default for editing)
#   make start       # detached, logs to /tmp/acorn-scheduler.log
#   make restart     # detached restart
#   make health      # curl the /health endpoint

.DEFAULT_GOAL := help

VENV       ?= .venv
PIP        := $(VENV)/bin/pip
UVICORN    := $(VENV)/bin/uvicorn
HOST       ?= 127.0.0.1
PORT       ?= 8001
APP        := src.main:app
LOG        ?= /tmp/acorn-scheduler.log
SERVICE    ?= acorn-scheduler.service

.PHONY: help install dev run start stop restart status health logs clean \
        systemd-status systemd-restart systemd-logs

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo

# ---- Local development -----------------------------------------------------

install: ## Create venv and install package + dev deps
	@if [ ! -d $(VENV) ]; then \
	  (python3.11 -m venv $(VENV) 2>/dev/null || python3 -m venv $(VENV)); \
	fi
	$(PIP) install --upgrade pip
	$(PIP) install -e '.[dev]'

dev: ## Foreground uvicorn with --reload (recommended while editing src/)
	@if [ ! -x $(UVICORN) ]; then echo "venv missing; run 'make install' first"; exit 1; fi
	$(UVICORN) $(APP) --reload --host $(HOST) --port $(PORT)

run: ## Foreground uvicorn without reload (matches systemd unit behaviour)
	@if [ ! -x $(UVICORN) ]; then echo "venv missing; run 'make install' first"; exit 1; fi
	$(UVICORN) $(APP) --host $(HOST) --port $(PORT)

start: stop ## Start uvicorn detached, log to $(LOG)
	@if [ ! -x $(UVICORN) ]; then echo "venv missing; run 'make install' first"; exit 1; fi
	@nohup $(UVICORN) $(APP) --host $(HOST) --port $(PORT) > $(LOG) 2>&1 &
	@sleep 1
	@$(MAKE) --no-print-directory status
	@echo "logs: tail -f $(LOG)"

stop: ## Stop any process bound to $(PORT)
	@pids=$$(lsof -ti tcp:$(PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
	  echo "stopping pid(s): $$pids"; \
	  kill $$pids 2>/dev/null || true; \
	  sleep 0.5; \
	  still=$$(lsof -ti tcp:$(PORT) 2>/dev/null || true); \
	  if [ -n "$$still" ]; then kill -9 $$still 2>/dev/null || true; fi; \
	else \
	  echo "no process listening on $(PORT)"; \
	fi

restart: stop start ## Restart the detached sidecar

status: ## Show whether anything is bound to $(PORT)
	@pids=$$(lsof -ti tcp:$(PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
	  echo "running on $(HOST):$(PORT) (pid $$pids)"; \
	else \
	  echo "stopped (nothing listening on $(PORT))"; \
	fi

health: ## curl the /health endpoint
	@curl -fsS http://$(HOST):$(PORT)/health \
	  | (jq . 2>/dev/null || cat); \
	echo

logs: ## tail the detached log file written by `make start`
	@if [ ! -f $(LOG) ]; then echo "no log at $(LOG); start with 'make start' first"; exit 1; fi
	tail -f $(LOG)

clean: ## Remove venv, build artifacts, __pycache__
	rm -rf $(VENV)
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type d -name "*.egg-info" -prune -exec rm -rf {} +

# ---- Linode VPS (systemd) --------------------------------------------------
# These run on the VPS where the sidecar is installed under systemd. They
# require sudo and the unit file from systemd/acorn-scheduler.service.

systemd-status: ## sudo systemctl status $(SERVICE)
	sudo systemctl status $(SERVICE) --no-pager

systemd-restart: ## sudo systemctl restart $(SERVICE), then status
	sudo systemctl restart $(SERVICE)
	@sleep 1
	sudo systemctl status $(SERVICE) --no-pager

systemd-logs: ## journalctl -u $(SERVICE) -f
	sudo journalctl -u $(SERVICE) -f
