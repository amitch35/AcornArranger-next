"""Python port of build_schedule_plan.sql for spike comparison.

We can't run the real RPC against the production DB, and don't have a local DB
clone wired up. This port mirrors the algorithm closely enough to produce a
believable legacy baseline on the same fixture the OR-Tools solver consumes.

Faithful bits (vs build_schedule_plan.sql):
  - num_staff_needed = ceil((total_clean + total_travel) / (cleaning_window*60))
    where total_clean/travel come from the fixture appointments + travel_times
  - routing_type 1: Farthest-from-office -> Office. Within a team's pool we
    pick the farthest stop first, greedy nearest-neighbor to the office.
  - minutes_spent, earliest_checkout, latest_checkin accounting identical.
  - Team capacity = max_hours * 60. Stop adding when exceeded OR when
    earliest_checkout + minutes_spent >= latest_checkin.
  - Service time = ceil(cleaning_mins / team_size).
  - Greedy by team order: team 1 consumes farthest-from-office appointments
    first; leftovers pass to team 2.

Simplifications for the spike:
  - We take team_makeups from the fixture's ground_truth so both engines see
    identical team sizes/staff. This isolates routing quality.
  - pgr_TSPeuclidean is replaced with nearest-neighbor from the farthest seed.
    (pgr_TSPeuclidean is itself a 2-opt heuristic; NN is close enough for a
    day with <=10 stops per team.)
  - Double-unit linking is ignored (on 2026-04-15 only a handful of rows have
    double_unit and none of their partners are in the day's set).
  - No recursion on unscheduled appointments; compare.py reports drops.

Output shape matches solve.py so compare.py can ingest both.
"""

from __future__ import annotations

import json
import math
import pathlib
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


DAY_START_MIN = 10 * 60
DAY_END_MIN = 18 * 60


@dataclass
class Stop:
    appointment_id: int
    address_id: int
    property_id: int
    lat: float
    lon: float
    estimated_cleaning_mins: int
    departure_time: datetime
    next_arrival_time: datetime | None
    double_unit: list | None


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def haversine_minutes(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    minutes = (R * c / 56.0) * 60.0
    return max(1, int(round(minutes)))


def office_distance_min(stop: Stop, office_lat: float, office_lon: float, travel_times: dict) -> int:
    # Office isn't in rc_addresses - use Haversine.
    return haversine_minutes(stop.lat, stop.lon, office_lat, office_lon)


def pair_minutes(a: Stop, b: Stop, travel_times: dict) -> int:
    key = (a.address_id, b.address_id)
    if key in travel_times:
        return travel_times[key]
    return haversine_minutes(a.lat, a.lon, b.lat, b.lon)


def tsp_from_farthest(pool: list[Stop], office_lat: float, office_lon: float, travel_times: dict) -> list[Stop]:
    """routing_type=1: start at farthest-from-office, greedy NN toward office."""
    if not pool:
        return []
    # Pick farthest
    start = max(pool, key=lambda s: office_distance_min(s, office_lat, office_lon, travel_times))
    remaining = [s for s in pool if s.appointment_id != start.appointment_id]
    ordered = [start]
    current = start
    while remaining:
        # Prefer moving toward office: weighted by pair distance + remaining office dist from candidate.
        def key(candidate: Stop) -> int:
            return pair_minutes(current, candidate, travel_times)
        nxt = min(remaining, key=key)
        ordered.append(nxt)
        remaining.remove(nxt)
        current = nxt
    return ordered


def schedule_one_team(
    pool: list[Stop],
    team_size: int,
    plan_date_str: str,
    max_hours: float,
    office_lat: float,
    office_lon: float,
    travel_times: dict,
) -> list[int]:
    if not pool or team_size < 1:
        return []
    ordered = tsp_from_farthest(pool, office_lat, office_lon, travel_times)

    capacity = int(max_hours * 60)
    plan_date = datetime.fromisoformat(plan_date_str).date()

    first = ordered[0]
    minutes_spent = math.ceil(first.estimated_cleaning_mins / team_size)

    # earliest_checkout / latest_checkin (routing_type 1 starts at first stop)
    earliest_checkout = first.departure_time

    def default_end_ts(extra_min: int) -> datetime:
        four_pm = datetime.combine(plan_date, datetime.min.time(), tzinfo=timezone.utc).replace(hour=16)
        six_pm = datetime.combine(plan_date, datetime.min.time(), tzinfo=timezone.utc).replace(hour=18)
        return min(four_pm + timedelta(minutes=extra_min), six_pm)

    if first.next_arrival_time is None or first.next_arrival_time.date() > plan_date:
        latest_checkin = default_end_ts(minutes_spent)
    else:
        latest_checkin = first.next_arrival_time

    assigned = [first.appointment_id]

    for idx in range(1, len(ordered)):
        src = ordered[idx - 1]
        dst = ordered[idx]
        clean = math.ceil(dst.estimated_cleaning_mins / team_size)
        travel = pair_minutes(src, dst, travel_times)

        checkout = dst.departure_time
        checkin = dst.next_arrival_time
        if checkout < earliest_checkout:
            earliest_checkout = checkout

        if checkin is not None and checkin.date() == plan_date and checkin > latest_checkin:
            latest_checkin = checkin
        else:
            candidate = latest_checkin + timedelta(minutes=clean)
            six_pm = datetime.combine(plan_date, datetime.min.time(), tzinfo=timezone.utc).replace(hour=18)
            latest_checkin = max(latest_checkin, min(candidate, six_pm))

        minutes_spent += travel + clean

        if minutes_spent < capacity and (earliest_checkout + timedelta(minutes=minutes_spent)) < latest_checkin:
            assigned.append(dst.appointment_id)
        else:
            break

    return assigned


def solve(fixture_path: pathlib.Path) -> dict:
    fixture = json.loads(fixture_path.read_text())

    gt_appts: set[int] = set()
    for team in fixture["ground_truth"]:
        for ap in team["appointments"]:
            if ap.get("was_sent"):
                gt_appts.add(ap["appointment_id"])

    stops: list[Stop] = []
    for a in fixture["appointments"]:
        # Mirror solve.py: include stops that were cancelled only if they
        # were also in ground truth (cancelled AFTER approval).
        if a["app_status_id"] == 5 and a["appointment_id"] not in gt_appts:
            continue
        stops.append(Stop(
            appointment_id=a["appointment_id"],
            address_id=a["address_id"],
            property_id=a["property_id"],
            lat=a["lat"],
            lon=a["lon"],
            estimated_cleaning_mins=int(a["estimated_cleaning_mins"] or 60),
            departure_time=parse_ts(a["departure_time"]),
            next_arrival_time=parse_ts(a.get("next_arrival_time")),
            double_unit=a.get("double_unit"),
        ))

    # Team sizes from ground truth (same rule solve.py uses).
    gt_teams = [t for t in fixture["ground_truth"] if t["staff"]]
    team_sizes = [max(1, len(t["staff"])) for t in gt_teams]

    office = fixture["inputs"]["office_location"]
    office_lat = float(office["lat"])
    office_lon = float(office["lon"])

    travel_times = {
        (r["src_address_id"], r["dest_address_id"]): int(r["travel_time_minutes"])
        for r in fixture["travel_times"]
    }

    max_hours = float(fixture["inputs"].get("max_hours", 6.5))

    remaining = list(stops)
    teams_out: list[dict] = []
    total_travel = 0
    for team_idx, size in enumerate(team_sizes):
        team_num = gt_teams[team_idx]["team"]
        staff_ids = [m["staff_id"] for m in gt_teams[team_idx]["staff"]]
        if not remaining:
            teams_out.append({
                "team": team_num,
                "staff_ids": staff_ids,
                "appointment_ids": [],
                "travel_minutes": 0,
            })
            continue
        assigned_ids = schedule_one_team(
            remaining, size, fixture["plan_date"], max_hours,
            office_lat, office_lon, travel_times,
        )
        team_travel = 0
        id_to_stop = {s.appointment_id: s for s in remaining}
        for i in range(1, len(assigned_ids)):
            team_travel += pair_minutes(
                id_to_stop[assigned_ids[i - 1]],
                id_to_stop[assigned_ids[i]],
                travel_times,
            )
        total_travel += team_travel
        teams_out.append({
            "team": team_num,
            "staff_ids": staff_ids,
            "appointment_ids": assigned_ids,
            "travel_minutes": team_travel,
        })
        assigned_set = set(assigned_ids)
        remaining = [s for s in remaining if s.appointment_id not in assigned_set]

    dropped = [s.appointment_id for s in remaining]

    return {
        "plan_date": fixture["plan_date"],
        "engine": "legacy-proxy-python",
        "teams": teams_out,
        "dropped": dropped,
        "total_travel_minutes": total_travel,
    }


def main():
    if len(sys.argv) < 2:
        print("usage: python legacy.py <fixture.json>", file=sys.stderr)
        sys.exit(1)
    fixture_path = pathlib.Path(sys.argv[1]).resolve()
    plan = solve(fixture_path)
    out_path = fixture_path.with_suffix(".legacy.json")
    out_path.write_text(json.dumps(plan, indent=2))
    print(json.dumps(plan, indent=2))
    print(f"\nwrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
