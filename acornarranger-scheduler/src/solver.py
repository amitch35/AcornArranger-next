"""Stage B: VRPTW routing over the teams produced by Stage A.

Grown from the April 2026 spike with production-grade changes:

- Teams are passed in from Stage A (team_formation.form_teams). Vehicles map
  1:1 to teams. Unlike the spike we do NOT pin teams from ground truth.
- Time windows use `effective_next_arrival` as delivered by the SQL payload.
  Double-unit tightening has already been applied upstream. The solver just
  trusts the window. Any midnight-sentinel values have been nulled out by
  `midnight.scrub_midnight_times` before reaching this function.
- Unused vehicles allowed: if a team's best-case load is low the solver can
  leave it empty without a forced-empty penalty. This avoids the "lone
  Liz padded stops" artifact the spike observed.
- Soft cost for staff<->property affinity: each stop pays a negative transit
  cost proportional to the max affinity of its team for that property. The
  solver sees it as a discount on arc cost into the stop, so it prefers
  routing a specialist team through their best properties.
- Drop penalty is preserved: eligibility is the caller's responsibility
  (all stops that survived get_build_problem_payload). We never silently drop.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .affinity import PropertyAffinityLookup
from .team_formation import Team
from .types import Appointment, SolveDiagnostics, SolverOptions, TravelTime

DAY_START_MIN = 10 * 60   # 10:00 earliest depart (office)
DAY_END_MIN = 18 * 60     # 18:00 hard cutoff
TURN_AROUND_END_MIN = 16 * 60
DROP_PENALTY_MIN = 10_000


@dataclass
class _Stop:
    appointment_id: int
    property_id: int
    address_id: int | None
    lat: float
    lon: float
    estimated_cleaning_mins: int
    # Per-stop arrival latest minute from day start (10:00). None means "any
    # time before DAY_END_MIN", with turn_around forcing TURN_AROUND_END_MIN.
    latest_arrival_min: int
    # Whether the stop has a turn_around flag independent of effective_next_arrival.
    is_turn_around: bool


def _haversine_minutes(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Rough minutes between two points; matches ~35 mph on mountain roads."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    km = r * c
    minutes = (km / 56.0) * 60.0
    return max(1, int(round(minutes)))


def _build_distance_matrix(
    stops: list[_Stop],
    office_lat: float,
    office_lon: float,
    travel_times: list[TravelTime],
) -> list[list[int]]:
    tt_map: dict[tuple[int, int], int] = {}
    for t in travel_times:
        tt_map[(t.src_address_id, t.dest_address_id)] = int(t.travel_time_minutes)

    n = len(stops)
    size = n + 1
    m = [[0] * size for _ in range(size)]
    for i in range(size):
        for j in range(size):
            if i == j:
                continue
            if i == 0:
                lat1, lon1, a1 = office_lat, office_lon, None
            else:
                lat1, lon1, a1 = stops[i - 1].lat, stops[i - 1].lon, stops[i - 1].address_id
            if j == 0:
                lat2, lon2, a2 = office_lat, office_lon, None
            else:
                lat2, lon2, a2 = stops[j - 1].lat, stops[j - 1].lon, stops[j - 1].address_id
            if a1 is not None and a2 is not None and (a1, a2) in tt_map:
                m[i][j] = tt_map[(a1, a2)]
            else:
                m[i][j] = _haversine_minutes(lat1, lon1, lat2, lon2)
    return m


def _latest_arrival_for(
    appt: Appointment,
    plan_date: str,
) -> tuple[int, bool]:
    """Translate effective_next_arrival into a minutes-from-day-start bound.

    Returns (latest_arrival_min, turn_around_implied). Both midnight-scrubbed
    values and same-day next-arrival values collapse to stricter windows. A
    next-day (or later) effective_next_arrival is treated as unconstrained
    (DAY_END_MIN). No value present -> use TURN_AROUND_END_MIN if turn_around
    flag is set, else DAY_END_MIN.
    """
    eff = appt.effective_next_arrival
    turn = bool(appt.turn_around)

    if eff is None:
        return (TURN_AROUND_END_MIN if turn else DAY_END_MIN, turn)

    if eff.date().isoformat() != plan_date:
        # Different day -> no tightening from this window; fall back to turn_around flag.
        return (TURN_AROUND_END_MIN if turn else DAY_END_MIN, turn)

    minutes = eff.hour * 60 + eff.minute
    # Clamp to the operating window so feasibility always has room.
    minutes = max(DAY_START_MIN, min(minutes, DAY_END_MIN))
    return (minutes, True)


def solve(
    *,
    plan_date: str,
    appointments: list[Appointment],
    travel_times: list[TravelTime],
    office_lat: float,
    office_lon: float,
    teams: list[Team],
    property_affinity: PropertyAffinityLookup,
    max_hours: float,
    opts: SolverOptions,
) -> tuple[dict, SolveDiagnostics]:
    """Return a ({teams: [...]}, diagnostics) tuple."""
    notes: list[str] = []

    if not teams:
        return (
            {"teams": []},
            SolveDiagnostics(
                plan_date=plan_date,
                num_stops=len(appointments),
                num_teams_requested=0,
                num_teams_used=0,
                dropped=[a.appointment_id for a in appointments],
                total_travel_minutes=0,
                objective=None,
                solver_status="NO_TEAMS",
                notes=["no teams available; cannot schedule"],
            ),
        )

    stops: list[_Stop] = []
    for a in appointments:
        latest, turn_implied = _latest_arrival_for(a, plan_date)
        stops.append(_Stop(
            appointment_id=a.appointment_id,
            property_id=a.property_id,
            address_id=a.address_id,
            lat=a.lat,
            lon=a.lon,
            estimated_cleaning_mins=int(a.estimated_cleaning_mins or 60),
            latest_arrival_min=latest,
            is_turn_around=turn_implied,
        ))

    n = len(stops)
    num_vehicles = len(teams)
    if n == 0:
        return (
            {"teams": [{"team": t.team, "staff_ids": t.staff_ids, "lead_id": t.lead_id,
                         "appointment_ids": [], "appointments": [], "travel_minutes": 0,
                         "service_minutes": 0} for t in teams]},
            SolveDiagnostics(
                plan_date=plan_date,
                num_stops=0,
                num_teams_requested=num_vehicles,
                num_teams_used=0,
                dropped=[],
                total_travel_minutes=0,
                objective=0,
                solver_status="NO_STOPS",
                notes=["no eligible appointments for this date"],
            ),
        )

    team_sizes = [max(1, t.size) for t in teams]
    travel_matrix = _build_distance_matrix(stops, office_lat, office_lon, travel_times)

    manager = pywrapcp.RoutingIndexManager(n + 1, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # Per-vehicle arc cost: travel minutes minus property-affinity reward on
    # entering the destination stop. The reward is `weight * team_max_score`.
    # Expressed as an int because OR-Tools uses integer costs. We scale by 100
    # so fractional scores still differentiate.
    aff_weight_scaled = int(round(opts.property_affinity_weight_minutes * 100))

    def make_arc_cost_cb(vehicle_idx: int) -> int:
        team_staff = teams[vehicle_idx].staff_ids

        def cb(from_index, to_index):
            i = manager.IndexToNode(from_index)
            j = manager.IndexToNode(to_index)
            base = travel_matrix[i][j] * 100  # scale base cost to match affinity scaling
            if j == 0:
                return base
            # Discount proportional to this team's best affinity for the stop.
            score = property_affinity.team_max(team_staff, stops[j - 1].property_id)
            discount = int(round(aff_weight_scaled * score))
            return max(0, base - discount)

        return routing.RegisterTransitCallback(cb)

    arc_cb_indices: list[int] = []
    for v in range(num_vehicles):
        arc_cb_indices.append(make_arc_cost_cb(v))
        routing.SetArcCostEvaluatorOfVehicle(arc_cb_indices[-1], v)

    # Time dimension uses a separate callback - service time divides by team size
    # (matches legacy). Transit = travel_time + service_time_at_origin so the
    # cumulative value at each node equals elapsed minutes since depot start.
    def make_time_cb(vehicle_idx: int, team_size: int) -> int:
        def cb(from_index, to_index):
            i = manager.IndexToNode(from_index)
            j = manager.IndexToNode(to_index)
            travel = travel_matrix[i][j]
            if i == 0:
                return travel
            service = math.ceil(stops[i - 1].estimated_cleaning_mins / team_size)
            return travel + service
        return routing.RegisterTransitCallback(cb)

    time_cb_indices = [make_time_cb(v, team_sizes[v]) for v in range(num_vehicles)]

    routing.AddDimensionWithVehicleTransits(
        time_cb_indices,
        60 * 12,                 # slack
        DAY_END_MIN,             # horizon
        False,                   # don't force start cumul to zero
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    # Per-vehicle capacity = max_hours * 60, applied as a cumul max at End.
    vehicle_capacity_min = int(max_hours * 60)
    for v in range(num_vehicles):
        end_idx = routing.End(v)
        time_dim.CumulVar(end_idx).SetMax(DAY_START_MIN + vehicle_capacity_min)
        start_idx = routing.Start(v)
        time_dim.CumulVar(start_idx).SetRange(DAY_START_MIN, DAY_START_MIN)

    for idx, s in enumerate(stops):
        node = idx + 1
        time_dim.CumulVar(manager.NodeToIndex(node)).SetRange(
            DAY_START_MIN, s.latest_arrival_min
        )

    for idx in range(n):
        node = idx + 1
        routing.AddDisjunction([manager.NodeToIndex(node)], DROP_PENALTY_MIN * 100)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(opts.time_limit_sec)
    params.log_search = False

    solution = routing.SolveWithParameters(params)
    if solution is None:
        return (
            {"teams": []},
            SolveDiagnostics(
                plan_date=plan_date,
                num_stops=n,
                num_teams_requested=num_vehicles,
                num_teams_used=0,
                dropped=[s.appointment_id for s in stops],
                total_travel_minutes=0,
                objective=None,
                solver_status="NO_SOLUTION",
                notes=["solver returned no feasible assignment; widen max_hours or add staff"],
            ),
        )

    teams_out: list[dict] = []
    assigned_nodes: set[int] = set()
    total_travel = 0
    teams_used = 0
    for vehicle_idx in range(num_vehicles):
        index = routing.Start(vehicle_idx)
        ordered_ids: list[int] = []
        ordered_appts: list[dict] = []
        team_travel = 0
        team_service = 0
        ord_counter = 1
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            team_travel += travel_matrix[node][manager.IndexToNode(next_index)]
            if node != 0:
                stop = stops[node - 1]
                assigned_nodes.add(node)
                ordered_ids.append(stop.appointment_id)
                ordered_appts.append({"appointment_id": stop.appointment_id, "ord": ord_counter})
                team_service += math.ceil(stop.estimated_cleaning_mins / team_sizes[vehicle_idx])
                ord_counter += 1
            index = next_index

        if ordered_ids:
            teams_used += 1

        t = teams[vehicle_idx]
        teams_out.append({
            "team": t.team,
            "lead_id": t.lead_id,
            "staff_ids": t.staff_ids,
            "appointment_ids": ordered_ids,
            "appointments": ordered_appts,
            "travel_minutes": team_travel,
            "service_minutes": team_service,
        })
        total_travel += team_travel

    dropped = [stops[i].appointment_id for i in range(n) if (i + 1) not in assigned_nodes]
    if dropped:
        notes.append(
            f"{len(dropped)} appointment(s) could not be assigned within max_hours; "
            "consider widening cleaning_window or adding staff"
        )

    # Decide whether to keep solver-empty teams in the committed plan.
    # When the operator explicitly sets `num_teams` or `target_team_size` the
    # team-shape is the goal (e.g. modelling trainees-as-leads), so we preserve
    # every formed team. Otherwise we drop empties to avoid the spike-era
    # "lone Liz padded stops" artifact and keep idle rows out of the DB.
    preserve_empty_teams = bool(
        (opts.num_teams is not None and opts.num_teams > 0)
        or (opts.target_team_size is not None and opts.target_team_size > 0)
    )
    if preserve_empty_teams:
        committed_teams = teams_out
        empty_count = sum(1 for t in teams_out if not t["appointment_ids"])
        if empty_count:
            notes.append(
                f"preserving {empty_count} empty team(s) because num_teams/target_team_size was set; "
                "drag stops onto them manually if needed"
            )
    else:
        committed_teams = [t for t in teams_out if t["appointment_ids"]]
        # Renumber to keep `team` sequential after any empty teams are dropped.
        for new_idx, t in enumerate(committed_teams, start=1):
            t["team"] = new_idx

    diagnostics = SolveDiagnostics(
        plan_date=plan_date,
        num_stops=n,
        num_teams_requested=num_vehicles,
        num_teams_used=teams_used,
        dropped=dropped,
        total_travel_minutes=total_travel,
        objective=int(solution.ObjectiveValue()),
        solver_status="OK",
        notes=notes,
    )
    return ({"teams": committed_teams, "plan_date": plan_date, "solved_at": datetime.now(timezone.utc).isoformat()}, diagnostics)
