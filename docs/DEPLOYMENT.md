# LA VAGUE — Deployment Guide

Current production architecture:

- **Frontend:** Netlify
- **Backend API:** Render
- **Database:** Aiven PostgreSQL
- **Payments:** Paystack
- **Email:** Brevo API or SMTP
- **Frontend API access:** same-origin `/api` through the Netlify proxy

## Frontend — Netlify

Netlify is configured by `netlify.toml`.

### Build settings

```text
Build command: npm run build
Publish directory: dist
```

Do **not** publish the repository root. Vite builds the storefront into `dist`, copies `public/` to the deployed web root, and `scripts/copy-static-assets.js` copies the remaining browser source/runtime assets required by this multi-page build.

### API routing

Browser code should call the backend using:

```js
const API_URL = '/api';
```

Netlify proxies `/api/*` to the Render API. Do not hard-code the Render hostname inside storefront scripts.

The Render URL in `netlify.toml` is intentional because Netlify needs a real upstream target for that proxy.

## Backend — Render

The service configuration is described by `render.yaml`.

### Runtime

```text
Node: 20.20.2
Build: npm ci --omit=dev
Start: node server.js
Health check: /api/health
```

The Render service is API-only. A request to `/` may return `404`; this is expected. Render's liveness check should use:

```text
https://la-vague-api.onrender.com/api/health
```

For database-aware monitoring, use:

```text
https://la-vague-api.onrender.com/api/ready
```

The readiness endpoint returns `503` when PostgreSQL is unavailable, while the liveness endpoint remains independent so a transient database outage does not automatically cause a restart loop.

### Required environment variables

Configure secrets in the Render dashboard. Do not commit them to the repository.

```env
NODE_ENV=production
FRONTEND_URL=https://la-vague.store
DATABASE_URL=...
ADMIN_PASSWORD=...
PAYSTACK_SECRET_KEY=...
PAYSTACK_PUBLIC_KEY=...
```

`DATABASE_URL` is the Aiven PostgreSQL service URI and is configured directly in the Render dashboard. Render hosts the API only; it does not own the production database. PostgreSQL TLS is enabled in production. Use the environment overrides in `src/config/db.js` only when Aiven requires them.


## Backend uptime monitoring

The Render API is currently on the Free web-service plan. Render can spin a Free service down after an idle period, so the repository includes `.github/workflows/backend-watch.yml` as a lightweight external probe.

The watcher:

- runs every 10 minutes on the default branch, offset from the top of the hour
- checks `/api/health` first and records response latency plus `uptimeSeconds`
- checks `/api/ready` separately so Aiven connectivity is visible without coupling it to Render's liveness health check
- can be run manually from GitHub Actions
- also runs when its own infrastructure/config files change

Interpretation:

- a slow first liveness response together with very low `uptimeSeconds` is a cold-start / wake-up signature
- a fast response with very low `uptimeSeconds` is a recent process-start/restart signature
- if watcher runs remain less than 15 minutes apart but `uptimeSeconds` repeatedly resets, investigate Render restarts or health-check failures rather than ordinary idle sleep

This watcher is best-effort monitoring and keep-warm traffic, not an availability guarantee. GitHub scheduled workflows can be delayed. For production-grade always-on API availability, use always-on compute or a dedicated uptime service.

## Email

The application supports Brevo and SMTP.

### Brevo API

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=...
EMAIL_FROM=verified-sender@your-domain.com
SMTP_FROM_NAME=LA VAGUE
```

The Brevo API key must be enabled in the Brevo dashboard and the sender address must be verified.

### SMTP fallback / SMTP provider

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=...
SMTP_FROM_NAME=LA VAGUE
```

For Gmail, use an App Password rather than the normal account password.

## Paystack

Set the live or test keys in Render:

```env
PAYSTACK_SECRET_KEY=...
PAYSTACK_PUBLIC_KEY=...
```

Webhook URL:

```text
https://la-vague-api.onrender.com/api/payment/webhook
```

Payment completion is verified server-side. The browser must not be treated as the source of truth for payment success.

## Admin panel

Admin login is available at:

```text
https://la-vague.store/admin.html
```

The admin password is validated by the backend and is configured through `ADMIN_PASSWORD` in Render. It is **not** stored in frontend JavaScript.

Admin browser requests use the same-origin `/api` route and the authenticated admin session token is stored in `sessionStorage`.

## Database

Production uses **Aiven PostgreSQL** via `DATABASE_URL`. The old SQLite-on-Render-disk deployment model is obsolete and should not be used for production. `render.yaml` deliberately declares `DATABASE_URL` as `sync: false`; the real Aiven connection string belongs in the Render environment and must never be committed.

The API retries transient PostgreSQL connection and initialization failures during startup. Pool-level idle-client errors are logged instead of being allowed to terminate the Node process.

## Local development

The default local layout is:

```text
Vite frontend: http://localhost:3000
API backend:   http://localhost:3001
```

Vite proxies `/api` to the local backend, so frontend code should still use `/api` locally.

## Deployment flow

1. Push a validated change to `main`.
2. GitHub Actions runs one consolidated validation job: lint, type-check, unit tests, frontend build, and audit.
3. Netlify builds and deploys `dist`.
4. The validated main workflow triggers the Render deploy hook.
5. Production E2E tests run after the Render deploy.
6. Verify `/api/health`, storefront product loading, checkout, and admin login.

## Production smoke test

After deployment, verify:

- Storefront loads without console asset errors.
- `/api/products` returns `200` through the storefront domain.
- `/api/config/settings` returns `200`.
- `/api/health` returns healthy status.
- Admin login works.
- Inventory updates are reflected correctly.
- Test checkout can create an order.
- Paystack webhook returns `200`.
- Confirmation email is delivered.

## Intentional direct backend references

A few direct Render references are expected:

- `netlify.toml` — Netlify proxy upstream.
- `public/openapi.yaml` — source for the deployed `/openapi.yaml` API documentation.
- Paystack webhook configuration — Paystack must call the backend directly.

Browser storefront scripts should otherwise use `/api`.

## Troubleshooting

### Render `/` returns 404

Expected. The backend is API-only. Use `/api/health` for uptime checks.

### Email logs show `Brevo API Error: API Key is not enabled`

Replace or enable `BREVO_API_KEY` in Render and confirm the sender is verified in Brevo.

### Frontend API calls fail

Confirm the Netlify `/api/*` redirect exists and points to the Render service, then verify `FRONTEND_URL` and CORS settings.

### Netlify build fails after dependency updates

Use the Node version defined by the project. Current Vite dependencies require a sufficiently recent Node 20 release; production is standardized on Node `20.20.2`.
