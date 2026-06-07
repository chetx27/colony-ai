# ColonyIQ

ColonyIQ is a full-stack last-mile navigation system for Indian delivery logistics.

## Workspace Structure

- `apps/customer-pwa` — customer-facing PWA for pin drop and voice directions.
- `apps/agent-app` — agent navigation app with queue and landmark guidance.
- `apps/ops-dashboard` — operations dashboard for analytics, landmarks, and pipeline monitoring.
- `packages/api` — Express backend with AI pipeline, demo-mode fallback, and REST routes.
- `packages/shared` — shared TypeScript types.
- `packages/db` — PostGIS schema and seed data.

## Local Development

1. Copy `.env.example` to `.env`.
2. Enable demo mode for local use:
   - `DEMO_MODE=true`
   - leave API keys blank for mock mode.
3. Install dependencies:
   - `npm install`
4. Start all apps and the API:
   - `npm run dev`

## Build

- `npm run build` — builds the backend and all three frontends.

## Deploy

1. Set `DEMO_MODE=false` for production.
2. Configure Supabase and Google Cloud environment variables.
3. Deploy `packages/api` to Railway or Vercel Serverless.
4. Deploy each PWA app to Vercel or Netlify.

## Notes

- The repo is now configured with Vite PWA support for all three frontends.
- CI is enabled via `.github/workflows/ci.yml`.
- Demo mode is available when API keys are not supplied.
