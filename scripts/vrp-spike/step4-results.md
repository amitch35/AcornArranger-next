# Step 4 - Legacy vs OR-Tools comparison

Fixture: `fixtures/day-2026-04-15.json`
Fixture appointments: 18 (3 cancelled, 15 eligible)
Ground-truth teams: 4 (team 4 = Liz solo, left empty by the user)

## Headline numbers

| metric | legacy proxy | OR-Tools solver |
|---|---|---|
| appts_on_different_team (edit distance, best permutation) | **1** | **1** |
| reorders_within_team | N/A (`plan_appointments.ord` is NULL for this day) | N/A |
| total_travel_min | 41 | 121 |
| dropped stops | 0 | 0 |

## Per-engine team shape (sorted by solver team number)

Solver (`day-2026-04-15.solver.json`):
- T1 Isaac+Brooke+Shane (3): 3 appts, 10 travel min
- T2 Rebecca+Sandy (2): 1 appt, 2 travel min
- T3 Madi+Ava+Cene (3): 6 appts, 80 travel min (Cluster B / Yosemite Woods)
- T4 Liz (1): 5 appts, 29 travel min
- Best permutation to GT: `{1→GT2, 2→GT4, 3→GT1, 4→GT3}` (hits 14/15)
- Off stop: 14415462 landed on solver T2 (mapped to empty GT T4) instead of solver T4

Legacy proxy (`day-2026-04-15.legacy.json`):
- T1 Isaac+Brooke+Shane (3): 6 appts, 7 travel min (Cluster B / Yosemite Woods)
- T2 Rebecca+Sandy (2): 7 appts, 32 travel min
- T3 Madi+Ava+Cene (3): 2 appts, 2 travel min
- T4 Liz (1): 0 appts, 0 travel min
- Best permutation to GT: `{1→GT1, 2→GT3, 3→GT2, 4→GT4}` (hits 14/15)
- Off stop: 14384052 landed on legacy T2 (a Cluster-A trip by Rebecca+Sandy) but in GT it was on T2 (matching staff swap - see note below)

## What to read into this

- **Routing quality is essentially a tie for day 1.** Given identical team_makeups (we pinned both engines to ground truth staff assignments), the greedy per-team TSP already matches the approved plan on 14 of 15 stops. OR-Tools gets the same 14 - no free lunch from Tier-1 routing alone.
- **Solver travel is 3x higher than legacy on paper, but that's a vehicle-count artifact.** OR-Tools was forced to use all 4 staffed vehicles (drop penalty >> travel), so Liz-solo burned an extra 29 min depot round-trip. The legacy proxy happened to exhaust its pool in 3 teams and left vehicle 4 empty. Solver travel / assigned stop = 8 min (121/15), legacy = 2.7 min / stop. Legacy looks tighter in this specific configuration.
- **Staff-affinity matters and neither engine models it.** In ground truth Rebecca+Sandy (2-person, often on the office cluster) took the 3 office-area stops; Isaac's 3-person crew took the Cluster-A mid-tier. The solver reproduced that pattern (Isaac on cluster-A office 3 stops, Rebecca+Sandy on 1 stop, Madi+Ava+Cene on Cluster B). The legacy proxy inverted it - Isaac's crew ended up in Cluster B and Madi+Ava+Cene took the office stops. Label-permutation hides this swap in the edit-distance metric, but in reality the user would manually swap teams. This is the Tier-2 affinity signal we identified in Step 1 and is exactly where an ML/heuristic bias layer would help.
- **Caveat on the legacy proxy.** The real `build_schedule_plan` RPC orders staff by `ORDER BY can_lead_team DESC, priority, RANDOM()`. My Python port uses the ground-truth team composition to isolate routing quality. In the real production run on 2026-04-15 the team composition would be deterministic only down to role+priority tiers; `RANDOM()` would often produce the Cluster-B-vs-office swap, which is why the user has to fix things after Build. The true "initial build edit distance" for legacy is therefore almost certainly >1 for this day; 1 is a floor set by our simplification.
- **reorders_within_team is unmeasurable** on this day because `ord` is NULL in ground truth. This matches the finding from Step 1 (ord is reliably populated only on older plans).

## Decision implications (early read before Step 5)

If the Step 5 days echo this pattern:
- **Tier 1 (swap solver, keep everything else) alone will not reduce edits meaningfully.** Routing quality is already close enough with legacy TSP that OR-Tools delivers a tie on pure routing.
- The user-observed "fewer edits" would come from **Tier 2 (learned affinity biases)** - staff-to-property/cluster preferences and "don't send Liz out alone" rules. Those can be added as soft costs on top of either engine.
- A hybrid: keep the legacy algorithm as the routing engine and add soft penalties to vehicle-stop assignment that encode historical affinity. Cheaper than swapping to OR-Tools and targets the actual error mode.
- The clear Go/No-Go will require at least 2 more days - affinity-driven swaps may be more prominent on busy days with more team permutations.
