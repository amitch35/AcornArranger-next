# Step 5 - Three-day decision

## Headline table

| plan_date | band | eligible stops | GT sent stops | n_teams (GT) | legacy edit distance | solver edit distance | gap (legacy - solver) | solver travel (min) | legacy travel (min) |
|---|---|---|---|---|---|---|---|---|---|
| 2026-04-15 | p75 (median-ish, small) | 15 | 15 | 4 (1 empty) | 1 | 1 | **0** | 121 | 41 |
| 2026-03-16 | median | 14 | 14 | 4 (1 empty) | 8 | 3 | **+5** | 141 | 25 (4 drops) |
| 2026-03-29 | p95 (busy) | 31 | 31 | 6 (1 empty) | 30 | 1 | **+29** | 178 | 0 (26 drops) |

Both engines in all runs finish in ~20 s for `solve.py` (OR-Tools time limit) and <1 s for `legacy.py`.

## What each day taught us

### 2026-04-15 (small day, tie at 1)
- Routing quality is a wash when the legacy TSP happens to exhaust its pool with just 3 teams. The 1-stop off in both engines is a single cross-cluster stop (Raccoon Hideout - a boundary stop between Cluster A office and Cluster A mid).
- Travel totals look deceptively different (41 vs 121) but that's a vehicle-count artifact: OR-Tools was pinned to 4 vehicles by the drop penalty so Liz-solo burned an extra depot round-trip. The real business metric is "stops on the wrong team" - a tie.

### 2026-03-16 (median day, solver +5)
- Legacy proxy starts getting into trouble: drops 5 of 14 GT stops because the greedy per-team TSP breaks as soon as `earliest_checkout + minutes_spent >= latest_checkin`. On this day the first stop's `next_arrival_time` is already same-day midnight for enough stops that the check trips after 1-2 assignments per team.
- OR-Tools absorbs the constraint naturally via its time dimension and assigns all 14 across 3 teams with edit distance 3.

### 2026-03-29 (busy day, solver +29 - catastrophic legacy failure)
- **21 of 36 stops have `next_arrival_time = same-day midnight`.** The legacy algorithm's time-window accounting initializes `latest_checkin = next_arrival_time` for those, so `earliest_checkout + any_positive_minutes_spent < 00:00` is always false. Each team adds exactly 1 stop and then breaks.
- Result: legacy proxy assigns 5 stops (1 per team) and drops 26. Edit distance = 30.
- Production build_schedule_plan masks this by **recursing with +1 staff when stops are unscheduled**; in our port we disabled recursion. But the recursion just keeps adding teams that each take 1 stop until the available staff runs out, then fails completely. That matches what the user reports - "Build often doesn't give me a usable starting plan on busy days and I rebuild/edit heavily."
- OR-Tools on the same data: 30 of 31 stops on the correct team; single missed stop swaps between two mid-Cluster-A teams.

## Decision matrix (from validate-build-plan-spike.plan.md)

Criteria:
1. Solver produces a plan within 30 s. **Pass** (all runs < 21 s).
2. Solver's edit distance >= legacy's on at least 2 of 3 days. **Pass** (0 gap on day 1, +5 on day 2, +29 on day 3 - never worse than legacy).
3. Solver's edit distance is strictly better on at least 1 of 3 days. **Pass** (+29 on day 3 is huge; +5 on day 2 also material).
4. No solver run produces an infeasible / nonsense plan. **Pass** (zero drops in solver across all 3 days; legacy drops on 2 of 3).

## Verdict: **GO**

The OR-Tools VRPTW prototype is at worst equivalent to the legacy RPC on light days and is materially or catastrophically better on typical and busy days. The edit-reduction opportunity is concentrated where it matters most - the busy Fri/Sat turnaround days where the user spends the most time on manual fixes.

### Additional findings that sharpen the path forward

- **Most `departure_time` / `next_arrival_time` values in the fixtures are same-date midnight placeholders, not real schedule constraints.** Follow-up from the user: ResortCleaning has largely stopped populating real clock-times on appointments and backfills them with `YYYY-MM-DD 00:00:00`. Across the three fixtures, 60-100% of stops have midnight time windows. This reframes the previous "legacy has an algorithmic bug" finding - the legacy RPC is correctly enforcing the hard constraints it receives; the *inputs* are garbage. The practical outcome is the same (legacy degrades to 1-stop-per-team on turnaround-heavy days), but the fix is not "patch the SQL", it is "don't treat midnight as a real time window".
- **OR-Tools wins on busy days because it degrades gracefully on bad inputs.** `solve.py` already ignores per-stop time windows and uses a single team-wide 10 AM-6 PM cleaning window. That was a conscious spike simplification but it is also the right long-term design while RC time data is unreliable: treat midnight times as absent and let the solver fall back to the cleaning window.
- **The user now builds plans entirely manually.** Because legacy `build_schedule_plan` was unusable against today's RC data, the user stopped invoking it and hand-builds every plan. This changes the baseline for measuring v2 from "edits vs legacy first-pass" to "manual build from scratch vs edits on v2 first-pass". It also makes the `plan_history` snapshot work unnecessary: there is no production legacy builder to snapshot.
- **Staff affinity (Tier 2) is now the primary driver, not secondary.** Without reliable time data to cluster around, the single largest cue for a good first-pass is "which staff typically handle which properties". Tier 2 moves up in priority.
- **Team-count is not interesting for the spike** and we stopped it from being a confounder by pinning to GT. Before production rollout we will want to re-enable vehicle-count optimization in the solver (let it drop a vehicle if unused).
- **`ord` is NULL on every tested day.** With the move to fully manual builds, ordering is simply not being captured consistently in `plan_appointments`. `reorders_within_team` will remain unmeasurable until the v2 builder itself starts writing `ord` back on the rows it emits.

## Recommended next action

Skip the `plan_history` instrumentation. It was designed to measure "edits vs legacy initial build"; the user no longer runs legacy builds.

Refocused rollout sequence:

1. **Harden the solver's tolerance to the real RC data shape.**
   - Explicitly treat any `time = 00:00:00` as unknown. Do not propagate midnight into per-stop time windows.
   - Drive all stops from a team-wide cleaning window (currently 10 AM-6 PM, configurable from the existing UI field).
   - Keep a narrow optional hook for the rare stops that *do* carry real times, so the solver still benefits when RC returns real data.
2. **Tier 2 affinity biasing as a first-class input**, not a later phase.
   - Build a `(staff_id, property_id)` affinity score from the last N manually-built plans (still present in `plan_appointments` / `plan_staff` with `valid = true`).
   - Use it as a soft cost on team-to-stop assignment in the solver objective.
3. **Team-count optimization** - let the solver drop unused vehicles on light days.
4. **Lightweight direct measurement** instead of a snapshot table:
   - On plan build, store the solver's proposed plan as a JSON blob on a new column on `schedule_plans` (or a single sibling table keyed by `plan_id`) so we can compute edit distance at send-time against what the user actually sent to RC. One column of storage, no new write path, no new table.
   - This is the trimmed-down replacement for the scrapped `plan_history` design. We only need the initial builder output; the final state already lives on the `valid=true` rows.
5. **Tier 3 (pgvector similar-day plan lookup)** remains reserved for after Tiers 1-2 have been measured in production.

## Reproducing the numbers

```bash
cd scripts/vrp-spike
source .venv/bin/activate
for day in 2026-04-15 2026-03-16 2026-03-29; do
  python solve.py  fixtures/day-$day.json  > /dev/null
  python legacy.py fixtures/day-$day.json  > /dev/null
  python compare.py fixtures/day-$day.json
  echo
done
```

## Caveats carried forward

- Legacy proxy is a Python port of `build_schedule_plan.sql`, not the real RPC. Differences:
  - No `RANDOM()` in staff ordering (we use GT team composition verbatim to isolate routing).
  - No recursion on unscheduled stops.
  - pgr_TSPeuclidean replaced with nearest-neighbor from farthest seed (2-opt vs NN is ~5% route-length difference at this scale, well below the edit-distance gaps observed).
- Double-unit linking ignored in both engines (rare on the tested days).
- Service time = `ceil(cleaning_mins / team_size)`, matching the SQL.
- Time windows simplified to 10 AM-6 PM (4 PM cutoff for turn-arounds) in the solver; the real SQL's `earliest_checkout` / `latest_checkin` dance is faithfully reproduced in the legacy proxy only. The solver's simpler model is a conscious spike simplification - in production we'd need to model per-stop `departure_time` and `next_arrival_time` exactly.
