# AKT Media Productions

pnpm monorepo: `artifacts/akt-media` (website + sample player), `artifacts/api-server` (Express API),
`lib/db` (Drizzle/Postgres schema), `lib/api-*` (generated API client/validators).

## Deploy on Render (single web service)

| Setting | Value |
|---|---|
| Root Directory | *(empty)* |
| Build Command | `NODE_ENV=development pnpm install --frozen-lockfile && pnpm --filter @workspace/akt-media run build && pnpm --filter @workspace/api-server run build` |
| Start Command | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| Health Check Path | `/api/healthz` |

Environment variables: `NODE_ENV=production`, `NODE_VERSION=22.12.0`, `DATABASE_URL` (Internal Database URL),
`SESSION_SECRET` (any long random string). Set `DATABASE_SSL=false` only if your database rejects TLS.

The API build copies `artifacts/akt-media/dist/public` into `artifacts/api-server/dist/public`, so the website
must be built first. Playlist tables are created automatically on first start.

## Local development
`pnpm install`, then see `replit.md` for the dev commands (needs `DATABASE_URL`, `SESSION_SECRET`, `PORT`).
