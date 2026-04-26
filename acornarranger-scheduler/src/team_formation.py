"""Stage A: heuristic team formation biased by lead<->member chemistry.

The legacy RPC forms teams internally; the spike cheated by pinning teams
from ground truth. Production has no ground truth at build time, so we
reinstate team formation here and bias it by historical pair-chemistry.

Algorithm (deterministic, greedy):

1. Filter available_staff to those with `can_clean`.
2. Pick leads in descending `can_lead_team` then ascending `priority`, breaking
   ties by `user_id` for reproducibility.
3. Determine the number of teams (k):
   - caller-provided `num_teams`, if set, wins. The lead cap is intentionally
     dropped here so operators can model days where leads-in-training are
     working but their `can_lead_team` flag has not been flipped yet.
   - else if caller provides `target_team_size`, derive k from
     `ceil(len(cleaners) / target_team_size)` (also bypasses the lead cap;
     same rationale).
   - else derive from total expected minutes vs cleaning_window, capped by the
     number of viable leads and by the available staff count (legacy parity).
4. Seed each team with its lead, in the same priority order. When k exceeds
   the number of `can_lead_team` staff (only possible on the override paths),
   promote the next-highest-priority cleaners to ad-hoc leads.
5. Pool the remaining members (non-lead staff). For each member, assign them to
   the team whose current chemistry-weighted score gains the most by adding
   them. Break ties by running-team-size (smallest first) so teams stay
   balanced, then by user_id.
6. Honor `target_team_size` as a soft ceiling: once a team reaches the target,
   it only accepts additional members if no other under-target team exists.

Chemistry score for a candidate (team, member) addition:

    team_score(team + [member]) - team_score(team)

which collapses to the sum of pair scores between the new member and every
current team member. Multiplied by `chemistry_weight` to produce a
minutes-denominated comparable delta (so callers could swap in a routing-side
comparison later if needed).

The heuristic is greedy by design: fast, debuggable, and a strict improvement
over random assignment. Option C (matheuristic candidate search) is out of
scope for v1.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from .affinity import PairingAffinityLookup
from .types import Appointment, Staff


@dataclass
class Team:
    team: int  # 1-based index
    lead_id: int
    member_ids: list[int] = field(default_factory=list)

    @property
    def staff_ids(self) -> list[int]:
        return [self.lead_id] + self.member_ids

    @property
    def size(self) -> int:
        return 1 + len(self.member_ids)


def _lead_sort_key(s: Staff) -> tuple[int, int, int]:
    # Sort by (lead capability desc, priority asc, user_id asc). lead=True ->
    # 0, lead=False -> 1 so True comes first under ascending sort.
    return (0 if s.can_lead_team else 1, s.priority if s.priority is not None else 9999, s.user_id)


def _member_sort_key(s: Staff) -> tuple[int, int]:
    return (s.priority if s.priority is not None else 9999, s.user_id)


def _derive_num_teams(
    appts: list[Appointment],
    staff: list[Staff],
    num_leads_available: int,
    cleaning_window_hours: float,
    target_staff_count: int | None,
    num_teams_override: int | None,
    target_team_size: int | None,
) -> int:
    # Explicit team-count override: trust the operator. Only the
    # cleaner-count cap applies; ad-hoc leads will be promoted downstream
    # if num_leads_available is too small.
    if num_teams_override is not None and num_teams_override > 0:
        return max(1, min(num_teams_override, len(staff)))

    # Operator-supplied desired team size: derive k from the cleaner pool.
    # Same lead-cap bypass rationale as `num_teams_override`.
    if target_team_size is not None and target_team_size > 0:
        derived = max(1, math.ceil(len(staff) / target_team_size))
        return max(1, min(derived, len(staff)))

    # Auto-derive (legacy parity). Total minutes of work to distribute.
    # Matches `get_total_time` in the legacy SQL RPC.
    total_mins = sum(
        int(a.estimated_cleaning_mins or 60) for a in appts
    )
    window_mins = max(cleaning_window_hours * 60.0, 60.0)
    staff_needed = max(1, math.ceil(total_mins / window_mins))
    if target_staff_count is not None:
        staff_needed = max(staff_needed, int(target_staff_count))

    return max(1, min(staff_needed, num_leads_available, len(staff)))


def form_teams(
    appts: list[Appointment],
    staff: list[Staff],
    pairing: PairingAffinityLookup,
    cleaning_window_hours: float,
    target_staff_count: int | None,
    num_teams_override: int | None,
    target_team_size: int | None,
    chemistry_weight: float,
) -> list[Team]:
    cleaners = [s for s in staff if s.can_clean]
    if not cleaners:
        return []

    real_leads = sorted(
        [s for s in cleaners if s.can_lead_team], key=_lead_sort_key
    )

    k = _derive_num_teams(
        appts=appts,
        staff=cleaners,
        num_leads_available=len(real_leads),
        cleaning_window_hours=cleaning_window_hours,
        target_staff_count=target_staff_count,
        num_teams_override=num_teams_override,
        target_team_size=target_team_size,
    )
    # Final cap is the cleaner pool. Lead-count is intentionally not a cap
    # here when an override pushed k past len(real_leads); ad-hoc leads
    # cover the gap.
    k = max(1, min(k, len(cleaners)))

    if len(real_leads) >= k:
        leads_for_teams: list[Staff] = real_leads[:k]
    else:
        # Promote ad-hoc leads from non-lead cleaners by priority order so
        # leads-in-training (who are typically the senior housekeepers) get
        # captain duty before the rest.
        non_leads = sorted(
            [s for s in cleaners if not s.can_lead_team],
            key=_member_sort_key,
        )
        leads_for_teams = real_leads + non_leads[: k - len(real_leads)]

    if not leads_for_teams:
        return []

    teams: list[Team] = []
    for idx, lead in enumerate(leads_for_teams):
        teams.append(Team(team=idx + 1, lead_id=lead.user_id))

    members_pool = sorted(
        [s for s in cleaners if s.user_id not in {t.lead_id for t in teams}],
        key=_member_sort_key,
    )

    effective_target = target_team_size
    if effective_target is None and k > 0:
        effective_target = max(1, math.ceil(len(cleaners) / k))

    for member in members_pool:
        # Prefer any team below the soft target before filling over-target teams.
        below = [t for t in teams if t.size < (effective_target or len(cleaners))]
        candidates = below if below else teams

        best_team = candidates[0]
        best_score = -math.inf
        for t in candidates:
            delta = chemistry_weight * sum(
                pairing.score(member.user_id, s) for s in t.staff_ids
            )
            # Tie-break by current team size (smaller wins) then team number.
            penalty_size = t.size * 1e-6
            score = delta - penalty_size
            if score > best_score:
                best_score = score
                best_team = t
        best_team.member_ids.append(member.user_id)

    return teams
