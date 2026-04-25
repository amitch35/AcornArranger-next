"""Affinity lookup helpers for both Tier 2 signals.

- Property affinity feeds the routing-stage soft cost (team-max score per stop).
- Pair chemistry feeds the team-formation soft cost (sum of pair scores inside
  a candidate team).

Scores are expected to be in [0, 1]; the SQL RPCs normalize them that way.
"""

from __future__ import annotations

from .types import PairingAffinityEntry, PropertyAffinityEntry


class PropertyAffinityLookup:
    """O(1) lookup of (staff_id, property_id) -> score with team-max helper."""

    def __init__(self, entries: list[PropertyAffinityEntry]):
        self._map: dict[tuple[int, int], float] = {
            (e.staff_id, e.property_id): float(e.score) for e in entries
        }

    def score(self, staff_id: int, property_id: int) -> float:
        return self._map.get((staff_id, property_id), 0.0)

    def team_max(self, staff_ids: list[int], property_id: int) -> float:
        """Team specialist signal: best score among team members for this property."""
        if not staff_ids:
            return 0.0
        return max(self.score(s, property_id) for s in staff_ids)


class PairingAffinityLookup:
    """O(1) lookup of unordered (staff_a_id, staff_b_id) -> score.

    The SQL RPC returns one row per unordered pair with staff_a_id < staff_b_id.
    This class canonicalizes lookups so callers don't care about argument order.
    """

    def __init__(self, entries: list[PairingAffinityEntry]):
        self._map: dict[tuple[int, int], float] = {}
        for e in entries:
            a, b = sorted((e.staff_a_id, e.staff_b_id))
            self._map[(a, b)] = float(e.score)

    def score(self, staff_a: int, staff_b: int) -> float:
        if staff_a == staff_b:
            return 0.0
        a, b = sorted((staff_a, staff_b))
        return self._map.get((a, b), 0.0)

    def team_score(self, staff_ids: list[int]) -> float:
        """Sum of pair scores across all unordered pairs inside a candidate team."""
        n = len(staff_ids)
        if n < 2:
            return 0.0
        total = 0.0
        for i in range(n):
            for j in range(i + 1, n):
                total += self.score(staff_ids[i], staff_ids[j])
        return total
