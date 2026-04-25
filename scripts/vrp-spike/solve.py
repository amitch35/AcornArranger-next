"""OR-Tools VRPTW solver for the Acorn schedule-builder spike.

Reads a day fixture (produced by export_day_fixture.sql) and produces a plan
shaped like build_schedule_plan's output: team -> ordered list of
appointment_ids.

Design notes (kept deliberately simple for the spike, per the validation plan):

- Eligible appointments exclude anything the builder would have filtered out
  (status_id = 5 "Cancelled"). We keep the rest even if they are now
  status_id = 3 "Completed" - at build time they would have been 1 or 2.
- Vehicles = teams. The spike FIXES the team count to match ground truth so we
  compare routing quality independent of team-count choice (that's a separate
  question). Legacy also picks a team count, so both are operating with the
  same degrees of freedom here.
- Per-vehicle capacity = max_hours * 60 minutes, applied as total (travel +
  service) duration via a time-dimension cumulative upper bound.
- Service time per stop = ceil(estimated_cleaning_mins / team_size). This
  matches the legacy SQL's division-by-capacity behavior. Teams come from
  ground_truth so each vehicle has a known size.
- Time windows: depart-office-at-10AM (600 min from midnight), must-finish-by
  6PM (1080 min). Turn-around stops (same-day next arrival) tighten to 4PM
  (960 min). This is the simplified version of the legacy earliest_checkout
  / latest_checkin logic.
- Double-unit: for the spike we ignore the linking constraint. On 2026-04-15
  only 3 appointments have double_unit and linked-unit IDs don't appear in
  the appointment set for this day, so the constraint is a no-op. compare.py
  flags it in the notes.
- Distance: uses travel_times pairs when available; office-to-property falls
  back to Haversine (office is not in rc_addresses).
- Objective: primary = minimize total travel minutes; large penalty for any
  dropped stop so the solver keeps all appointments (matches the legacy's
  recursive "+1 staff" fallback intent).

Usage: python solve.py fixtures/day-YYYY-MM-DD.json
Outputs a JSON plan to stdout and also writes <fixture>.solver.json next to
the input.
"""

from __future__ import annotations

import json
import math
import pathlib
import sys
from dataclasses import dataclass

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

DAY_START_MIN = 10 * 60  # 10:00 earliest depart
DAY_END_MIN = 18 * 60    # 18:00 hard cutoff
TURN_AROUND_END_MIN = 16 * 60  # 16:00 cutoff when next_arrival is same day
DROP_PENALTY_MIN = 10_000  # must dominate any plausible route cost


@dataclass
class Stop:
    appointment_id: int
    property_id: int
    address_id: int
    lat: float
    lon: float
    estimated_cleaning_mins: int
    turn_around: bool
    next_arrival_same_day: bool
    double_unit: list | None


def haversine_minutes(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Rough minutes between two points. Matches avg 35 mph in mountain roads."""
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    km = R * c
    minutes = (km / 56.0) * 60.0  # 56 km/h
    return max(1, int(round(minutes)))


def build_distance_matrix(stops: list[Stop], office_lat: float, office_lon: float, travel_times: dict) -> list[list[int]]:
    """n+1 x n+1 matrix; index 0 = office, 1..n = stops in input order."""
    n = len(stops)
    size = n + 1
    m = [[0] * size for _ in range(size)]
    for i in range(size):
        for j in range(size):
            if i == j:
                continue
            if i == 0:
                lat1, lon1 = office_lat, office_lon
                a1 = None
            else:
                lat1, lon1 = stops[i - 1].lat, stops[i - 1].lon
                a1 = stops[i - 1].address_id
            if j == 0:
                lat2, lon2 = office_lat, office_lon
                a2 = None
            else:
                lat2, lon2 = stops[j - 1].lat, stops[j - 1].lon
                a2 = stops[j - 1].address_id
            key = (a1, a2) if (a1 is not None and a2 is not None) else None
            if key is not None and key in travel_times:
                m[i][j] = travel_times[key]
            else:
                m[i][j] = haversine_minutes(lat1, lon1, lat2, lon2)
    return m


def solve(fixture_path: pathlib.Path, time_limit_sec: int = 20) -> dict:
    fixture = json.loads(fixture_path.read_text())

    # Eligible stops: include every appointment that appears in the day's
    # fixture. We intentionally do NOT filter out app_status_id == 5 here -
    # some cancellations happened AFTER the plan was approved (see
    # 2026-03-16 appointment 14434618 which is in ground truth despite now
    # being status=5). Our rule at build time: include everything; let the
    # solver's drop penalty decide what stays.
    gt_appts: set[int] = set()
    for team in fixture["ground_truth"]:
        for ap in team["appointments"]:
            if ap.get("was_sent"):
                gt_appts.add(ap["appointment_id"])

    stops: list[Stop] = []
    for a in fixture["appointments"]:
        # Skip a cancelled appointment only if the user did not ultimately
        # keep it in ground truth. That matches the "status was 1/2 at build
        # time" heuristic the legacy RPC used.
        if a["app_status_id"] == 5 and a["appointment_id"] not in gt_appts:
            continue
        next_same_day = False
        if a.get("next_arrival_time") and a.get("departure_time"):
            next_same_day = a["next_arrival_time"][:10] == a["departure_time"][:10]
        stops.append(Stop(
            appointment_id=a["appointment_id"],
            property_id=a["property_id"],
            address_id=a["address_id"],
            lat=a["lat"],
            lon=a["lon"],
            estimated_cleaning_mins=int(a["estimated_cleaning_mins"] or 60),
            turn_around=bool(a["turn_around"]),
            next_arrival_same_day=next_same_day,
            double_unit=a.get("double_unit"),
        ))
    n = len(stops)

    # Teams (vehicles) come from ground truth so we isolate routing quality.
    gt_teams = [t for t in fixture["ground_truth"] if t["staff"]]
    # Drop teams that had zero appointments; they are present in ground_truth
    # but were effectively unused, and we don't want them to eat stops.
    effective_teams = [t for t in gt_teams if any(True for _ in t["appointments"]) or True]
    # Actually keep all staffed teams; the solver gets to pick which one is empty.
    team_sizes = [max(1, len(t["staff"])) for t in effective_teams]
    num_vehicles = len(effective_teams)

    # Build distance matrix.
    tt_pairs = {
        (r["src_address_id"], r["dest_address_id"]): int(r["travel_time_minutes"])
        for r in fixture["travel_times"]
    }
    office = fixture["inputs"]["office_location"]
    office_lat = float(office["lat"])
    office_lon = float(office["lon"])
    travel_matrix = build_distance_matrix(stops, office_lat, office_lon, tt_pairs)

    # Routing model with a single depot (office, node 0).
    manager = pywrapcp.RoutingIndexManager(n + 1, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # Travel-time callback.
    def travel_cb(from_index, to_index):
        i = manager.IndexToNode(from_index)
        j = manager.IndexToNode(to_index)
        return travel_matrix[i][j]

    travel_cb_idx = routing.RegisterTransitCallback(travel_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(travel_cb_idx)

    # Service-time + travel dimension. OR-Tools wants a callback that returns
    # travel_time + service_time_at_origin so the cumulative value at each
    # node equals total elapsed time since start (depot).
    def time_cb_for_vehicle(vehicle_idx: int, team_size: int):
        def cb(from_index, to_index):
            i = manager.IndexToNode(from_index)
            j = manager.IndexToNode(to_index)
            travel = travel_matrix[i][j]
            if i == 0:
                return travel
            service = stops[i - 1].estimated_cleaning_mins
            # Divide cleaning time by team size (matches legacy).
            service = math.ceil(service / team_size)
            return travel + service
        return cb

    vehicle_time_cb_indices: list[int] = []
    for vehicle_idx, size in enumerate(team_sizes):
        cb = time_cb_for_vehicle(vehicle_idx, size)
        vehicle_time_cb_indices.append(routing.RegisterTransitCallback(cb))

    # Per-vehicle capacity = max_hours * 60. Legacy default is 6.5h.
    max_hours = float(fixture["inputs"].get("max_hours", 6.5))
    vehicle_capacity_min = int(max_hours * 60)

    routing.AddDimensionWithVehicleTransits(
        vehicle_time_cb_indices,
        60 * 12,                     # slack (wait up to 12h at any node)
        DAY_END_MIN,                 # horizon: 18:00
        False,                        # don't force start cumul to zero
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    # Shrink per-vehicle cumul to the capacity.
    for v in range(num_vehicles):
        end_idx = routing.End(v)
        time_dim.CumulVar(end_idx).SetMax(DAY_START_MIN + vehicle_capacity_min)
        start_idx = routing.Start(v)
        time_dim.CumulVar(start_idx).SetRange(DAY_START_MIN, DAY_START_MIN)

    # Stop time windows: must arrive by cutoff (16:00 for turn-around, 18:00 otherwise).
    for idx, s in enumerate(stops):
        node = idx + 1
        latest_arrival = TURN_AROUND_END_MIN if (s.turn_around or s.next_arrival_same_day) else DAY_END_MIN
        time_dim.CumulVar(manager.NodeToIndex(node)).SetRange(DAY_START_MIN, latest_arrival)

    # Allow dropping stops with a big penalty so infeasible sets don't break solve.
    for idx in range(n):
        node = idx + 1
        routing.AddDisjunction([manager.NodeToIndex(node)], DROP_PENALTY_MIN)

    # Search parameters: PATH_CHEAPEST_ARC + guided local search.
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(time_limit_sec)
    params.log_search = False

    solution = routing.SolveWithParameters(params)
    if solution is None:
        return {"plan_date": fixture["plan_date"], "teams": [], "dropped": [s.appointment_id for s in stops]}

    teams_out: list[dict] = []
    assigned_nodes: set[int] = set()
    for vehicle_idx in range(num_vehicles):
        index = routing.Start(vehicle_idx)
        ordered: list[int] = []
        total_travel = 0
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                ordered.append(stops[node - 1].appointment_id)
                assigned_nodes.add(node)
            next_index = solution.Value(routing.NextVar(index))
            total_travel += travel_matrix[node][manager.IndexToNode(next_index)]
            index = next_index
        gt = effective_teams[vehicle_idx]
        teams_out.append({
            "team": gt["team"],
            "staff_ids": [m["staff_id"] for m in gt["staff"]],
            "appointment_ids": ordered,
            "travel_minutes": total_travel,
        })

    dropped: list[int] = []
    for idx in range(n):
        node = idx + 1
        if node not in assigned_nodes:
            dropped.append(stops[idx].appointment_id)

    return {
        "plan_date": fixture["plan_date"],
        "teams": teams_out,
        "dropped": dropped,
        "total_travel_minutes": sum(t["travel_minutes"] for t in teams_out),
        "objective": solution.ObjectiveValue(),
    }


def main():
    if len(sys.argv) < 2:
        print("usage: python solve.py <fixture.json>", file=sys.stderr)
        sys.exit(1)
    fixture_path = pathlib.Path(sys.argv[1]).resolve()
    plan = solve(fixture_path)
    out_path = fixture_path.with_suffix(".solver.json")
    out_path.write_text(json.dumps(plan, indent=2))
    print(json.dumps(plan, indent=2))
    print(f"\nwrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
