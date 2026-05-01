# `docs/`

Supplementary product and design notes for AcornArranger. For the live architecture, always prefer the code and the package READMEs:

- [`README.md`](../README.md) — monorepo quick start and production deploy.
- [`AcornArranger/README.md`](../AcornArranger/README.md) — Next.js app architecture.
- [`acornarranger-scheduler/README.md`](../acornarranger-scheduler/README.md) — Python VRPTW sidecar.
- [`.taskmaster/docs/acornarranger-rebuild-prd.txt`](../.taskmaster/docs/acornarranger-rebuild-prd.txt) — rebuild PRD.

## Current documents

None at the moment. This directory exists to hold living documents that supplement (not duplicate) the READMEs. Add one here whenever a topic outgrows a README section and is expected to stay current.

## Archive

[`archive/`](archive/) holds early design-era documents that shaped the rebuild. They are preserved for context and may not reflect the current implementation — in particular, none of them describe the Python VRPTW sidecar that was added later, and path references use `app/protected/` rather than the actual `app/(protected)/` route group.

- [`archive/scope.md`](archive/scope.md) — rebuild vision, tech choices, milestones, and phase checklists.
- [`archive/ui-plan.md`](archive/ui-plan.md) — wireframes and UX layout spec.
- [`archive/page-structure.md`](archive/page-structure.md) — App Router route matrix and navigation blueprint.

Treat anything in `archive/` as a historical snapshot. If you need to rely on a claim, verify it against the code or the package READMEs first.
