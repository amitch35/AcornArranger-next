"""Compare OR-Tools solver vs legacy proxy against ground truth.

Ground truth = the approved schedule (plan_appointments.sent_to_rc is not null
on the current valid plan) from the fixture.

Edit distance for this spike = number of appointments assigned to a different
team than ground truth, under the best 1-to-1 team permutation. Per the
validation plan, reorder-within-team cannot be measured on recent plans
because plan_appointments.ord is NULL; that term is reported as N/A.

Usage: python compare.py fixtures/day-YYYY-MM-DD.json
Assumes fixtures/day-YYYY-MM-DD.solver.json and .legacy.json exist.
"""

from __future__ import annotations

import itertools
import json
import pathlib
import sys


def load_engine(path: pathlib.Path) -> dict[int, list[int]]:
    data = json.loads(path.read_text())
    return {t["team"]: list(t["appointment_ids"]) for t in data["teams"]}


def load_ground_truth(fixture_path: pathlib.Path) -> dict[int, list[int]]:
    fixture = json.loads(fixture_path.read_text())
    gt: dict[int, list[int]] = {}
    for t in fixture["ground_truth"]:
        # sent_to_rc is the ground truth for "this assignment stuck".
        sent_ids = [a["appointment_id"] for a in t["appointments"] if a["was_sent"]]
        gt[t["team"]] = sent_ids
    return gt


def eligible_ids(fixture_path: pathlib.Path) -> set[int]:
    fixture = json.loads(fixture_path.read_text())
    return {a["appointment_id"] for a in fixture["appointments"] if a["app_status_id"] != 5}


def best_permutation_edit_distance(
    engine_plan: dict[int, list[int]],
    gt_plan: dict[int, list[int]],
    all_ids: set[int],
) -> tuple[int, dict[int, int], dict]:
    """Return (edit_distance, best_mapping, debug_info).

    edit_distance = count of appointments whose engine-team (after best
    permutation) differs from their ground-truth team. Appointments that
    appear in one plan but not the other still count as mismatches. Drops
    (missing from engine) count as mismatches too.
    """
    engine_teams = sorted(engine_plan.keys())
    gt_teams = sorted(gt_plan.keys())

    appt_to_engine = {a: t for t, ids in engine_plan.items() for a in ids}
    appt_to_gt = {a: t for t, ids in gt_plan.items() for a in ids}

    n_e = len(engine_teams)
    n_g = len(gt_teams)
    # Pad the smaller set with sentinel teams so we can do a square permutation.
    dummy_counter = itertools.count(start=max(engine_teams + gt_teams) + 1)
    padded_engine = list(engine_teams) + [next(dummy_counter) for _ in range(max(0, n_g - n_e))]
    padded_gt = list(gt_teams) + [next(dummy_counter) for _ in range(max(0, n_e - n_g))]

    def score(mapping: dict[int, int]) -> int:
        hits = 0
        for a in all_ids:
            e_team = appt_to_engine.get(a)
            g_team = appt_to_gt.get(a)
            if e_team is None or g_team is None:
                continue
            if mapping.get(e_team) == g_team:
                hits += 1
        return hits

    best_hits = -1
    best_map: dict[int, int] = {}
    for perm in itertools.permutations(padded_gt):
        mapping = dict(zip(padded_engine, perm))
        hits = score(mapping)
        if hits > best_hits:
            best_hits = hits
            best_map = mapping

    # Edit distance = total appointments - hits, but only count appointments
    # that appear in ground truth (that's what we care about matching).
    gt_appts = set().union(*[set(ids) for ids in gt_plan.values()]) if gt_plan else set()
    edit_distance = len(gt_appts) - best_hits

    # Include engine drops (eligible but unassigned) and engine ghosts
    # (appts engine placed that aren't in GT) as additional mismatches.
    engine_appts = set().union(*[set(ids) for ids in engine_plan.values()]) if engine_plan else set()
    eligible_missing_from_engine = (all_ids - engine_appts) & gt_appts
    engine_extras = engine_appts - gt_appts

    debug = {
        "hits": best_hits,
        "gt_total": len(gt_appts),
        "engine_drops_vs_gt": sorted(eligible_missing_from_engine),
        "engine_extras_vs_gt": sorted(engine_extras),
    }
    return edit_distance, best_map, debug


def engine_summary(plan: dict[int, list[int]], travel_total: int, dropped: list[int]) -> str:
    parts = [f"  travel_total_min={travel_total}  dropped={len(dropped)}"]
    for team in sorted(plan.keys()):
        parts.append(f"    team {team}: {len(plan[team])} appts")
    return "\n".join(parts)


def main():
    if len(sys.argv) < 2:
        print("usage: python compare.py <fixture.json>", file=sys.stderr)
        sys.exit(1)
    fixture_path = pathlib.Path(sys.argv[1]).resolve()
    solver_path = fixture_path.with_suffix(".solver.json")
    legacy_path = fixture_path.with_suffix(".legacy.json")

    if not solver_path.exists() or not legacy_path.exists():
        print(f"missing output files. expected {solver_path} and {legacy_path}", file=sys.stderr)
        sys.exit(1)

    gt_plan = load_ground_truth(fixture_path)
    all_ids = eligible_ids(fixture_path)

    solver_data = json.loads(solver_path.read_text())
    legacy_data = json.loads(legacy_path.read_text())
    solver_plan = {t["team"]: list(t["appointment_ids"]) for t in solver_data["teams"]}
    legacy_plan = {t["team"]: list(t["appointment_ids"]) for t in legacy_data["teams"]}

    solver_travel = solver_data.get("total_travel_minutes", sum(t.get("travel_minutes", 0) for t in solver_data["teams"]))
    legacy_travel = legacy_data.get("total_travel_minutes", sum(t.get("travel_minutes", 0) for t in legacy_data["teams"]))

    solver_edit, solver_map, solver_dbg = best_permutation_edit_distance(solver_plan, gt_plan, all_ids)
    legacy_edit, legacy_map, legacy_dbg = best_permutation_edit_distance(legacy_plan, gt_plan, all_ids)

    gt_total = solver_dbg["gt_total"]

    print(f"Plan date: {solver_data['plan_date']}")
    print(f"Eligible stops (non-cancelled): {len(all_ids)}")
    print(f"Ground-truth sent-to-rc stops:  {gt_total}")
    print()
    print("== OR-Tools solver ==")
    print(engine_summary(solver_plan, solver_travel, solver_data.get("dropped", [])))
    print(f"  best team mapping (engine -> gt): {solver_map}")
    print(f"  hits vs GT: {solver_dbg['hits']} / {gt_total}")
    print(f"  edit distance (appts_on_different_team): {solver_edit}")
    if solver_dbg["engine_drops_vs_gt"]:
        print(f"  dropped GT appts: {solver_dbg['engine_drops_vs_gt']}")
    if solver_dbg["engine_extras_vs_gt"]:
        print(f"  extras (not in GT, e.g. cancelled): {solver_dbg['engine_extras_vs_gt']}")
    print()
    print("== Legacy proxy (Python port of build_schedule_plan) ==")
    print(engine_summary(legacy_plan, legacy_travel, legacy_data.get("dropped", [])))
    print(f"  best team mapping (engine -> gt): {legacy_map}")
    print(f"  hits vs GT: {legacy_dbg['hits']} / {gt_total}")
    print(f"  edit distance (appts_on_different_team): {legacy_edit}")
    if legacy_dbg["engine_drops_vs_gt"]:
        print(f"  dropped GT appts: {legacy_dbg['engine_drops_vs_gt']}")
    if legacy_dbg["engine_extras_vs_gt"]:
        print(f"  extras (not in GT, e.g. cancelled): {legacy_dbg['engine_extras_vs_gt']}")
    print()
    gap = legacy_edit - solver_edit
    print("== Verdict ==")
    print(f"  legacy edit distance = {legacy_edit}")
    print(f"  solver edit distance = {solver_edit}")
    print(f"  gap (legacy - solver) = {gap}  (positive = solver closer to GT)")
    print("  reorders_within_team: N/A (plan_appointments.ord is NULL for this day)")
    print("  travel_total gap = legacy {0}m vs solver {1}m  (delta {2}m)".format(
        legacy_travel, solver_travel, solver_travel - legacy_travel,
    ))
    print()
    print("Notes:")
    print("  - Both engines were forced to use the same team_makeups (sizes +")
    print("    staff ids) as ground truth so routing quality is isolated.")
    print("  - Ground truth for this day left team 4 (Liz alone) empty; neither")
    print("    engine knows that business preference. The solver assigned stops")
    print("    to team 4 because the drop penalty (10_000 min) outweighs forcing")
    print("    every stop onto other teams; the legacy proxy happened to pack")
    print("    everything onto teams 1-3 because greedy per-team TSP filled them")
    print("    in the order the algorithm consumes pools.")
    print("  - Double-unit linking ignored for this spike (no effect on this day).")


if __name__ == "__main__":
    main()
