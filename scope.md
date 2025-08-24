## AcornArranger — Next.js Rebuild Scope & Plan

This document defines the scope, tech choices, and an implementation checklist for rebuilding AcornArranger with Next.js, treating the legacy app as a reference only. The goal is functional parity with a cleaner architecture and a modern UI, not a 1:1 port.

### Vision & Principles
- Modern, maintainable Next.js app with server-first patterns where appropriate
- Functional equivalence over identical implementation; improved UX/UI
- Keep scheduling logic in database (RPC) and preserve existing Supabase project
- Desktop-first; mobile responsiveness is a nice-to-have
- Dev safety: never hit external services in development by default

### Non-Goals (for initial release)
- Full mobile polish
- Complex real-time collaboration in the plan builder
- Re-implementing scheduling algorithm outside the database

## Technologies
- Next.js (App Router) with TypeScript
- React, Server Components where beneficial; Client Components for interactive UI
- Styling: Tailwind CSS + shadcn/ui (Radix UI primitives)
- Forms & validation: React Hook Form + Zod
- Data & state:
  - Supabase (PostgreSQL, Auth, RPC, Realtime)
  - @supabase/ssr for server/client integration
  - TanStack Query for server-state; Zustand for ephemeral UI state (optional)
- Tooling: ESLint, Prettier, Biome (optional), commitlint (optional)
- Testing: Vitest + Testing Library; Playwright for E2E
- Observability: lightweight logging; optional Sentry (later)
- Hosting: Nginx on Linode; Node LTS with PM2 or systemd

## Environment & Security
- Use current Supabase project for production data
- Local Supabase for development via `supabase start`
- Configure new Supabase publishable/secret keys and asymmetric JWT signing
- Supabase MCP (when available) for better DX
- Dev guards to prevent external calls (Homebase, ResortCleaning)

## Domain Scope (feature parity targets)
- Authentication & RBAC
- Staff management
- Properties management
- Appointments (filters, pagination, unscheduled checks)
- Plans (view/build/copy/send)
- Roles & Services
- Integrations: Homebase (shift check), ResortCleaning (send plan)
- Error monitoring/notifications (via Supabase Realtime/Broadcast)

---

## Milestones & Acceptance Criteria

### M0 — Repository & Base App
- [ ] New Next.js app scaffolded and running locally
- [ ] Tailwind and shadcn/ui configured
- [ ] Base layout (sidebar + header) with placeholder routes

### M1 — Supabase Foundations
- [ ] Supabase clients (server/client) configured with @supabase/ssr
- [ ] Asymmetric JWT signing set and verified
- [ ] Local Supabase running with seeded minimal data
- [ ] Types generated from Supabase schema into `types/database.ts`

### M2 — Auth & Access Control
- [ ] Email/password auth working end-to-end
- [ ] Protected routes with middleware and session handling
- [ ] Basic role checks (admin vs staff)

### M3 — Core Entities CRUD
- [ ] Staff CRUD with list/table, create/edit forms
- [ ] Properties CRUD with list/table, create/edit forms
- [ ] Roles & Services CRUD
- [ ] Form validation with Zod and UX feedback (toasts)

### M4 — Appointments
- [ ] Appointments list with filters/pagination
- [ ] “Unscheduled” indicator + check endpoint
- [ ] Visibility-change check wired to notify when unscheduled > 0

### M5 — Plans
- [ ] Plans list and detail view
- [ ] Build plan via RPC (progress and error surfacing)
- [ ] Copy plan action
- [ ] Send plan action (production only; mocked in dev)

### M6 — Integrations & Safety
- [ ] Homebase shift check via adapter with dev stub
- [ ] ResortCleaning adapter with dev stub and production guard
- [ ] Feature flags/guards prevent accidental external calls in dev

### M7 — UX Polish & Theming
- [ ] Consistent typography, spacing, and color theme
- [ ] Accessible components (keyboard/focus states)
- [ ] Empty/error/loading states across views

### M8 — Tests & CI
- [ ] Unit and integration tests for API routes and hooks
- [ ] E2E smoke tests for critical flows (login → plans → build)
- [ ] CI pipeline (lint, typecheck, test)

### M9 — Deployment
- [ ] Production build scripts
- [ ] Nginx config for Next.js app on Linode
- [ ] PM2/systemd process config and docs

---

## Implementation Steps (Checklist)

### Phase 0 — Initialize Project
- [ ] Create Next.js app (App Router, TS)
- [ ] Add Tailwind CSS
- [ ] Initialize shadcn/ui, add core components (button, input, dialog, table)
- [ ] Commit hooks (lint-staged, prettier) [optional]

### Phase 1 — Supabase Setup
- [ ] Add `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Configure `lib/supabase/{client,server}.ts`
- [ ] Configure env files: `.env.local`, `.env.production`
- [ ] Enable asymmetric JWT signing; rotate keys
- [ ] `supabase init` + `supabase start` for local dev
- [ ] Generate types: `npx supabase gen types typescript --local > types/database.ts`

### Phase 2 — Project Architecture
- [ ] `app/` routes scaffold (landing, staff, properties, appointments, plans)
- [ ] `lib/` utilities: api client, auth helpers, dev guards, query client
- [ ] Global providers (theme, query provider, toasts)
- [ ] Base layout with sidebar/header

### Phase 3 — Auth & Middleware
- [ ] Auth UI with React Hook Form + Zod
- [ ] Session handling (server components + cookies)
- [ ] Middleware for protected routes
- [ ] Role helpers (isAdmin, hasRole)

### Phase 4 — CRUD Modules
- [ ] Staff pages (list, create, edit) with server actions or API routes
- [ ] Properties pages (list, create, edit)
- [ ] Roles & Services pages
- [ ] Shared table, form, and dialog primitives

### Phase 5 — Appointments
- [ ] Appointments list with filters and pagination
- [ ] Unscheduled check endpoint + client hook
- [ ] Visibility-change subscription to trigger check

### Phase 6 — Plans Module
- [ ] Plans list and detail page
- [ ] RPC integration for `build_schedule_plan` with progress UX
- [ ] Error surfacing from RPC (modal/toast + detail)
- [ ] Copy plan; Send plan (dev mocked, prod live)

### Phase 7 — Integrations
- [ ] Homebase adapter (configurable base URL, dev stub)
- [ ] ResortCleaning adapter (configurable base URL, dev stub)
- [ ] Guard rails: disallow external calls in dev unless explicitly enabled

### Phase 8 — Realtime & Notifications
- [ ] Supabase Realtime/Broadcast channel for error/alert events
- [ ] UI toasts/log panel for broadcasted errors

### Phase 9 — Testing & Quality
- [ ] Vitest + Testing Library unit/integration tests
- [ ] Playwright E2E smoke for critical paths
- [ ] Linting/type-check in CI

### Phase 10 — Deployment
- [ ] Build and runtime scripts
- [ ] Nginx config for Next.js (SSR + assets)
- [ ] PM2/systemd service; deploy docs and rollback steps

---

## Data & Migration Strategy
- Keep existing Supabase project for prod; use local Supabase for development
- Do not migrate scheduling algorithm to app; keep as RPC
- Preserve RLS policies and roles; document any changes
- Seed minimal dev data for staff/properties/appointments/plans

## Dev Safety & Feature Flags
- Add `NEXT_PUBLIC_ENV` and `APP_ENV` guards
- Centralize external calls behind adapters; no-op or stub in dev
- Visible banner when running in development mode

## Open Questions (to resolve)
- [ ] Any schema changes desired before we lock APIs?
- [ ] Minimal desktop screen size target?
- [ ] Which features of the old UI are must-keep vs can-change?
- [ ] Do we need import/export utilities (CSV) for any entity?

## Update Log
- v0.1: Initial scope and plan


