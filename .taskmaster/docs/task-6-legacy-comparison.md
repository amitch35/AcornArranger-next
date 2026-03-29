# Task 6 vs Legacy Plans View: Functional Comparison

This document surfaces functional differences between **Task 6** (Schedule Builder) and the **legacy plans-view.ts** implementation, and checks alignment with **properties page** patterns in the Next app.

---

## 1. Legacy Plans View: What It Actually Does

### 1.1 Core Flow
- **Single date** selection (`from_plan_date`)
- **Parameters**: Schedule date + Available Staff (modal)
- **Options**: Services (checkboxes), Omissions (modal), Routing Type, Cleaning Window, Max Hours, Target Staff Count
- **Actions**: Build, Copy, Send, Add Plan
- **Display**: Paginated list of plan cards (10/20/50 per page)

### 1.2 Legacy API Surface
| Action | Endpoint | Method | Notes |
|--------|----------|--------|-------|
| Build | `/api/plans/build/{plan_date}` | POST | Body: `PlanBuildOptions` (available_staff, services, omissions, routing_type, cleaning_window, max_hours, target_staff_count) |
| Copy | `/api/plans/copy/{plan_date}` | POST | No body |
| Send | `/api/plans/send/{plan_date}` | POST | No body |
| Add Plan | `/api/plans/add/{plan_date}` | POST | No body |
| Add Staff | `/api/plans/{plan_id}/staff/{user_id}` | POST | Per-plan |
| Remove Staff | `/api/plans/{plan_id}/staff/{user_id}` | DELETE | Per-plan |
| Add Appointment | `/api/plans/{plan_id}/appointment/{appointment_id}` | POST | Per-plan |
| Remove Appointment | `/api/plans/{plan_id}/appointment/{appointment_id}` | DELETE | Per-plan |

### 1.3 Legacy Plan Editing Model
- **Per-plan CRUD**: Staff and appointments are added/removed via REST endpoints per plan
- **No drag & drop**: Add Staff / Add Appointment modals with checkbox selection
- **No backlog**: Unscheduled shown in a modal (read-only list), not a draggable backlog
- **No draft/confirm split**: Plans are mutable until sent to ResortCleaning; Copy creates new mutable plans from sent ones

### 1.4 Legacy Build Options (PlanBuildOptions)
- `available_staff`: number[] — selected before Build
- `services`: number[] — filter_service_ids (default 21942, 23044)
- `omissions`: number[] — appointment IDs to exclude from scheduling
- `routing_type`: 1–5 (Farthest to Office, Farthest to Anywhere, etc.)
- `cleaning_window`: float (default 6.0)
- `max_hours`: float (default 6.5)
- `target_staff_count`: optional int

### 1.5 Legacy Modals
- **Available Staff**: Multi-select checkboxes; persists to model before Build
- **Omissions**: Multi-select appointments to omit; scoped by date + services
- **Unscheduled**: Read-only list of unscheduled appointments (confirmed vs unconfirmed)
- **Shift Check**: Staff shift issues for the day
- **Build Error**: Shows build failure details

---

## 2. Task 6: What It Proposes

### 2.1 Proposed Flow
- **Path**: `/dashboard/schedule` (admin edit; staff read-only)
- **Layout**: Header (date picker, Generate, Save Draft, Confirm) + collapsible Build Options + left backlog + right board
- **Build Options**: Collapsible panel, persisted in localStorage
- **Staff**: Multi-select with availability indicators; assign to team columns
- **Board**: Drag & drop (appointments backlog → team columns; staff chips between columns)
- **RPC**: `generate_schedule` with date, staff_ids, options, constraints
- **APIs**: `POST /api/plans/generate`, `GET/PUT /api/plans/daily`, `POST /api/plans/confirm`

### 2.2 Proposed API Surface (Task 6)
| Action | Endpoint | Method | Notes |
|--------|----------|--------|-------|
| Generate | `/api/plans/generate` | POST | Body: {date, start?, end?, staff_ids, options, constraints}; returns suggested plan |
| Get Daily | `/api/plans/daily?date=YYYY-MM-DD` | GET | Draft/confirmed plans with teams, staff, ordering |
| Save Draft | `/api/plans/daily` | PUT | Upsert draft; version/updated_at for concurrency |
| Confirm | `/api/plans/confirm` | POST | Finalize; write plans/plan_teams/plan_staff/plan_items; status=confirmed |

---

## 3. Functional Differences: Legacy vs Task 6

### 3.1 Additions in Task 6 (Not in Legacy)

| Feature | Task 6 | Legacy |
|---------|--------|--------|
| **Drag & drop** | @dnd-kit for appointments and staff | Add Staff / Add Appointment modals only |
| **Backlog panel** | Left-panel unscheduled list with filters (time, zone, service) | Unscheduled modal (read-only list) |
| **Draft vs Confirm** | Explicit Save Draft + Confirm; draft persistence | Plans mutable until Send; no draft concept |
| **Collapsible Build Options** | Yes, localStorage | Always visible "Parameters" + "Options" |
| **Availability indicators** | Staff availability based on working hours + existing appointments | No availability display |
| **Constraint badges** | Conflicts, travel infeasible, overtime, skill gaps | Duplicate appointment highlight only |
| **RPC-based generation** | `generate_schedule` RPC with extended payload | `/api/plans/build/{date}` POST with PlanBuildOptions |
| **Optimistic concurrency** | version/updated_at on PUT | Not specified |
| **Autosave** | Debounced autosave of draft | No autosave; explicit per-plan API calls |
| **Read-only staff view** | Staff can view board, DnD disabled | Not clearly separated |
| **Realtime errors** | Publish to 'errors' channel | Build error dialog only |

### 3.2 Omissions in Task 6 (Present in Legacy)

| Feature | Legacy | Task 6 |
|---------|--------|--------|
| **Copy** | Copy sent plans to new mutable plans | Not mentioned; may be out of scope or deferred |
| **Omissions modal** | Explicit list of appointments to omit from build | Not explicitly called out; "include only unscheduled" / "include already assigned" toggles may cover different behavior |
| **Add Plan** | Add empty plan for day | "Creating/removing/renaming teams" — similar but team-centric |
| **Per-page display** | 10/20/50 plans per page | Single-day view; no pagination of plans |
| **Shift Check modal** | Staff shift issues | Not mentioned |
| **Routing type options** | 1–5 with labels | "start/end of day, max travel..." — different framing |

### 3.3 Semantic / Structural Differences

| Aspect | Legacy | Task 6 |
|--------|--------|--------|
| **Plan identity** | Plan = team + staff + appointments; plan_id | Plan = day-level; teams as columns; plan_teams/plan_staff/plan_items |
| **Editing model** | REST CRUD per plan (add/remove staff/appointment) | Batch PUT of full daily state |
| **Build input** | available_staff, services, omissions, routing_type, cleaning_window, max_hours, target_staff_count | date, staff_ids, options, constraints (broader) |
| **Send to ResortCleaning** | Explicit "Send" button | Task 7; Confirm does NOT send; export separate |

---

## 4. Properties Page Patterns vs Task 6

### 4.1 Properties Page Patterns (Current Next App)
- **Route**: `/dashboard/properties` (list) + `/dashboard/properties/[id]` (detail)
- **Data**: `useQuery` with `queryKey` including API URL; `PropertyAdapter.toApiParams` for filters
- **Filters**: In a bordered section; URL-synced via `searchParams`; debounced inputs for search/city
- **Table**: `DataTable` + `TablePagination` + `ResultsCount`
- **Auth**: `withAuth` on API routes (implied)
- **Options**: Fetched from `/api/options/property-status` etc.

### 4.2 Task 6 Consistency Check

| Pattern | Properties | Task 6 | Aligned? |
|---------|------------|--------|----------|
| **Adapter** | `PropertyAdapter` for endpoint + `toApiParams` | No adapter mentioned | **Gap**: Consider `PlanAdapter` or `ScheduleAdapter` for plans API |
| **Filters in URL** | q, city, statusIds, cleaningTimeMin, etc. | Build Options in localStorage | **Different**: Schedule is single-day; URL date param would align |
| **Options API** | `/api/options/property-status` | Services, staff, etc. | **Gap**: Task 6 should use `/api/options/*` for services, staff status |
| **useQuery** | `queryKey: ["properties", apiUrl]` | TanStack Query for fetching | **Aligned** |
| **List layout** | Filters → Results count → Table → Pagination | Header → Build Options → Backlog + Board | **Different layout** (expected) |
| **withAuth** | Used on API routes | `withAuth({role:'admin'})` for generate/confirm | **Aligned** |
| **Error handling** | `error?.message` passed to DataTable | Toasts + inline banners + realtime | **Task 6 more elaborate** |

### 4.3 Recommendations for Task 6 to Match Properties Patterns
1. **Introduce a Plan/Schedule adapter** for `/api/plans/*` similar to `PropertyAdapter` (endpoint, toApiParams for date/filters).
2. **Sync date to URL**: `?date=YYYY-MM-DD` for schedule page, like properties sync filters.
3. **Use options APIs**: Fetch services from `/api/options/services`, staff from existing staff API, for consistency.
4. **Reuse filter UI components**: `StatusMultiSelect`, `DurationPicker` where applicable (e.g., cleaning window, max hours).

---

## 5. Decisions to Justify or Remove

### 5.1 Justify (Keep in Task 6)
- **Drag & drop**: Significant UX improvement over modal-based add/remove; aligns with modern scheduling UIs.
- **Draft/Confirm split**: Clearer workflow; prevents accidental overwrites; supports optimistic concurrency.
- **Backlog panel**: Better visibility of unscheduled work than a modal.
- **Collapsible Build Options**: Reduces clutter; localStorage is reasonable for single-user preferences.
- **RPC-based generation**: Task 6 assumes Supabase RPC; legacy uses REST. If backend migrates to Supabase, RPC is appropriate.
- **Read-only staff view**: Good RBAC; legacy does not clearly separate.

### 5.2 Remove or Defer
- **Copy**: Legacy Copy is important for "copy sent plans to new mutable plans." Task 6 should explicitly include Copy or document it as Task 7+.
- **Omissions**: Legacy omissions = "exclude these appointments from build." Task 6's "include only unscheduled" / "include already assigned" may not be equivalent. Need explicit omissions support or clear mapping.
- **Shift Check**: Legacy has shift-check modal. Task 6 does not mention it. Either add or document as deferred.
- **Per-page plans**: Legacy paginates plans (10/20/50). Task 6 is single-day; if many teams, consider virtualization/pagination of columns.

### 5.3 Clarify
- **Build Options mapping**: Map legacy `PlanBuildOptions` fields to Task 6's `options`/`constraints` so backend can reuse existing algorithm.
- **Plan data model**: Legacy has plan_id, team, staff, appointments. Task 6 uses plans/plan_teams/plan_staff/plan_items. Ensure migration path.
- **Add Plan vs Add Team**: Legacy "Add Plan" = empty plan. Task 6 "creating teams" = similar. Align naming.

---

## 6. Summary Table

| Category | Legacy | Task 6 | Recommendation |
|----------|--------|--------|----------------|
| Build | POST build/{date} + PlanBuildOptions | POST generate + RPC | Map PlanBuildOptions → RPC params |
| Copy | POST copy/{date} | Not in Task 6 | Add Copy or defer to Task 7 |
| Send | POST send/{date} | Task 7 | Keep separate |
| Omissions | Modal, array of appointment IDs | Not explicit | Add omissions to Build Options |
| Staff selection | Available modal before Build | Multi-select + team assignment | Keep Task 6 model; add availability |
| Appointments | Add/Remove per plan via REST | DnD batch PUT | Keep Task 6 model |
| Draft/Confirm | None | Save Draft + Confirm | Keep Task 6 |
| Shift Check | Modal | Not in Task 6 | Add or defer |
| Pagination | Plans 10/20/50 | Single day | Keep single-day; virtualize if needed |

---

## 7. Post-Review Updates (Applied 2026-02-17)

The following changes were applied to Task 6 based on user decisions:

| Change | Rationale |
|--------|-----------|
| **Removed draft/save/confirm** | Plans in DB are the working state; edits via API write directly (same as legacy). No draft/confirm split. |
| **Removed staff availability** | Out of scope for initial implementation. |
| **Removed constraint badges** | Out of scope; keep only legacy duplicate highlight. |
| **Postponed read-only staff view** | Requires new authorized-viewer role and RLS policy work; defer to future task. |
| **Added Copy** | Matches legacy; POST /api/plans/copy/{plan_date}. |
| **Added Omissions** | Explicit in Build Options; matches legacy PlanBuildOptions. |
| **Build Options = PlanBuildOptions only** | No speculative fields; exact legacy shape. |
| **RPC parameter names** | build_schedule_plan uses `date_to_schedule`; copy uses `schedule_date`; add uses `target_plan_date`; per-plan CRUD uses `staff_to_add`/`staff_to_remove`, `appointment_to_add`/`appointment_to_remove`, `target_plan`. |

---

*Generated for Task 6 review. Task 6 updated per decisions above.*
