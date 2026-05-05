# AcornArranger

AcornArranger is a scheduling app for vacation-rental housekeeping teams. Managers build daily plans across dozens of properties, reconcile with Homebase shifts, and push cleans back to ResortCleaning as the system of record. The repo is a small monorepo: a Next.js web app plus an optional Python VRPTW solver that runs as a local sidecar on the same host.

## Repository layout


| Path                                                   | What's in it                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `[AcornArranger/](AcornArranger/)`                     | Next.js 15 app (App Router, Supabase, Tailwind, shadcn/ui). The primary product.                                            |
| `[acornarranger-scheduler/](acornarranger-scheduler/)` | Python 3.11 FastAPI sidecar running an OR-Tools VRPTW solver. Optional — the legacy Postgres RPC engine is a full fallback. |
| `[docs/](docs/)`                                       | Planning and design documents. Living reference, not a spec.                                                                |
| `[.taskmaster/](.taskmaster/)`                         | Taskmaster AI PRD and configuration (task tracking).                                                                        |


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

All variables are read by the Next app; the scheduler has no env reads beyond the few process-level vars set by the Makefile / PM2 ecosystem config.


| Name                                           | Required | Purpose                                                                                                                                                                     |
| ---------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                     | yes      | Supabase project URL (from dashboard → Project Settings → API).                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | yes      | Supabase anon/publishable key.                                                                                                                                              |
| `ACORN_SCHEDULER_URL`                          | no       | Scheduler sidecar base URL. Defaults to `http://127.0.0.1:8001`.                                                                                                            |
| `ACORN_SCHEDULER_TIMEOUT_MS`                   | no       | Max ms to wait for `/solve`. Defaults to `60000`.                                                                                                                           |
| `SITE_URL`                                     | no       | Public origin of the deployed app (e.g. `https://app.acornarranger.com`). Used by `app/layout.tsx` to populate Next.js `metadataBase`. Defaults to `http://localhost:3000`. |


For production on the VPS, put the same vars into `AcornArranger/.env.production` next to the checked-out source. Next.js loads that file natively when `NODE_ENV=production`. The file is gitignored.

## Production deployment (Linode VPS, PM2)

Both processes run on one VPS under [PM2](https://pm2.keymetrics.io/) as the same OS user that owns the checkout. PM2 is installed globally on the host and is **not** a project dependency:

```bash
npm install pm2 -g
```

The repo-root `[ecosystem.config.js](ecosystem.config.js)` defines both apps:

- `acornarranger-web` — runs `npm start` from `AcornArranger/` on port `3000`.
- `acornarranger-scheduler` — runs `.venv/bin/uvicorn src.main:app` on `127.0.0.1:8001`.

The two apps are independent. The scheduler is optional (VRPTW only); a dead sidecar must not take the web app down — operators fall back to the legacy build engine until the sidecar is repaired. The scheduler binds to `127.0.0.1` so it is not reachable from the public internet; the Next.js server is the only intended client.

On the VPS you can drive both apps from the repo-root Makefile:

```bash
make pm2-start    # start both apps from ecosystem.config.js
make pm2-status   # list managed processes
make pm2-restart  # restart both
make pm2-reload   # zero-downtime reload of both
make pm2-logs     # follow logs for both
make pm2-stop     # stop both
make pm2-save     # persist the process list for boot-time resurrection
```

First-time deployment, end to end, on a fresh VPS:

```bash
# 1. Install PM2 once (global)
sudo npm install -g pm2

# 2. Check out the repo somewhere durable
git clone <repo-url>

# 3. Bootstrap and build both packages
make install
make build
$EDITOR AcornArranger/.env.production   # Supabase + SITE_URL etc.

# 4. Boot both apps under PM2
make pm2-start
make pm2-save                # persist the list
pm2 startup                  # one-time, prints a sudo command — run it
```

After `pm2 startup` is run once, PM2 reinstalls the saved process list on host reboot, so `make pm2-save` after future deploys is enough to make the new state survive reboots.

First-time deployment notes specific to the scheduler venv live in `[acornarranger-scheduler/README.md](acornarranger-scheduler/README.md#linode-deployment)`.

## Top-level commands

```
make install       install JS + Python deps for both packages
make dev           start scheduler + Next dev server locally
make stop          stop both local processes
make build         production build of the Next app
make status        show what's listening on :3000 and :8001
make health        curl both /health endpoints
make test          lint + typecheck + unit tests for the Next app
make pm2-*         manage both apps under PM2 on the VPS
```

The scheduler has its own [Makefile](acornarranger-scheduler/Makefile) for lower-level operations (`make -C acornarranger-scheduler dev`, `restart`, `logs`, etc).

## Further reading

- `[AcornArranger/README.md](AcornArranger/README.md)` — Next app architecture, scripts, and data layer.
- `[acornarranger-scheduler/README.md](acornarranger-scheduler/README.md)` — sidecar HTTP contract, operating notes, failure modes.
- `[docs/](docs/)` — product scope, UI plan, page structure (design-era notes).
- `[.taskmaster/docs/acornarranger-rebuild-prd.txt](.taskmaster/docs/acornarranger-rebuild-prd.txt)` — rebuild PRD.

