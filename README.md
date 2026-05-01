# AcornArranger

AcornArranger is a scheduling app for vacation-rental housekeeping teams. Managers build daily plans across dozens of properties, reconcile with Homebase shifts, and push cleans back to ResortCleaning as the system of record. The repo is a small monorepo: a Next.js web app plus an optional Python VRPTW solver that runs as a local sidecar on the same host.

## Repository layout

| Path | What's in it |
| ---- | ------------ |
| [`AcornArranger/`](AcornArranger/) | Next.js 15 app (App Router, Supabase, Tailwind, shadcn/ui). The primary product. |
| [`acornarranger-scheduler/`](acornarranger-scheduler/) | Python 3.11 FastAPI sidecar running an OR-Tools VRPTW solver. Optional — the legacy Postgres RPC engine is a full fallback. |
| [`docs/`](docs/) | Planning and design documents. Living reference, not a spec. |
| [`.taskmaster/`](.taskmaster/) | Taskmaster AI PRD and configuration (task tracking). |

The Next app talks to Supabase for data/auth and speaks to the scheduler sidecar only from the `/api/plans/build/[plan_date]` route when the operator selects the `VRPTW` engine. When the sidecar is down or disabled, the legacy `build_schedule_plan` RPC path remains fully functional.

## Quick start (local development)

Requirements: Node 20+, Python 3.11+, and a Supabase project.

```bash
# 1. Install dependencies for both packages
make install

# 2. Copy the env template and fill in Supabase keys
cp AcornArranger/.env.example AcornArranger/.env.local
$EDITOR AcornArranger/.env.local

# 3. Start the scheduler sidecar (detached) and the Next dev server (foreground)
make dev

# 4. In another terminal, check that both are up
make health
```

`Ctrl+C` stops the Next dev server. The scheduler keeps running in the background; `make stop` kills both.

## Environment variables

All variables are read by the Next app; the scheduler has no env reads beyond what the Makefile / systemd unit pass to `uvicorn`.

| Name | Required | Purpose |
| ---- | -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (from dashboard → Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | yes | Supabase anon/publishable key. |
| `ACORN_SCHEDULER_URL` | no | Scheduler sidecar base URL. Defaults to `http://127.0.0.1:8001`. |
| `ACORN_SCHEDULER_TIMEOUT_MS` | no | Max ms to wait for `/solve`. Defaults to `60000`. |
| `SITE_URL` | no | Public origin of the deployed app (e.g. `https://app.acornarranger.com`). Used by `app/layout.tsx` to populate Next.js `metadataBase`. Defaults to `http://localhost:3000`. |

For production on the VPS, put the same vars into `/opt/acornarranger-web/.env.production`. That file is gitignored.

## Production deployment (Linode VPS, systemd)

Both processes run on one VPS under systemd as user `acorn`:

- [`AcornArranger/systemd/acorn-web.service`](AcornArranger/systemd/acorn-web.service) — runs `npm run start` from `/opt/acornarranger-web`.
- [`acornarranger-scheduler/systemd/acorn-scheduler.service`](acornarranger-scheduler/systemd/acorn-scheduler.service) — runs `uvicorn src.main:app` on `127.0.0.1:8001`.

The web unit deliberately does **not** declare `Requires=acorn-scheduler.service`. The scheduler is optional (VRPTW only), and a dead sidecar must not take the web app down — operators fall back to the legacy build engine until the sidecar is repaired. See the comments in `acorn-web.service` for the optional soft coupling (`Wants=` / `After=`).

The scheduler binds to `127.0.0.1` so it is not reachable from the public internet; the Next.js server is the only intended client.

On the VPS you can drive both units from the repo-root Makefile:

```bash
make systemd-status   # status of both units
make systemd-restart  # restart both
make systemd-logs     # follow journalctl for both
```

First-time deployment is documented in [`acornarranger-scheduler/README.md`](acornarranger-scheduler/README.md#linode-deployment) for the scheduler. The web side mirrors that pattern: check out the repo to `/opt/acornarranger-web`, run `npm ci && npm run build`, drop the `.env.production` file in place, then `sudo cp AcornArranger/systemd/acorn-web.service /etc/systemd/system/` and `sudo systemctl enable --now acorn-web.service`.

## Top-level commands

```
make install       install JS + Python deps for both packages
make dev           start scheduler + Next dev server locally
make stop          stop both local processes
make build         production build of the Next app
make status        show what's listening on :3000 and :8001
make health        curl both /health endpoints
make test          lint + typecheck + unit tests for the Next app
make systemd-*     manage both systemd units on the VPS
```

The scheduler has its own [Makefile](acornarranger-scheduler/Makefile) for lower-level operations (`make -C acornarranger-scheduler dev`, `restart`, `logs`, etc).

## Further reading

- [`AcornArranger/README.md`](AcornArranger/README.md) — Next app architecture, scripts, and data layer.
- [`acornarranger-scheduler/README.md`](acornarranger-scheduler/README.md) — sidecar HTTP contract, operating notes, failure modes.
- [`docs/`](docs/) — product scope, UI plan, page structure (design-era notes).
- [`.taskmaster/docs/acornarranger-rebuild-prd.txt`](.taskmaster/docs/acornarranger-rebuild-prd.txt) — rebuild PRD.
