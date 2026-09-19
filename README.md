# LA VAGUE

Production e-commerce platform for **LA VAGUE**, a Nigerian streetwear brand.

- Storefront: https://la-vague.store
- Frontend hosting: Netlify
- API hosting: Render
- Database: PostgreSQL in production, SQLite fallback for local development
- Payments: Paystack
- Media: Cloudinary
- Email: Brevo API/SMTP, generic SMTP, Gmail, or SendGrid
- Error tracking: Sentry

## Architecture

The production app is split deliberately:

```text
Browser
  |
  |  HTML / CSS / JS
  v
Netlify (dist/)
  |
  |  /api/* proxy
  v
Render API (server.js)
  |
  +--> PostgreSQL
  +--> Paystack
  +--> Cloudinary
  +--> Email provider
  +--> Sentry
```

The Render service is **API-only**. Frontend source files and repository files are not served by Express in production.

## Requirements

- Node.js **20.20.2** recommended
- npm 10+
- PostgreSQL for production
- Paystack account for live checkout

Node version files are included for local tooling and deployment consistency.

## Local Development

```bash
npm ci
cp .env.example .env
npm run dev
```

This starts:

- Vite frontend on `http://localhost:3000`
- API server on `http://localhost:3001`
- Vite proxies `/api` requests to the local API

When `DATABASE_URL` is not configured, local development can use SQLite.

### Useful commands

```bash
npm run dev          # frontend + backend
npm run dev:client   # Vite only
npm run dev:server   # API only
npm run build        # production frontend build
npm run lint
npm run type-check
npm run test:ci
npm run check        # lint + type-check + tests + build
```

## Environment Variables

Use `.env.example` as the source of truth. Never commit real credentials.

Important production variables include:

```env
NODE_ENV=production
FRONTEND_URL=https://la-vague.store
DATABASE_URL=postgresql://...

ADMIN_PASSWORD=...

PAYSTACK_SECRET_KEY=...
PAYSTACK_PUBLIC_KEY=...

EMAIL_PROVIDER=brevo
BREVO_API_KEY=...
EMAIL_FROM=...
SMTP_FROM_NAME=LA VAGUE

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

SENTRY_DSN=...
```

Brevo SMTP, Gmail, generic SMTP, and SendGrid are also supported. See `.env.example` and `DEPLOYMENT.md` for the full configuration.

## Production Deployment

### Netlify

Production frontend settings are stored in `netlify.toml`:

```text
Node:    20.20.2
Build:   npm ci --include=optional && npm run build
Publish: dist
```

All storefront browser API traffic should use same-origin paths such as:

```js
fetch('/api/products')
```

Netlify proxies `/api/*` to the Render backend.

### Render

The API configuration is documented in `render.yaml`:

```text
Build: npm ci --omit=dev
Start: node server.js
Health: /api/health
```

Production secrets should be configured in the Render dashboard rather than committed to the repository.

## Payments

Checkout uses Paystack with server-side verification.

The backend verifies payment status and binds successful payments to the server-created order before finalizing inventory. A successful browser callback by itself is not treated as proof of payment.

The production Paystack webhook endpoint is:

```text
POST /api/payment/webhook
```

After verified payment, the cart is cleared. Pending or failed payments leave the cart intact.

## Inventory

Inventory is reserved during checkout and committed after verified payment.

Production PostgreSQL paths use transactions and row locking to reduce race conditions. Storefront availability and admin inventory views account for active reservations.

## Admin Panel

The admin panel is available through the storefront deployment and authenticates against the API.

Admin credentials are server-side environment variables. The browser does not contain the admin password.

Admin sessions use browser session storage and protected API routes. The panel includes:

- overview and revenue metrics
- orders and order status management
- products and inventory
- coupons
- reviews
- store settings

## Security

Current hardening includes:

- server-side Paystack verification
- order-bound payment references and amount checks
- HMAC verification for Paystack webhooks
- server-owned prices, shipping totals, and coupon calculations
- CSRF protection on state-changing browser requests
- CORS allow-listing for the storefront
- Helmet security headers
- API rate limiting
- PostgreSQL parameterized queries
- transactional inventory reservation/finalization
- admin authentication enforced server-side
- HTTPS enforcement in production
- Netlify CSP, HSTS, referrer, framing, and MIME-sniffing headers
- no Express static serving of the repository root
- production secrets excluded through `.gitignore`
- Sentry error reporting

No web application should be described as perfectly secure. Keep dependencies patched, rotate production credentials when necessary, review logs, and keep Paystack/Brevo/Cloudinary/Sentry credentials out of source control.

## Health Check

Use:

```text
GET /api/health
```

Monitoring services should check this endpoint rather than `/` on the Render API service, because the API root intentionally does not serve the storefront.

The PostgreSQL client retries initial connection failures and handles idle pool errors without letting an EventEmitter error terminate the API process. Database schema initialization is also retried before startup is abandoned.

## Testing and CI

GitHub Actions runs the core validation pipeline:

- ESLint
- TypeScript checking
- unit tests
- Vite production build
- security audit reporting
- Render deployment on validated `main` pushes

Before deploying substantial changes locally, run:

```bash
npm run check
```

## Main Project Layout

```text
.
├── index.html
├── shop.html
├── product.html
├── checkout.html
├── order-confirmation.html
├── admin.html
├── server.js
├── src/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── scripts/
│   └── styles/
├── email-templates/
├── scripts/
├── tests/
├── assets/
├── vite.config.js
├── netlify.toml
├── render.yaml
└── .github/workflows/ci-cd.yml
```

## Documentation

- `DEPLOYMENT.md` — current Netlify/Render deployment setup
- `PWA.md` — service-worker/PWA notes
- `openapi.yaml` — API documentation
- `.env.example` — environment variable template

## License

Proprietary software for LA VAGUE.

---

**LA VAGUE — Ride the Wave.**
