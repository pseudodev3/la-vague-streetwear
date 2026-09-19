# LA VAGUE Handoff

Updated: 2026-09-19

## Continue from here

Repository: `pseudodev3/la-vague-streetwear`

Current working branch: `polish/lookbook-seo-cleanup`

Current branch head: `a0a6298613f53c82d3910cc9eb06d75f8f17bbb2`

Base branch: `main`

The branch is currently **53 commits ahead of main and 0 behind**. Do not restart this work from `main`; continue from the branch above.

There is **no PR for this branch yet**. The normal CI workflow only runs on PRs to `main` or pushes to `main`/`develop`, so the next safe step is to open a PR and use the PR checks as the authority before merging.

## User request being implemented

The requested cleanup pass is:

1. Redesign the homepage Lookbook layout.
2. Inspect the actual Lookbook photography and replace generic labels with descriptions that fit each image.
3. Replace the old red `LV` favicon with the official LA VAGUE logo.
4. Remove newsletter UI for now.
5. Improve SEO meaningfully, not through keyword stuffing.
6. Delete files that can be proven unused.
7. Preserve the existing commerce/payment architecture and avoid breaking production.

## Completed on this branch

### Lookbook

The homepage Lookbook has been rebuilt as a more editorial image-led layout instead of the old generic grid.

The five looks now use the actual photography as the source of truth:

- **01 Rear View** — brown oversized graphic tee photographed from the back.
- **02 Poolside Signal** — black crop top with white LA VAGUE logo headwrap beside a pool.
- **03 Concrete Grey** — oversized grey graphic tee against raw concrete/skatepark surroundings.
- **04 Double Vision** — two relaxed striped shirts showing front and back details.
- **05 The Wave Doesn't Stop** — light blue statement shirt photographed from behind.

The lightbox now carries the new titles and descriptions.

The first look was switched from `/assets/urbannights.png` (~1.1 MB) to the existing `/assets/urbannights.jpg` (~95 KB), and the duplicate PNG has been deleted.

### Newsletter removal

Visible newsletter UI has been removed from:

- homepage
- checkout opt-in

Homepage newsletter JS handlers and newsletter styling/overrides were removed as part of the cleanup.

### Official logo as icon

The old generated `favicon.svg` containing the letters `LV` was retired.

Pages, the web manifest, and service-worker app shell now point at:

`/la-vague-red-wordmark.png`

The old `favicon.svg` file has been deleted.

### SEO work

Indexable storefront/legal pages now have improved:

- page titles
- meta descriptions
- canonical URLs
- robots directives
- Open Graph metadata
- Twitter metadata
- consistent LA VAGUE social image
- homepage Organization / ClothingStore / WebSite structured data

Utility/transaction pages are marked `noindex`, including:

- checkout
- order confirmation
- order tracking
- admin
- API docs
- 404

Product pages now update SEO metadata after the live product loads:

- product-specific document title
- canonical URL using `?slug=`
- product description
- Open Graph product metadata
- product image
- NGN price metadata
- Product JSON-LD
- stock availability
- aggregate rating when live ratings exist

### Product discovery in sitemap

Production sitemap discovery has been improved beyond static meta tags.

Render now serves:

`GET /api/sitemap.xml`

It queries live product slugs and emits product URLs in the form:

`https://la-vague.store/product?slug=<slug>`

Netlify proxies:

`/sitemap.xml` → `https://la-vague-api.onrender.com/api/sitemap.xml`

This keeps live products discoverable without adding a sitemap npm dependency.

`robots.txt` points to `https://la-vague.store/sitemap.xml`.

### Repo cleanup already performed

The following files were removed because they were superseded or unreferenced:

- `favicon.svg`
- `assets/ahhhh.jpg`
- `assets/urbannights.png`
- `src/scripts/script.js`
- `src/scripts/i18n.js`
- `tests/unit/i18n.test.js`
- `src/services/seoService.js`

Related stale i18n test fixtures and ESLint globals were also removed.

The unused `sitemap` npm dependency was removed from `package.json` and its lockfile entries were pruned.

The active translation runtime remains `src/scripts/translations.js`.

### Legacy locale cleanup

The old `initLegacySelectors` naming/plumbing on home/shop/product was replaced with a smaller active page-locale bootstrap. Do not restore the removed duplicate i18n runtime unless a real regression proves it is needed.


## UI skill requirement

For **any future UI/UX work** on LA VAGUE, use these two skills as explicit design constraints before making visual changes:

- `npx skills add https://github.com/jakubkrehel/skills --skill better-ui`
- `npx skills add https://github.com/emilkowalski/skills --skill emil-design-eng`

Apply their guidance especially to:
- optical alignment
- spacing and visual hierarchy
- concentric radii
- depth through surfaces/shadows instead of card spam
- restrained borders
- explicit transition properties
- press/active states
- reduced-motion behavior
- mobile-first interaction quality
- avoiding generic SaaS/dashboard styling
- preserving LA VAGUE's existing dark / red / off-white visual identity

For storefront UI, **polish the current system rather than inventing a new brand language** unless the user explicitly asks for a redesign.

For admin UI, larger structural changes are acceptable when they improve operational clarity, but still preserve all existing functionality and hooks.

## Important architecture to preserve

Frontend:
- Netlify
- Vite build output: `dist/`
- storefront uses same-origin `/api`

Backend:
- Render
- API-only Express server
- production upstream: `https://la-vague-api.onrender.com`
- PostgreSQL in production, SQLite locally

Payments:
- Paystack
- server-side payment verification
- signed webhook verification
- exact amount/currency/order binding
- do not move paid-state authority back into the browser

Inventory:
- live backend inventory is authoritative
- storefront intentionally fails closed when backend inventory is unavailable
- do not restore static/fallback products that can be purchased while the backend is down

Security:
- CSRF protections are intentional
- rate limiting, CORS, Helmet and server-side admin auth are already in place
- CSP still contains `'unsafe-inline'`; previous decision was to leave this alone for now rather than risk breaking production

Deployment:
- `.github/workflows/ci-cd.yml` validates PRs
- Render deploy only happens after a push to `main`
- production E2E runs after Render deploy on `main`
- do not require main-only deployment/E2E checks as PR-required checks

## Current validation status

A pair of temporary one-off cleanup workflows were attempted during the audit but failed before a runner actually started. They were removed and should not be treated as product failures.

Because the normal CI workflow does **not** run on arbitrary feature-branch pushes, this branch has not yet received authoritative CI validation.

### Next steps

1. Open a PR from `polish/lookbook-seo-cleanup` to `main`.
2. Wait for the PR checks:
   - Quality Checks
   - Unit Tests
   - Build Frontend
   - Build Docker Image
   - Security Audit
3. If anything fails, inspect the exact failing job and patch the branch. Do not guess.
4. Pay special attention to `npm ci` because `package.json` / `package-lock.json` were intentionally pruned to remove the unused `sitemap` dependency.
5. Confirm the Vite build still copies the official logo, manifest, robots file, sitemap fallback and runtime assets.
6. Review the deploy preview on mobile, especially:
   - Lookbook grid proportions
   - lightbox title/description
   - favicon/app icon appearance
   - homepage after newsletter removal
7. After CI and preview are good, merge via PR.
8. Then watch the `main` production pipeline and confirm Netlify + Render are healthy.

## Recent main state before this branch

The previous storefront polish PR was merged to `main` as:

`c9e705677c79ba4872a0cb2bb09282cd27a7b7e2`

That pass already handled:
- mobile nav cleanup
- product Sale badge placement
- product control styling
- Shipping / Returns redesign
- order confirmation redesign
- dead mobile-menu handlers
- customer-facing em-dash cleanup

Do not undo those changes while finishing this branch.

## Working style

Keep changes contained and production-safe. The user prefers direct implementation over instructions and repeatedly asks not to break working commerce flows. Verify with GitHub/CI before saying something is complete.
