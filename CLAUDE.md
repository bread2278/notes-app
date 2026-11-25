@AGENTS.md

# Notes app — Next.js + Supabase

A single-page notes app. Users sign up / log in / log out with Supabase Auth
(email + password, or GitHub OAuth) and can create, view, edit and delete only their own notes.
Ownership is enforced in Postgres with Row Level Security (RLS), not just in the UI.

## Stack

- **Next.js 16.4** (App Router, Turbopack) with **React 19.3** and **TypeScript**
- **Tailwind CSS v4** (configured via `@import "tailwindcss"` in `app/globals.css`; no `tailwind.config` file)
- **ESLint 9** (flat config, `eslint.config.mjs`)
- **Supabase**: Postgres database + Auth, accessed with `@supabase/supabase-js` and `@supabase/ssr`
- Package manager: **npm**

Next.js 16 differs from older versions: e.g. `middleware.ts` is now **`proxy.ts`**.
Check `node_modules/next/dist/docs/` before using an API you're unsure of.

## Folder structure

```
app/                 App Router: layout.tsx, page.tsx (the single page), globals.css
public/              Static assets
AGENTS.md            Next.js agent rules (auto-managed by `next dev`, don't edit)
next.config.ts       Next.js config
eslint.config.mjs    ESLint flat config
tsconfig.json        TypeScript config; `@/*` maps to the project root
.env.local           Supabase keys + WeatherAPI key (git-ignored, never commit)
app/auth/callback/   route.ts: GitHub OAuth callback; exchanges ?code= for a session, redirects to /
components/          AuthForm.tsx (email log in / sign up + Continue with GitHub), Notes.tsx (notes CRUD + log out),
                     WeatherWidget.tsx (server-rendered weather, top right)
lib/supabase/        client.ts (browser), server.ts (Server Components), proxy.ts (session refresh),
                     admin.ts (server-only, secret key / service_role; only for weather_cache)
lib/weather.ts       server-only: WEATHER_CITY, weather_cache lookup (1h TTL), WeatherAPI.com fallback
proxy.ts             Next.js 16 proxy (formerly middleware): refreshes the auth cookie on each request
supabase/schema.sql  notes + weather_cache tables, grants, RLS; run by hand in the Supabase SQL editor
```

`app/page.tsx` is the only page: it checks the user on the server and renders
`AuthForm` when logged out or `Notes` when logged in. `WeatherWidget` sits above
both in its own `<Suspense>`.

Tables:
- `notes`: per-user; `authenticated` has grants, RLS limits each user to their own rows.
- `weather_cache`: one row per city (key `lower(trim(city))`), server-only. Only
  `service_role` has grants; `anon`/`authenticated` have none and RLS has no policies.

## Running it

```
npm install          # install dependencies
npm run dev          # dev server at http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
npm run lint         # lint
```

Requires `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...    # server-only; without it the weather cache is skipped
WEATHER_API_KEY=...        # server-only
```

## Rules

- Never commit `.env.local` or any secret, and never print or log key values.
- The publishable key is the only Supabase key the browser may see. The secret key
  (`SUPABASE_SECRET_KEY`) is used **only** server-side via `lib/supabase/admin.ts`
  (which imports `server-only`), never with a `NEXT_PUBLIC_` prefix, and never for user data like `notes`.
- This project does not auto-grant table access: every new table needs explicit `grant`s for the roles that use it.
- Every query on `notes` must rely on RLS for access control; don't trust the client.
- Database schema changes go in `supabase/schema.sql` and are run by hand in the Supabase SQL editor.
- Ask before each change so the user can review it.
