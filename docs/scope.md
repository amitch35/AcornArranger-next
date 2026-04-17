## AcornArranger — Next.js Rebuild Scope & Plan

This document defines the scope, tech choices, and an implementation checklist for rebuilding AcornArranger with Next.js, treating the legacy app as a reference only. The goal is functional parity with a cleaner architecture and a modern UI, not a 1:1 port.

### Vision & Principles
- Modern, maintainable Next.js app with server-first patterns where appropriate
- Functional equivalence over identical implementation; improved UX/UI
- Keep scheduling logic in database (RPC) and preserve existing Supabase project
- Desktop-first; mobile responsiveness is a nice-to-have
- External integrations: use local Supabase and non-production credentials; wire outbound calls only in Supabase (secrets, edge functions), not via unused Next.js env toggles

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
- Control external calls (Homebase, ResortCleaning) through Supabase configuration and environment, not duplicate flags in the Next.js app

## Domain Scope (feature parity targets)
- **Authentication & Role-Based Access Control**: Two-tier system with `authenticated` (new users) and `authorized_user` (activated users) roles
- **Non-authorized user experience**: Landing page with activation info, profile settings access only
- **Authorized user experience**: Full access to all main entities and functionality
- Staff management (read-only, synced from ResortCleaning/Homebase)
- Properties management (read-only, can edit cleaning times and dependencies)
- **Appointments**: Comprehensive list with accurate columns (ID, Service Time, Property, Staff, T/A, Next Arrival Time, Service, Status), filters, pagination, unscheduled checks; Next Arrival Time represents guest check-in deadline
- Plans (daily team assignments, view/build/copy/send)
- Roles & Services (read-only, synced from external systems)
- Integrations: Homebase (shift check), ResortCleaning (send plan)
- Error monitoring/notifications (via Supabase Realtime/Broadcast)

---

## Refined UI Architecture

### Layout Structure
- **Header**: Sidebar toggle, logo/brand, breadcrumbs, profile dropdown
- **Sidebar**: Collapsible navigation with icons + labels, active page highlighting
- **Main Content**: Responsive content area with consistent spacing and typography

### Page Structure
```
app/
├── page.tsx (dashboard - overview, quick actions)
├── appointments/ (list with enhanced filters)
├── schedule/ (daily plan builder - core feature)
├── properties/ (read-only list, inline editing for cleaning times)
├── staff/ (read-only list with shift information)
└── settings/roles/ (role configuration for algorithm priority)
```

### Key UI Improvements
- **Enhanced Filtering**: Status, date ranges, service types, role-based filters
- **Collapsible Sections**: Build algorithm options hidden by default
- **Time Picker**: Hour/minute selector for property cleaning times
- **Property Dependencies**: Visual selector instead of ID typing
- **Drag & Drop**: Staff/appointment assignment in daily plans
- **Real-time Indicators**: Error counts, unscheduled appointments, shift conflicts

---

## Milestones & Acceptance Criteria

### M0 — Repository & Base App
- [x] New Next.js app scaffolded and running locally (in `AcornArranger/`)
- [x] Tailwind and shadcn/ui configured
- [x] Base layout (sidebar + header) with placeholder routes - *Basic nav exists, needs AcornArranger-specific layout*

### M1 — Supabase Foundations
- [x] Supabase clients (server/client) configured with @supabase/ssr
- [x] Asymmetric JWT signing set and verified
- [x] Local Supabase running with seeded minimal data
- [x] Types generated from Supabase schema into `supabase/types.ts`

### M2 — Auth & Access Control
- [x] Email/password auth working end-to-end
- [x] Protected routes with middleware and session handling
- [x] **Role-based access control**: `authenticated` vs `authorized_user` roles
- [x] **Non-authorized user experience**: Landing page with activation info, profile access only
- [ ] **Authorized user experience**: Full dashboard and entity access

### M3 — Core Entities & UI Foundation
- [x] Enhanced list views with modern filtering (status, dates, roles)
- [x] **Properties management**: Comprehensive property list with ID, Name, Cleaning Time, Double Units, Status columns
- [x] **Property detail pages**: Full property information including address details and scheduling options
- [x] **Property editing**: Time picker for cleaning time and dependency selector for double units
- [x] **Staff management**: Comprehensive staff list with ID, Name, Role, Status, Can Clean, Can Lead columns
- [x] **Staff detail pages**: Full staff information including role capabilities and shift status
- [x] Role settings interface for algorithm priority

### M4 — Appointments & Enhanced UX
- [x] Appointments list with comprehensive filters and pagination
- [x] **Accurate appointment columns**: ID, Service Time, Property, Staff, T/A, Next Arrival Time, Service, Status
- [x] **T/A column**: Turn-around indicator with icon display
- [x] **Time columns**: Service Time (primary) and Next Arrival Time (guest check-in deadline)
- [x] "Unscheduled" indicator + check endpoint
- [x] Real-time status updates and error indicators
- [x] Consistent table layouts and bulk actions

### M5 — Schedule Builder (Core Feature)
- [x] Daily plan management interface
- [x] Staff selection with search and filtering
- [x] Collapsible build algorithm options
- [x] Plan editing with drag & drop assignment
- [x] Build, copy, and send functionality

### M6 — Integrations & Safety
- [x] Homebase shift check via adapter

### M7 — UX Polish & Theming
- [x] Dark-first design
- [x] Consistent typography, spacing, and color theme
- [x] Accessible components (keyboard/focus states)
- [x] Empty/error/loading states across views
- [x] Responsive design and mobile considerations

### M8 — Tests & CI
- [ ] Unit and integration tests for API routes and hooks
- [ ] E2E smoke tests for critical flows (login → schedule → build)
- [ ] CI pipeline (lint, typecheck, test)

### M9 — Deployment
- [ ] Production build scripts
- [ ] Nginx config for Next.js app on Linode
- [ ] PM2/systemd process config and docs

---

## Implementation Steps (Checklist)

### Phase 0 — Initialize Project
- [x] Create Next.js app (App Router, TS) in `AcornArranger/`
- [x] Add Tailwind CSS
- [x] Initialize shadcn/ui, add core components (button, input, dialog, table)
- [ ] Commit hooks (lint-staged, prettier) [optional]

### Phase 1 — Supabase Setup ✅ COMPLETED
- [x] Add `@supabase/supabase-js` and `@supabase/ssr`
- [x] Configure `lib/supabase/{client,server}.ts`
- [x] Configure env files: `.env.local`, `.env.production`
- [x] Enable asymmetric JWT signing; rotate keys
- [x] `supabase init` + `supabase start` for local dev
- [x] Generate types: `npx supabase gen types typescript --local > types/database.ts`

### Phase 1.5 — Authentication System ✅ COMPLETED
- [x] Complete Supabase Auth integration
- [x] Login, signup, password reset, and confirmation flows
- [x] Protected route middleware with session handling
- [x] User profile management and session persistence
- [x] Error handling and validation for auth forms

### Phase 2 — Project Architecture & Layout
- [x] `app/` routes scaffold (landing, profile, appointments, schedule, properties, staff, settings)
- [x] `lib/` utilities: api client, auth helpers, query client
- [x] **Role-based access control implementation**: JWT claims handling, route protection
- [x] Global providers (theme, query provider, toasts)
- [x] Base layout with modern sidebar/header design

### Phase 3 — Auth & Middleware ✅ COMPLETED
- [x] Auth UI with React Hook Form + Zod
- [x] Session handling (server components + cookies)
- [x] Middleware for protected routes
- [ ] Role helpers (hasRole) - *Partially complete, needs role-based logic*

### Phase 3.5 — Role-Based Access Control
- [x] **Role-based route protection**: Protect entity pages from non-authorized users
- [x] **Role-based landing page**: Different content for authorized vs non-authorized users
- [x] **Profile settings access**: Ensure all authenticated users can access profile
- [x] **RLS policy integration**: Verify database-level access control works with app-level protection

### Phase 4 — Enhanced List Views & Filtering
- [x] Modern table components with sorting and pagination
- [x] Enhanced filtering system (status, dates, roles, services)
- [x] **Properties management**: Comprehensive list with accurate columns (ID, Name, Cleaning Time, Double Units, Status, Actions)
- [x] **Property filtering**: Status, city, cleaning time range, and search functionality
- [x] **Property detail pages**: Full property information display with address details
- [x] **Property editing**: Time picker for cleaning time and dependency selector for double units
- [x] **Staff management**: Comprehensive list with accurate columns (ID, Name, Role, Status, Can Clean, Can Lead, Actions)
- [x] **Staff filtering**: Status (Active/Inactive/Unverified), role, can clean, and search functionality
- [x] **Staff detail pages**: Full staff information display with role capabilities and shift status
- [x] Role settings interface for algorithm priority

### Phase 5 — Appointments & Real-time Features
- [x] Appointments list with comprehensive filters and pagination
- [x] **Accurate appointment table structure**: ID, Service Time, Property, Staff, T/A, Next Arrival Time, Service, Status
- [x] **T/A column implementation**: Turn-around indicator with icon display
- [x] **Time column accuracy**: Service Time (primary) and Next Arrival Time (guest check-in deadline)
- [x] Unscheduled check endpoint + client hook
- [x] Real-time status updates and error indicators

### Phase 6 — Schedule Builder (Core Feature)
- [x] Daily plan management interface
- [x] Staff selection with search and filtering capabilities
- [x] Collapsible build algorithm options section
- [x] Plan editing with drag & drop for staff/appointment assignment
- [x] Build, copy, and send functionality with progress indicators

### Phase 7 — Integrations & Safety

### Phase 8 — Realtime & Notifications
- [ ] Supabase Realtime/Broadcast channel for error/alert events
- [x] UI toasts/log panel for broadcasted errors

### Phase 9 — Testing & Quality
- [ ] Vitest + Testing Library unit/integration tests
- [ ] Playwright E2E smoke for critical paths (login → schedule → build)
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

## Integrations & dev environments
- Prefer Supabase (edge functions, secrets) for outbound calls; keep adapters thin in Next.js where needed
- Use local Supabase and non-production keys for development; disabled integrations live in Supabase config, not unused Next.js env toggles


---

## Planning Documents

- **`scope.md`** - This document: Project scope, milestones, and implementation phases
- **`ui-plan.md`** - Comprehensive UI design and component architecture
- **`page-structure.md`** - Complete page structure, routing, and navigation architecture
- **`.taskmaster/docs/acornarranger-rebuild-prd.txt`** - Product Requirements Document for Task Master AI

