# Acorn Arranger Scheduler (sidecar)

VRPTW routing + Tier 2 affinity biasing, exposed over HTTP at
`127.0.0.1:8001`. Consumed by the Next.js app's
`/api/plans/build/[plan_date]` route when the user picks the `VRPTW`
engine from Build Options. Runs alongside the Next.js server on the
same Linode VPS (both managed by systemd; see the [root README](../README.md)).

The legacy `build_schedule_plan` Postgres RPC is never called from this
service; it remains the fallback whenever the Build Options toggle is set
to `Legacy RPC`. The Next web unit is deliberately not `Requires=`-coupled
to this sidecar, so outages here do not take the web app down — operators
switch back to `Legacy RPC` until the sidecar is restored.

Configuration is driven from the [Makefile](Makefile) and the systemd unit
(`HOST`, `PORT`, `LOG`); the Python code does not read environment
variables directly.

## Layout

```
acornarranger-scheduler/
  pyproject.toml
  src/
    main.py            # FastAPI app, POST /solve
    team_formation.py  # Stage A: heuristic teams biased by chemistry
    solver.py          # Stage B: OR-Tools VRPTW routing
    affinity.py        # property / pairing affinity lookups
    midnight.py        # scrub ResortCleaning 00:00 artifacts
    types.py           # pydantic Problem / Affinity / Solution
  systemd/
    acorn-scheduler.service
```

## HTTP contract

`POST /solve` with the following JSON body:

```json
{
  "problem": { ...output of public.get_build_problem_payload... },
  "property_affinity": [{ "staff_id": 1, "property_id": 2, "score": 0.83 }],
  "pairing_affinity":  [{ "staff_a_id": 1, "staff_b_id": 4, "score": 0.67 }],
  "solver_opts": {
    "time_limit_sec": 20,
    "property_affinity_weight_minutes": 5.0,
    "chemistry_weight": 3.0
  }
}
```

Response:

```json
{
  "plan": {
    "plan_date": "2026-04-20",
    "teams": [
      { "team": 1, "lead_id": 123, "staff_ids": [123, 456],
        "appointment_ids": [1001, 1002],
        "appointments": [{"appointment_id": 1001, "ord": 1}, ...],
        "travel_minutes": 42, "service_minutes": 210 }
    ]
  },
  "diagnostics": {
    "plan_date": "2026-04-20",
    "num_stops": 24,
    "num_teams_requested": 4,
    "num_teams_used": 3,
    "dropped": [],
    "total_travel_minutes": 128,
    "objective": 12800,
    "solver_status": "OK",
    "midnight_stops_scrubbed": [14512, 14561],
    "notes": ["2 appointment(s) had midnight timestamps discarded"]
  }
}
```

`GET /health` returns `{"status": "ok"}` for liveness checks.

## Local development

The `Makefile` wraps the most common workflows. Run `make` (or `make help`)
for the full list. Cheat sheet:

```bash
cd acornarranger-scheduler
make install       # one-time: create .venv and install package + dev deps
make dev           # foreground uvicorn with --reload (recommended)
make start         # detached uvicorn; logs at /tmp/acorn-scheduler.log
make restart       # restart the detached process
make stop          # kill whatever is bound to :8001
make status        # is anything listening on :8001?
make health        # curl http://127.0.0.1:8001/health
make logs          # tail the detached log
```

Override host, port, or log path via env vars:  
`make start PORT=8001 LOG=/tmp/scheduler-8001.log`.

Then POST a fixture at it:

```bash
curl -sS -X POST http://127.0.0.1:8001/solve \
  -H 'Content-Type: application/json' \
  -d @path/to/request.json | jq
```

A live request body can be captured from the Next.js route by logging the
payload it `fetch`es into `/solve` (see
`AcornArranger/app/api/plans/build/[plan_date]/route.ts`). The spike's
original fixtures were retired with the spike code;

## Linode deployment

1. Create the service account and directory:
  ```bash
    sudo useradd --system --home /opt/acornarranger-scheduler --shell /usr/sbin/nologin acorn
    sudo mkdir -p /opt/acornarranger-scheduler
    sudo chown acorn:acorn /opt/acornarranger-scheduler
  ```
2. Copy the source and install the venv as the `acorn` user:
  ```bash
    sudo -u acorn -H bash -c '
      cd /opt/acornarranger-scheduler &&
      python3.11 -m venv .venv &&
      .venv/bin/pip install --upgrade pip &&
      .venv/bin/pip install -e .
    '
  ```
3. Install the unit and start it:
  ```bash
    sudo cp systemd/acorn-scheduler.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now acorn-scheduler.service
    sudo systemctl status acorn-scheduler.service
  ```
4. Smoke test:
  ```bash
    curl -sS http://127.0.0.1:8001/health
  ```

Once running, the Makefile's systemd targets are convenient on the VPS:
`make systemd-status`, `make systemd-restart`, `make systemd-logs`.

The sidecar binds to `127.0.0.1` so it is unreachable from the public
internet; the Next.js server is the only intended client.

## Operating notes

- **Midnight timestamps.** ResortCleaning frequently sets
`arrival_time` / `departure_time` / `next_arrival_time` to 00:00 as a
data-entry fallback. `midnight.py` discards those values so the
solver falls back to the team-wide cleaning window. The scrubbed
appointment IDs are reported in `diagnostics.midnight_stops_scrubbed`.
- **Double-unit window tightening.** Already applied upstream by
`public.get_build_problem_payload`. The sidecar trusts
`effective_next_arrival` and never looks at `rc_properties.double_unit`.
- **Team formation.** Stage A forms teams greedily, biased by pair
chemistry. If the user consistently re-pairs staff post-build,
consider implementing the matheuristic candidate search documented in
the `## Future extensions` section of the architectural plan.
- **Unused vehicles.** The solver may leave a team with no stops. By
default those empty teams are dropped from the committed plan so we
don't write idle rows to `schedule_plans`. **Override:** when the
Build UI sets `num_teams` or `target_team_size`, every formed team is
preserved (lead + members are written with zero appointments) so the
operator can manually drag stops onto a trainee-led team. The
diagnostics note `preserving N empty team(s)` makes the override
visible.

## Failure modes


| Symptom                        | Likely cause                                           | Fix                                                     |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| `solver_status == NO_SOLUTION` | `max_hours` too low for the workload                   | widen `max_hours` or add more staff                     |
| `solver_status == NO_TEAMS`    | zero leads (`can_lead_team`) in `available_staff`      | choose staff with at least one lead                     |
| `dropped: [...]` non-empty     | feasible routing dropped stops to respect time windows | widen `cleaning_window`; the Build UI surfaces this too |
| 502 from the Next.js route     | sidecar not running on 127.0.0.1:8001                  | `sudo systemctl status acorn-scheduler.service`         |


