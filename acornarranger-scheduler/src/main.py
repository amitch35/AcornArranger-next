"""FastAPI entrypoint for the Acorn Arranger scheduler sidecar.

Binds to 127.0.0.1:8001 when run via the provided systemd unit. The Next.js
API route is the only expected client; no auth is performed here because the
process is local-only (firewall + binding address enforce that).
"""

from __future__ import annotations

import logging
from fastapi import FastAPI, HTTPException

from .affinity import PairingAffinityLookup, PropertyAffinityLookup
from .midnight import scrub_midnight_times
from .solver import solve
from .team_formation import form_teams
from .types import SolveRequest, SolveResponse

logger = logging.getLogger("acorn.scheduler")

app = FastAPI(title="Acorn Arranger Scheduler", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
def solve_endpoint(req: SolveRequest) -> SolveResponse:
    problem = req.problem
    opts = req.solver_opts

    try:
        scrubbed_appts, midnight_ids = scrub_midnight_times(problem.appointments)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"midnight scrubbing failed: {e}") from e

    pairing = PairingAffinityLookup(req.pairing_affinity)
    prop = PropertyAffinityLookup(req.property_affinity)

    teams = form_teams(
        appts=scrubbed_appts,
        staff=problem.staff,
        pairing=pairing,
        cleaning_window_hours=problem.inputs.cleaning_window,
        target_staff_count=problem.inputs.target_staff_count,
        num_teams_override=opts.num_teams,
        target_team_size=opts.target_team_size,
        chemistry_weight=opts.chemistry_weight,
    )

    plan, diagnostics = solve(
        plan_date=problem.plan_date,
        appointments=scrubbed_appts,
        travel_times=problem.travel_times,
        office_lat=problem.inputs.office_location.lat,
        office_lon=problem.inputs.office_location.lon,
        teams=teams,
        property_affinity=prop,
        max_hours=problem.inputs.max_hours,
        opts=opts,
    )

    diagnostics.midnight_stops_scrubbed = midnight_ids
    if midnight_ids:
        diagnostics.notes.append(
            f"{len(midnight_ids)} appointment(s) had midnight timestamps discarded"
        )

    return SolveResponse(plan=plan, diagnostics=diagnostics)
