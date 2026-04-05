# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR on port 3000)
pnpm build        # Build client (Vite) + server (esbuild) into dist/
pnpm start        # Run production build
pnpm check        # TypeScript type check (no emit)
pnpm format       # Prettier format
pnpm test         # Run Vitest tests (server/**/*.test.ts, server/**/*.spec.ts)
pnpm db:push      # Generate + run Drizzle migrations
```

Run a single test file:
```bash
pnpm vitest run server/auth.logout.test.ts
```

## Architecture

This is a full-stack app for browsing China's national heritage protection sites (全国重点文物保护单位).

**Single-server setup**: Express serves both the tRPC API (`/api/trpc`) and the React frontend. In development, Vite runs as middleware; in production, static files are served from `dist/public`.

### Backend (`server/`)

- `_core/index.ts` — Express entry point; registers OAuth routes, tRPC middleware, and Vite/static middleware
- `routers.ts` — All tRPC procedures live here under `appRouter` (namespaced: `auth`, `heritage`)
- `db.ts` — All DB queries using Drizzle ORM with MySQL2
- `storage.ts` — S3/file storage helpers
- `_core/` — Framework infrastructure: tRPC setup, context, auth/OAuth, LLM invocation, env config, cookies

The `heritage` router exposes: `mapData` (lightweight coords for map), `search` (filtered + paginated, with optional Haversine distance sort when user coords provided), `detail`, `introduction` (LLM-generated, cached in `site_introductions` table), and `filters`.

### Frontend (`client/src/`)

- `main.tsx` → `App.tsx` — Root with `ThemeProvider`, `LocationProvider`, tRPC/React Query providers
- `pages/Home.tsx` — Single main page managing view state: map/list toggle, filters, pagination, site selection
- `components/MapView.tsx` / `Map.tsx` — Leaflet + MarkerCluster map
- `components/SiteDetail.tsx` — Detail panel with LLM introduction streaming
- `components/SearchBar.tsx` — Keyword + filter UI
- `lib/trpc.ts` — tRPC React client typed against `AppRouter`

### Shared (`shared/`)

- `const.ts` — Shared constants (cookie name, error messages)
- `types.ts` — Shared TypeScript types

### Database (`drizzle/`)

Three tables: `users`, `heritage_sites` (with indexes on name/batch/type/coords), `site_introductions` (LLM cache). Schema is in `drizzle/schema.ts`; migration files are in `drizzle/`.

### Path aliases

- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### UI

Components in `client/src/components/ui/` are shadcn/ui primitives (Radix UI + Tailwind). Use these existing components rather than adding new UI libraries.
