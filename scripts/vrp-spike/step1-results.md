# Step 1 — Data Density Results

Run date: 2026-04-18. Source: production Supabase via MCP `execute_sql`.

## Summary verdict

**All signals green. Proceed to Step 2.**

- Labeled-example volume: well above the 8k threshold.
- Solver size per day: small (max 62). OR-Tools VRPTW will run in seconds.
- Team counts per day: median 3, p95 6 — VRPTW sweet spot.
- Staff↔property affinity: strong signal (38.5% of pairs seen 5+ times, 42.9% matrix density).
- Estimate coverage: 89.4% — not the bottleneck.

**Tier 2 (affinity biasing) is viable.** Expect meaningful gains on top of Tier 1.

## 1.0 Corrected volume baseline

| metric | value |
| --- | --- |
| `days_with_sent_plan` | 608 |
| `distinct_day_appointment_pairs` | 9,536 |
| `earliest` | 2024-05-07 |
| `latest` | 2026-04-18 |

Initial uncorrected `count(*)` was 10,309 (per user-run); corrected number is 9,536. The delta of ~773 rows corresponds to rebuilt-and-re-sent appointments — roughly 8% of all sent rows. Rebuilds happen but aren't dominant.

## 1a. Appointments-per-day distribution

| metric | value |
| --- | --- |
| min | 1 |
| p25 | 9 |
| median | 14 |
| p75 | 20 |
| p95 | 34 |
| max | 62 |
| mean | 15.68 |

p95 = 34, max = 62. **Solver size is trivial** — OR-Tools will converge in well under a second per day at this scale.

## 1b. Team size and teams-per-day

Team size (one row per team-plan):

| team_size | n_plans |
| --- | --- |
| 0 | 11 |
| 1 | 438 |
| 2 | 519 |
| 3 | 813 |
| 4 | 176 |
| 5 | 6 |

Teams per day (one row per plan_date):

| metric | value |
| --- | --- |
| min_teams | 1 |
| median_teams | 3 |
| p95_teams | 6 |
| max_teams | 9 |
| mean_teams | 3.23 |
| days | 608 |

Note: 11 plans with `team_size = 0` exist — likely days where staff were all manually removed post-build. Skip these when picking representative days.

## 1c. Staff↔property affinity density

| metric | value |
| --- | --- |
| distinct_pairs | 4,267 |
| seen_once | 1,233 (28.9%) |
| seen_2_to_4 | 1,393 (32.6%) |
| seen_5_plus | **1,641 (38.5%)** |
| mean_pair_count | 6.00 |
| max_pair_count | 74 |

`seen_5_plus` is 38.5%, above the 30% threshold. **Strong affinity signal** — Tier 2 biasing will work well.

## 1d. Property / staff universe

| metric | value |
| --- | --- |
| distinct_properties_cleaned | 131 |
| distinct_staff_used | 76 |

Matrix size = 131 × 76 = 9,956. Observed pairs = 4,267. **Sparsity = 42.9%** — dense matrix, lookups will rarely return zero.

## 1e. Estimate coverage

| metric | value |
| --- | --- |
| with_estimate | 118 (89.4%) |
| without_estimate | 14 |
| total | 132 |

14 properties missing estimates. Good coverage, but calibration (Tier 0) still offers marginal gain.
