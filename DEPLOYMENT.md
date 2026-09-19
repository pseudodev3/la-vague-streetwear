# LA VAGUE — Deployment Guide

Current production architecture:

- **Frontend:** Netlify
- **Backend API:** Render
- **Database:** PostgreSQL
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

Do **not** publish the repository root. Vite builds the storefront and `scripts/copy-static-assets.js` copies the required runtime assets into `dist`.

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

PostgreSQL TLS is enabled in production. Use the environment overrides in `src/config/db.js` only when your database provider requires them.

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

Production uses PostgreSQL via `DATABASE_URL`. The old SQLite-on-Render-disk deployment model is obsolete and should not be used for production.

The API retries transient PostgreSQL connection and initialization failures during startup. Pool-level idle-client errors are logged instead of being allowed to terminate the Node process.

If the database in `render.yaml` is deployed on Render's Free database plan, treat it as temporary infrastructure rather than durable production storage. Replace it with a persistent Postgres provider or a paid Render database before relying on it for long-lived production data.

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
- `openapi.yaml` — public API server documentation.
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
