# LA VAGUE — Project Handoff

_Last updated: 2026-09-20_

This file is the current source-of-truth handoff for continuing work on LA VAGUE in a new chat.

## Start here

Repository: `pseudodev3/la-vague-streetwear`

Production storefront: `https://la-vague.store`

Production API: `https://la-vague-api.onrender.com`

Current default branch: `main`

Latest main commit at handoff time:

`d0985eceef41ba3ccc9584a5320cefd082c2c505`

There are **no open pull requests** at the time this handoff was written.

Before making changes in a new chat:

1. Read this file.
2. Re-check the latest `main` SHA and open PRs because the repo may have moved since this handoff.
3. Work on one branch.
4. Finish and validate the whole requested pass before opening a PR.
5. Do not create repeated PRs or unnecessary branch pushes; Netlify build minutes matter.
6. Once the full CI suite is green and the user has authorized the merge, merge the PR without another unnecessary round-trip.

## Current production architecture

- Frontend: Vite static storefront deployed on Netlify.
- Backend: Express API deployed on Render.
- Production database: **Aiven PostgreSQL**.
- Local database fallback: SQLite.
- Payments: Paystack.
- Email: Brevo/configured transactional email path. Order confirmation email has been confirmed working in production.
- Media: Cloudinary.
- Error monitoring: Sentry.
- Service worker: `public/sw.js`.
- CI: `.github/workflows/ci-cd.yml`.
- Backend uptime diagnostics: `.github/workflows/backend-watch.yml`.

Important: Render hosts the API process only. The production PostgreSQL database is not on Render.

## Commerce invariants — do not weaken these

These are intentional and should remain server-authoritative:

- Product/stock data comes from the live API.
- Do not restore the retired static purchasable product fallback.
- Inventory checks fail closed when the live backend cannot verify stock.
- `CartState` is the browser-side add-to-cart gate, but backend inventory is authoritative.
- Order totals/shipping/payment authority stay on the server.
- Paystack payment status is verified server-side.
- A browser success screen alone must never mark an order paid.
- Payment/inventory finalization is designed to be idempotent.
- Do not move secrets, payment verification, order authority, or inventory authority into frontend JavaScript.

The currently working flow is:

checkout → Paystack verification → order update → inventory finalization → confirmation email → admin Orders view.

The user has confirmed this flow is working.

## Recent merged work

### PR #7 — security/frontend cleanup

Merged as:
`dcee47589be13d104ac2a6bfb933d36f25e6fd8b`

Main changes:

- shared browser escaping/URL/class/color safety helpers
- removed inline executable event attributes
- delegated/addEventListener handlers
- dynamic XSS hardening across cart, wishlist, products, checkout, search, tracking and reviews
- CSP blocks script attributes; `script-src` no longer uses `unsafe-inline`
- production source maps disabled
- browser static sellable-product fallback removed
- obsolete multi-currency subsystem removed
- E2E coverage modernized
- Vite/public folder cleanup
- product controls compacted and old sharp-edge UI cleaned up
- classic-script redeclaration bug found by Sentry and fixed

CI run #178 passed before merge.

### PR #8 — Aiven config + backend health hardening

Merged as:
`b77546bee6f10d82d68dba2964a94a65ec2773cf`

Main changes:

- removed stale Render-managed Postgres declaration
- `DATABASE_URL` is an external Render secret pointing to Aiven
- README/deployment docs now identify Aiven correctly
- added Backend Watch workflow
- Backend Watch probes `/api/health` and `/api/ready` every 10 minutes
- health/readiness endpoints bypass the normal customer API rate-limit budget

Important diagnosis:

Production `/api/health` had been returning **HTTP 429** because Render health checks were passing through the global 100 requests / 15 min limiter. That could make a healthy process appear unhealthy to Render. The fix excludes `/api/health` and `/api/ready` from that customer-facing limiter.

Render Free can still sleep/restart independently; the watcher is best-effort diagnostics/keep-warm traffic, not an uptime guarantee.

CI run #180 passed before merge.

### PR #9 — checkout legal links + legal page layout

Merged as:
`3a018866cd0870f976f1358c0ab2ee12f924133c`

Main changes:

- checkout Terms link now points to `/terms-of-service`
- checkout Privacy link now points to `/privacy-policy`
- cookie/privacy links normalized to pretty URLs
- Privacy and Terms rebuilt into a reading-first legal layout
- sticky “On this page” index on desktop
- responsive collapse on mobile
- anchored semantic legal sections
- Privacy page now loads the legal stylesheet

CI run #182 passed before merge.

### PR #10 — tailor legal policies + storage notice

Merged as:
`d0985eceef41ba3ccc9584a5320cefd082c2c505`

PR head CI run #184 passed successfully before merge.

Main changes:

#### Privacy Policy

The old generic ecommerce boilerplate was replaced with LA VAGUE’s actual data flows.

It now documents:

- guest checkout
- customer name/email/phone
- shipping address and order data
- Paystack payment references/status
- support/contact data
- reviews/waitlist data
- technical/security data
- Aiven
- Render
- Netlify
- Paystack
- Brevo/configured email provider
- Cloudinary
- Sentry
- delivery providers
- current browser storage behavior
- customer privacy rights and identity verification before disclosure/deletion

Removed unsupported claims about:

- Google Analytics
- Meta advertising tracking
- an active marketing/newsletter programme
- generic analytics/marketing cookie categories
- fixed seven-year retention claims that were not grounded in current store policy

#### Terms of Service

Tailored to the actual current store:

- Nigerian streetwear storefront
- guest checkout; no customer account requirement
- NGN pricing
- live stock
- Paystack card/bank-transfer flow
- server-side payment verification
- Nigeria-only delivery
- current discounts
- mandatory Nigerian consumer rights preserved

#### Cookie / browser-storage UI

The old consent banner was misleading because it offered Analytics and Marketing categories for trackers that are not currently installed, and those switches did not control anything.

It was replaced by a compact factual **browser-storage notice**:

- necessary first-party CSRF/security cookie
- cart/wishlist local storage
- notice acknowledgement in local storage
- no current Google Analytics, Meta Pixel, or advertising cookies
- one “Got it” action rather than fake Accept All / Reject All / Preferences controls

The existing `#cookie-accept-btn` selector was deliberately preserved so E2E behavior remains stable.

If non-essential analytics, advertising, fingerprinting, or similar tracking is added later, revisit consent gating and update the Privacy Policy before deploying it.

#### Privacy security

The old `/api/gdpr/export` and `/api/gdpr/delete` endpoints accepted an email address alone and could expose/delete personal data without proving the requester owned that address.

They are now disabled and return a safe response directing the customer to support until a verified self-service identity flow is implemented.

Do **not** restore those old unauthenticated implementations.

#### Returns / refunds

LA VAGUE still keeps a limited-drop stance for normal change-of-mind / wrong-size / wrong-colour cases, but blanket “no refunds for any reason” and “no monetary refunds” language was removed.

Current wording preserves remedies that may apply to defective, unsafe, incorrect, damaged, or materially misdescribed goods under Nigerian consumer law.

The 48-hour transit-damage reporting target is treated as useful operational guidance, not a waiver of longer statutory rights.

#### Checkout cleanup

Removed the dead “Save this information for next time” checkbox because the store had no implementation behind it.

## Backend health endpoints

`GET /api/health`

- process liveness
- intentionally independent from database readiness
- returns `uptimeSeconds`
- should not be behind the ordinary customer API rate-limit budget

`GET /api/ready`

- checks database readiness/reachability
- currently verifies the Aiven-backed DB path

Backend Watch uses the combination of response latency + `uptimeSeconds` to distinguish likely cold starts from recent process restarts.

## Current browser storage / cookies

Current expected storefront storage:

- first-party `csrf_token` cookie for CSRF protection
- localStorage cart
- localStorage wishlist
- localStorage browser-storage notice acknowledgement
- admin token is still stored in **sessionStorage** (see remaining work below)

There is currently no Google Analytics or Meta Pixel in the repo.

Sentry frontend monitoring is enabled when a DSN is configured and includes error/performance monitoring. Sensitive request information is partially sanitized/redacted before reporting.

## Current UI direction

LA VAGUE should not be redesigned casually again.

Current approved direction:

- dark / red / off-white visual identity
- rounded current UI language
- restrained depth
- lightweight controls
- strong typography
- mobile-first
- avoid card soup
- avoid generic SaaS dashboard treatment
- avoid old sharp-edge controls unless intentionally borderless
- use the Better UI / jakubkrehel and emil-design-eng principles for future UI work

The recent product/checkout/legal UI passes are intentional. Prefer targeted fixes over another wholesale redesign.

## Important remaining engineering work

### 1. Admin authentication

Current admin auth still stores the bearer token in `sessionStorage`.

Preferred future architecture:

- server-managed session
- `Secure`
- `HttpOnly`
- `SameSite` cookie
- deliberate CSRF/session handling

Treat this as a standalone security refactor. Do not slip it into an unrelated UI pass.

### 2. Verified privacy-rights workflow

Self-service export/delete is currently disabled for safety.

If restoring it, add real requester verification first, for example:

- signed one-time email verification
- expiring privacy-request token
- verified support/admin-assisted flow

Never disclose or delete customer data based only on a submitted email address.

### 3. Database migrations and backup procedure

The app still evolves schema through startup/db-init behavior.

Desired end state:

- versioned migrations
- explicit migration execution
- documented Aiven backup/restore procedure
- no casual production schema mutation during ordinary startup

### 4. Frontend module architecture

Several storefront scripts still run as classic scripts and share browser global scope.

The Sentry `escapeHTML` redeclaration incident proved this is fragile.

Longer-term improvement:

- migrate gradually to ES modules/imports through Vite
- avoid another giant rewrite
- preserve page behavior while removing shared lexical/global collision risk

### 5. Lint baseline

CI passes but the repo still has a number of warnings.

Good cleanup task later:

- unused variables
- old E2E variables
- `prefer-const`
- other non-breaking warnings

Goal: a quiet lint baseline so future warnings are meaningful.

## Product/legal details worth verifying manually

### Contact page

The contact page currently contains values such as:

- `+234 800 LA VAGUE`
- `12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria`

Before relying on those as formal business contact details, confirm they are real/current. The tailored Terms/Privacy pages intentionally use the support email/contact page rather than asserting a specific physical address.

### Returns/refund policy

The wording was improved in PR #10, but legal text should be reviewed again if LA VAGUE changes:

- fulfilment model
- countries served
- return handling
- payment methods
- consumer support process

## Deployment / CI workflow

The repo is public, so standard GitHub-hosted Actions are available.

Current `.github/workflows/ci-cd.yml` concept:

PR to `main`:
- npm ci
- ESLint
- type check
- unit tests
- frontend build
- security audit

Push to `main`:
- validation
- production backend deploy path
- production E2E path as configured

User preference:

**Do not open a PR while still working.**

The preferred sequence is:

branch → finish all requested work → static/manual validation → one PR → wait for full CI → merge once green.

Avoid unnecessary pushes because Netlify preview/production builds cost build minutes.

For multi-file changes, prefer an atomic Git tree/commit/update-ref operation where practical rather than many sequential branch commits.

## Files worth reading before major changes

- `README.md`
- `docs/DEPLOYMENT.md`
- `render.yaml`
- `netlify.toml`
- `.github/workflows/ci-cd.yml`
- `.github/workflows/backend-watch.yml`
- `server.js`
- `src/config/db.js`
- `src/middleware/csrf.js`
- `src/routes/orders.js`
- `src/services/orderService.js`
- `src/services/paymentService.js`
- `src/scripts/cart.js`
- `src/scripts/utils.js`
- `src/scripts/components.js`
- `src/scripts/checkout.js`
- `src/scripts/checkout-paystack.js`
- `privacy-policy.html`
- `terms-of-service.html`
- `returns.html`
- `refund-policy.html`

## Working style / expectations

The user is phone-first and generally wants implementation in the repo rather than a tutorial.

Important working preferences:

- do the work, do not repeatedly ask for confirmation when the request is clear
- do not break working commerce paths
- validate before PR
- keep build-minute usage low
- once a PR is ready, report exact CI state
- if the user says “merge it,” re-check mergeability + latest CI and merge if green
- prefer precise, compact status updates over long generic explanations

## Quick next-step recommendation

If no new production bug is reported, the next substantial engineering task should probably be the **admin HttpOnly session-cookie migration**, handled as its own branch/PR.

Before that, a very small useful check is to confirm whether the Contact page’s displayed phone/address are intentional real business details.
