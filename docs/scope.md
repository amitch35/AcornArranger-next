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
- [ ] Base layout (sidebar + header) with placeholder routes - *Basic nav exists, needs AcornArranger-specific layout*

### M1 — Supabase Foundations
- [x] Supabase clients (server/client) configured with @supabase/ssr
- [x] Asymmetric JWT signing set and verified
- [ ] Local Supabase running with seeded minimal data
- [x] Types generated from Supabase schema into `supabase/types.ts`

### M2 — Auth & Access Control
- [ ] Email/password auth working end-to-end
- [x] Protected routes with middleware and session handling
- [ ] **Role-based access control**: `authenticated` vs `authorized_user` roles
- [ ] **Non-authorized user experience**: Landing page with activation info, profile access only
- [ ] **Authorized user experience**: Full dashboard and entity access

### M3 — Core Entities & UI Foundation
- [ ] Enhanced list views with modern filtering (status, dates, roles)
- [ ] **Properties management**: Comprehensive property list with ID, Name, Cleaning Time, Double Units, Status columns
- [ ] **Property detail pages**: Full property information including address details and scheduling options
- [ ] **Property editing**: Time picker for cleaning time and dependency selector for double units
- [ ] **Staff management**: Comprehensive staff list with ID, Name, Role, Status, Can Clean, Can Lead columns
- [ ] **Staff detail pages**: Full staff information including role capabilities and shift status
- [ ] Role settings interface for algorithm priority

### M4 — Appointments & Enhanced UX
- [ ] Appointments list with comprehensive filters and pagination
- [ ] **Accurate appointment columns**: ID, Service Time, Property, Staff, T/A, Next Arrival Time, Service, Status
- [ ] **T/A column**: Turn-around indicator with icon display
- [ ] **Time columns**: Service Time (primary) and Next Arrival Time (guest check-in deadline)
- [ ] "Unscheduled" indicator + check endpoint
- [ ] Real-time status updates and error indicators
- [ ] Consistent table layouts and bulk actions

### M5 — Schedule Builder (Core Feature)
- [ ] Daily plan management interface
- [ ] Staff selection with search and filtering
- [ ] Collapsible build algorithm options
- [ ] Plan editing with drag & drop assignment
- [ ] Build, copy, and send functionality

### M6 — Integrations & Safety
- [ ] Homebase shift check via adapter with dev stub
- [ ] ResortCleaning adapter with dev stub and production guard
- [ ] Feature flags/guards prevent accidental external calls in dev

### M7 — UX Polish & Theming
- [ ] Dark-first design (dark default, light optional via switcher)
- [ ] Consistent typography, spacing, and color theme
- [ ] Accessible components (keyboard/focus states)
- [ ] Empty/error/loading states across views
- [ ] Responsive design and mobile considerations

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
- [ ] `app/` routes scaffold (landing, profile, appointments, schedule, properties, staff, settings)
- [ ] `lib/` utilities: api client, auth helpers, dev guards, query client
- [ ] **Role-based access control implementation**: JWT claims handling, route protection
- [ ] Global providers (theme, query provider, toasts)
- [ ] Base layout with modern sidebar/header design

### Phase 3 — Auth & Middleware ✅ COMPLETED
- [x] Auth UI with React Hook Form + Zod
- [x] Session handling (server components + cookies)
- [x] Middleware for protected routes
- [ ] Role helpers (hasRole) - *Partially complete, needs role-based logic*

### Phase 3.5 — Role-Based Access Control
- [ ] **Role-based route protection**: Protect entity pages from non-authorized users
- [ ] **Role-based landing page**: Different content for authorized vs non-authorized users
- [ ] **Profile settings access**: Ensure all authenticated users can access profile
- [ ] **RLS policy integration**: Verify database-level access control works with app-level protection

### Phase 4 — Enhanced List Views & Filtering
- [ ] Modern table components with sorting and pagination
- [ ] Enhanced filtering system (status, dates, roles, services)
- [ ] **Properties management**: Comprehensive list with accurate columns (ID, Name, Cleaning Time, Double Units, Status, Actions)
- [ ] **Property filtering**: Status, city, cleaning time range, and search functionality
- [ ] **Property detail pages**: Full property information display with address details
- [ ] **Property editing**: Time picker for cleaning time and dependency selector for double units
- [ ] **Staff management**: Comprehensive list with accurate columns (ID, Name, Role, Status, Can Clean, Can Lead, Actions)
- [ ] **Staff filtering**: Status (Active/Inactive/Unverified), role, can clean, and search functionality
- [ ] **Staff detail pages**: Full staff information display with role capabilities and shift status
- [ ] Role settings interface for algorithm priority

### Phase 5 — Appointments & Real-time Features
- [ ] Appointments list with comprehensive filters and pagination
- [ ] **Accurate appointment table structure**: ID, Service Time, Property, Staff, T/A, Next Arrival Time, Service, Status
- [ ] **T/A column implementation**: Turn-around indicator with icon display
- [ ] **Time column accuracy**: Service Time (primary) and Next Arrival Time (guest check-in deadline)
- [ ] Unscheduled check endpoint + client hook
- [ ] Real-time status updates and error indicators
- [ ] Bulk actions and export functionality

### Phase 6 — Schedule Builder (Core Feature)
- [ ] Daily plan management interface
- [ ] Staff selection with search and filtering capabilities
- [ ] Collapsible build algorithm options section
- [ ] Plan editing with drag & drop for staff/appointment assignment
- [ ] Build, copy, and send functionality with progress indicators

### Phase 7 — Integrations & Safety
- [ ] Homebase adapter (configurable base URL, dev stub)
- [ ] ResortCleaning adapter (configurable base URL, dev stub)
- [ ] Guard rails: disallow external calls in dev unless explicitly enabled

### Phase 8 — Realtime & Notifications
- [ ] Supabase Realtime/Broadcast channel for error/alert events
- [ ] UI toasts/log panel for broadcasted errors
- [ ] Real-time updates for appointment status changes

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

## Dev Safety & Feature Flags
- Add `NEXT_PUBLIC_ENV` and `APP_ENV` guards
- Centralize external calls behind adapters; no-op or stub in dev
- Visible banner when running in development mode

## Open Questions (to resolve)
- [ ] Any schema changes desired before we lock APIs?
- [ ] Minimal desktop screen size target?
- [ ] Which features of the old UI are must-keep vs can-change?

## Update Log
- v0.1: Initial scope and plan
- v0.2: Initialized Next.js app in `AcornArranger/` via with-supabase template (renamed from `web/`)
- v0.3: Next.js development server successfully running on localhost:3000; M0 milestone partially complete
- v0.4: Supabase template analysis reveals massive head start - Phase 0 (100%), Phase 1 (100%), Phase 1.5 (100%), Phase 3 (75%) already complete; authentication system fully functional with protected routes, middleware, and user management
- v0.6: Refined UI architecture defined with modern layout, enhanced filtering, collapsible sections, and improved user experience; updated milestones to reflect schedule builder as core feature and read-only entity management
- v0.7: Task Master tasks refined to reflect read-only entity management (staff/properties), Schedule Builder as core feature with drag & drop, and enhanced filtering system; added Task 13 for foundational table components; removed Service Type filter from properties per user feedback
- v0.8: UI planning phase completed; comprehensive UI plan documented in ui-plan.md; all planning documents updated to reflect refined architecture and task structure; ready to begin implementation phase
- v0.9: Page structure and routing architecture documented in page-structure.md; complete planning documentation now available for development reference
- v0.10: Project documentation reorganized into `docs/` directory for better organization; added comprehensive README.md to explain document purposes and usage
- v0.11: **Appointment structure analysis completed**; updated planning documents to reflect accurate appointment columns (ID, Service Time, Property, Staff, T/A, Next Arrival Time, Service, Status); clarified importance of T/A column and Next Arrival Time for scheduling; corrected page size options and status filter options based on legacy implementation
- v0.12: **Corrected Next Arrival Time definition**; Next Arrival Time represents when next guests are checking in (appointment completion deadline), not when staff should arrive for next appointment; updated all planning documents to reflect this critical distinction for scheduling accuracy
- v0.13: **Updated access control architecture**; implemented two-tier role system with `authenticated` (new users awaiting activation) and `authorized_user` (activated users with full access); added profile settings page accessible to all authenticated users; updated access control matrix and navigation structure; added Phase 3.5 for role-based access control implementation
- v0.14: **Updated Properties Page UI design**; analyzed legacy property-view.ts and properties-view.ts to accurately reflect property structure; updated table columns to match legacy implementation (ID, Name, Cleaning Time, Double Units, Status, Actions); added comprehensive property detail modal with address information; enhanced filters to include city, cleaning time range, and search functionality
- v0.15: **Updated Staff Page UI design**; analyzed legacy staff-view.ts and staff.ts models to accurately reflect staff structure; updated table columns to match legacy implementation (Staff ID, Name, Role, Status, Can Clean, Can Lead, Actions); added comprehensive staff detail modal with role capabilities and shift information; enhanced filters to include status (Active/Inactive/Unverified), role, can clean, and search functionality
- v0.16: **Task alignment & DB hardening**; consolidated filtering/table foundation under Task 13 (removed duplicate Task 14); updated tasks to use existing DB columns (rc_appointments.next_arrival_time/turn_around, rc_properties.estimated_cleaning_mins/double_unit, rc_staff.status_id join); added Task 19 for database hardening (RLS policy on role_permissions, secure function search_path, upgrade pg_graphql, enable leaked password protection, add covering indexes); adjusted dependencies across tasks
- v0.17: **Template cleanup**; removed Next/Supabase template boilerplate (tutorial components, logos, deploy/env warning), simplified home page with auth redirect, cleaned protected layout/page, pruned unused images, and updated docs to reflect `AcornArranger/` top-level folder

---

## Planning Documents

- **`scope.md`** - This document: Project scope, milestones, and implementation phases
- **`ui-plan.md`** - Comprehensive UI design and component architecture
- **`page-structure.md`** - Complete page structure, routing, and navigation architecture
- **`.taskmaster/docs/acornarranger-rebuild-prd.txt`** - Product Requirements Document for Task Master AI

