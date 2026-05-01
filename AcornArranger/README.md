# AcornArranger — Next.js web app

The operator-facing web app. Next.js 15 (App Router) on React 19, Supabase for auth and data, Tailwind + shadcn/ui for styling, TanStack Query / React Table for the data grid. Lives at the root of the monorepo under [`../`](../); see the [root README](../README.md) for the quick start and deployment story across both services.

## Scripts

```
npm run dev         # next dev --turbopack
npm run build       # next build
npm run start       # next start (production)
npm run lint        # eslint (next/core-web-vitals ruleset)
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run test:watch  # vitest --watch
npm run db:types    # regenerate lib/supabase/types.ts from the linked Supabase project
```

## Directory layout

```
AcornArranger/
├── app/                    # Next.js App Router
│   ├── (protected)/        # Authenticated shell (header + sidebar)
│   ├── api/                # Route handlers (appointments, plans, properties, staff, options, health, ...)
│   ├── auth/               # Login / sign-up / password reset
│   ├── dashboard/          # Operator dashboard (KPIs + charts)
│   ├── welcome/            # Post-signup holding page for unauthorized users
│   └── page.tsx            # Public landing page
├── components/             # Shared UI (shadcn/ui primitives, datagrid, filters, layout)
├── lib/                    # Cross-cutting app helpers
│   ├── supabase/           # Server + client SSR helpers and middleware
│   ├── filters/            # URLQueryCodec + per-entity schemas for query params
│   ├── hooks/              # useDataQuery, focus/announcer hooks, etc.
│   ├── scheduler/          # Typed client for the Python VRPTW sidecar
│   ├── api/                # Sort parser and other route-handler utilities
│   ├── adapters/           # Query-string ↔ API param translators used by features
│   └── navigation/         # Breadcrumb + list-return-url helpers
├── src/
│   ├── features/           # Vertical feature folders: appointments, plans, properties, staff, roles, dashboard
│   └── adapters/           # Client-side data adapters (Properties, Staff, Appointments, ...)
├── supabase/               # Linked Supabase project config + migrations
├── systemd/                # acorn-web.service (deploy target on the VPS)
└── middleware.ts           # Thin wrapper around lib/supabase/middleware.ts
```

## Architecture notes

**Auth is middleware-driven.** [`middleware.ts`](middleware.ts) delegates to [`lib/supabase/middleware.ts`](lib/supabase/middleware.ts). That file runs on every request (except static assets), validates the Supabase session, and enforces the route matrix:

- `/dashboard/*` and `/api/secure/*` require the `authorized_user` role.
- `/profile` requires any authenticated user.
- Everything else that is not `/`, `/login`, `/auth`, or `/welcome` redirects to login when no session is present.

The role is read from the `user_role` JWT claim and compared against `ROLE_ORDER = ['authenticated', 'authorized_user']`. Data access is ultimately secured by Supabase RLS; the middleware is only UX routing.

**Server vs client.** Route handlers under `app/api/*` use [`lib/supabase/server.ts`](lib/supabase/server.ts) with `createServerClient`, and are guarded by [`lib/apiGuard.ts`](lib/apiGuard.ts). Interactive pages use `@/lib/supabase/client` and TanStack Query. Shared filter state lives in the URL — the [`URLQueryCodec`](lib/filters/URLQueryCodec.ts) + per-entity Zod schemas keep list pages reloadable and shareable.

**Scheduler integration.** [`lib/scheduler/client.ts`](lib/scheduler/client.ts) is a thin typed fetch wrapper. Only [`app/api/plans/build/[plan_date]/route.ts`](app/api/plans/build/[plan_date]/route.ts) calls it, and only when `engine === "vrptw"`. The default engine is `legacy`, which calls the `build_schedule_plan` Postgres RPC and needs no sidecar. `ACORN_SCHEDULER_URL` defaults to `http://127.0.0.1:8001`; see the [scheduler README](../acornarranger-scheduler/README.md) for the HTTP contract.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill in the Supabase values.

| Name | Required | Purpose |
| ---- | -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | yes | Supabase anon / publishable key. |
| `ACORN_SCHEDULER_URL` | no | Override the sidecar base URL (default `http://127.0.0.1:8001`). |
| `ACORN_SCHEDULER_TIMEOUT_MS` | no | Override `/solve` timeout (default `60000`). |
| `SITE_URL` | no | Public origin of the deployed app (e.g. `https://app.acornarranger.com`), used to populate Next.js `metadataBase`. Defaults to `http://localhost:3000`. |

## `useDataQuery` cheat sheet

List pages share a single hook for pagination, filters, and sort. It reads state from the URL, validates it with a filter schema, and returns derived flags for UI (`showSkeleton`, `disableControls`, ...).

```tsx
import { useDataQuery } from "@/lib/hooks/useDataQuery";
import { Schemas } from "@/lib/filters/URLQueryCodec";

export function PropertiesList() {
  const q = useDataQuery<{ id: number }[], typeof Schemas.property>({
    endpoint: "/api/properties",
    filtersSchema: Schemas.property,
    storageKey: "properties:list",
  });

  // Wire up to <DataTable /> + <FilterBar />.
  // q.filters / q.setFilters / q.setPage / q.setPageSize / q.setSort
  // q.status / q.fetchStatus + q.showSkeleton / q.disableControls
  return null;
}
```

## Testing

```
npm run test
```

Vitest + Testing Library, configured in [`vitest.config.ts`](vitest.config.ts). Tests live next to the code they cover (`lib/__tests__/`, `components/__tests__/`, `src/features/*/__tests__/`, `app/api/__tests__/`).
