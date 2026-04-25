"""Acorn Arranger scheduler sidecar.

Implements Tier 1 (VRPTW routing) and Tier 2 (staff<->property affinity +
lead<->member chemistry) as a FastAPI service bound to 127.0.0.1:8001. The
Next.js app is the only client; all cross-table joins and domain rules
(double-unit window tightening, eligibility) live in Postgres RPCs.
"""

__version__ = "0.1.0"
