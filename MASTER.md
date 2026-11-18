# LA VAGUE — Master Design System (`MASTER.md`)

> Single source of truth for visual direction, design tokens, component invariants, and anti-slop Floor compliance across the LA VAGUE storefront and admin dashboard.

---

## 1. Kickoff & Direction (§2, §19)

```text
MODE:        Redesign + Polish (Storefront) / App Screen (Admin Dashboard)
PRODUCT:     LA VAGUE — Nigerian D2C luxury streetwear platform
JOB:         Buy limited-run streetwear pieces in NGN with instant Paystack checkout
AUDIENCE:    Design-literate streetwear buyers in Lagos and the global diaspora
TONE:        Editorial + Austere — Dark Lagos architectural streetwear with crimson tension
MATERIAL:    real: live NGN catalog, 7-look editorial lookbook, 100% organic cotton Made-in-Nigeria specs
             pictures: /assets/hey2.jpg, daylight.jpg, skatepark.jpg, downtown.jpg, afterhours.jpg, hey.jpg, urbannights.jpg, about.jpg
             absent: no invented testimonials, no fake press logo wall, no fabricated review counts
STACK:       HTML5 + Vanilla ES Modules + Multi-stylesheet CSS Token System + Vite + Express/PostgreSQL
REFERENCE:   Editorial dark luxury lookbook & ranked archive grid (LA VAGUE 2026 system)
DIRECTION:   Deep obsidian surfaces (#080808 → #17171a) punctuated by a single crimson signal (#e3262e), condensed Oswald display headlines, and crisp Plus Jakarta Sans body/UI copy.
MOOD:        Architectural, nocturnal, tactile
GENRE:       Editorial (Storefront) · Modern-Minimal (Admin App Screen)
SIGNATURE:   Full-viewport typographic hero ("RIDE THE WAVE") leading into a numbered Most-Wanted archive shelf (01–04) and 7-frame editorial lookbook
DIALS:       Storefront: variance 7/10 · motion 5/10 · density 4/10
             Admin App:  variance 2/10 · motion 3/10 · density 8/10
```

---

## 2. Design Tokens (§4, §5, §6, §7, §8, §10)

### 2.1 Colour Tokens (Max 3 Colours + Warm Obsidian Neutrals)
- **Backgrounds (never pure `#000` or `#fff`)**:
  - `--lv-bg`: `#080808` (primary canvas)
  - `--lv-bg-soft`: `#0d0d0e` (secondary section ground)
  - `--lv-surface`: `#121214` (card / drawer / modal surface)
  - `--lv-surface-raised`: `#17171a` (elevated inner control / nested surface)
  - `--lv-surface-hover`: `#1c1c1f` (interactive surface hover)
- **Foregrounds (WCAG AA compliant on dark surfaces)**:
  - `--lv-text`: `#f5f3ef` (warm chalk primary text)
  - `--lv-muted`: `#9b9994` (secondary body & metadata)
  - `--lv-muted-2`: `#706f6c` (subtle captions & disabled text)
- **Accents & Semantic Status**:
  - `--lv-red`: `#e3262e` / `--lv-red-hover`: `#f13b42` (primary brand signal)
  - `--lv-green`: `#28b56f` (verified / in-stock / paid)
  - `--lv-warning`: `#f5a524` (low-stock / pending)
- **Borders & Outlines**:
  - `--lv-border`: `rgba(255, 255, 255, 0.085)`
  - `--lv-border-strong`: `rgba(255, 255, 255, 0.14)`
  - Content image outline: `1px solid rgba(255, 255, 255, 0.1)` (`outline-offset: -1px`, excluded on transparent wordmark logos)

### 2.2 Typography Tokens (2 Families Max)
- **Display Face**: `--font-heading: 'Oswald', sans-serif` (`line-height: 1.05–1.2`, `letter-spacing: -0.02em` on large heads, `text-wrap: balance`)
- **Body & UI Face**: `--font-body: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif` (`16px` base, `line-height: 1.5`, `text-wrap: pretty`)
- **Dynamic Numbers**: `font-variant-numeric: tabular-nums` enforced on all prices, cart/wishlist counters, countdown timers, ratings, order totals, stock counts, and admin data tables.

### 2.3 Spacing, Concentric Radius & Elevation
- **Spacing Scale**: `4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px`
- **Concentric Radius Scale (`outer = inner + padding`)**:
  - `--lv-r-xs`: `7px` (compact badges / tags)
  - `--lv-r-sm`: `10px` (buttons, inputs, inner controls inside `20px` cards)
  - `--lv-r-md`: `14px` (nested media frames / drawers)
  - `--lv-r-lg`: `20px` (outer cards, modals, checkout panels)
  - `--lv-r-xl`: `28px` (hero / feature containers)
- **Elevation Shadows**:
  - `--lv-shadow-1`: `0 1px 0 rgba(255,255,255,.025) inset, 0 10px 30px rgba(0,0,0,.18)`
  - `--lv-shadow-2`: `0 1px 0 rgba(255,255,255,.035) inset, 0 20px 56px rgba(0,0,0,.34)`

### 2.4 Motion & Micro-Interaction Contract (§10, §11)
- **Property Discipline**: Never `transition: all`. Animate `transform`, `opacity`, `background-color`, `border-color`, `color`, and `box-shadow` only.
- **Durations & Easing**:
  - `100ms` micro press feedback (`transform: scale(0.96)` on `:active:not(:disabled)`)
  - `150ms–220ms` standard UI state transitions (`--lv-ease: cubic-bezier(.23, 1, .32, 1)`)
  - `200ms` modal enter/exit (`scale(0.95) → scale(1)`)
  - Card hover lift: `translateY(-2px)` + `--lv-shadow-2` on pointer devices
- **Accessibility & Touch**:
  - `overflow-x: clip` on `html` and `body`
  - Instant `:focus-visible` ring (`2px solid rgba(227, 38, 46, 0.9)`, `outline-offset: 3px`)
  - Minimum `44×44px` touch targets on mobile/coarse pointers (`≥40×40px` on dense desktop admin)
  - Full `@media (prefers-reduced-motion: reduce)` fallback across all stylesheets
