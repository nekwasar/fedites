# Fedites — Configuration Catalog (v2)

> The build spec for everything configurable in a Fedites instance. Companion to [spec.md](spec.md) §15 and [rules.md](rules.md) §O.
> Fedites is a **white-label template**: one codebase, many school instances, everything configurable through the **Studio** (post-MVP) / **Instance settings** (MVP) — except Platform Law.
>
> **v2:** one standard styling at MVP — the full config stack and every registry remain, but each layer ships exactly one value (one family, one variant per element, one nav pattern per device). The Color Theme layer stays active. Scaling later is configuration, never a rewrite.

---

## 1. The Configuration Stack (precedence, highest wins)

```
5. Element overrides   — per-element variant swaps (buttons = outlined, rest inherited)
4. Instance overrides  — the school's own deltas (terminology, flags, nav geometry)
3. Color Theme         — standalone layer; NEVER part of a family
2. Style Family        — structure & style pack (surfaces, density, icons, motion)
1. Platform Law        — fixed gates: a11y, performance, privacy, press states, no emojis (chat messages, comments, and reactions only)
```

Precedence is deterministic: element > instance > color theme > family > law. Overrides persist as deltas, so composing "Minimalist family + Heritage color theme + outlined buttons" works cleanly **once more layers exist — at MVP each layer holds exactly one value, so the composition is fixed: Fedites Standard + the school's chosen theme preset**.

## 2. Color Themes (independent layer)

- Every color slot is defined here, validated for WCAG AA in light and dark before publish.
- **Slots:** `accent`, `accent-contrast`, `base`, `base-contrast`, `neutral-50…900`, `success`, `warning`, `danger`, `info`, plus dark-mode mirrors.
- **Curated presets** (popular school combinations): Wine Red + White (Fedites default) · Navy + Gold · Forest Green + Cream · Maroon + Sky · Royal Blue + White · Purple + Silver · Black + Orange · Teal + Coral · Heritage Brown + Parchment · Slate + Crimson.
- Admins may define custom palettes; the Studio **refuses to publish** any palette failing contrast or semantic-distinction checks.

## 3. Style Families (structure & style — never color)

Each family is a versioned pack defining: radius scale, surface treatment, elevation/blur, density, spacing rhythm, icon set, type pairing, motion language, and a default variant for every element in §5.

| Family | Character | Status |
|---|---|---|
| **Fedites Standard** | Flat solids, radius 0, hairline rows, sharp everything — the signature look, implemented on Tailwind + shadcn/ui primitives | MVP (the only one) |
| Minimalist | Thin strokes, generous whitespace, single type family, quiet accents | Roadmap |
| Editorial | Serif mastheads, rules and columns, heritage print grammar | Roadmap |
| Brutalist Grid | Visible grid, table-like structures | Roadmap |
| Soft/Modern | Radius tokens raised, tonal surfaces | Roadmap |
| Material-inspired | Elevation, ripple press states, shared-axis motion | Roadmap |
| Glassmorphism | Blur surfaces with flat fallback tokens on low-end devices | Roadmap |

**Law gates for every family & variant:** WCAG AA, 44px touch targets, keyboard/screen-reader, performance budget, press states (family-implemented), reduced-motion honored, no emojis (chat messages, comments, and reactions only).

## 4. Navigation Geometry (per device)

- **MVP ships one pattern per device [LOCKED]:** mobile `tab-bar` (bottom tabs + the **Menu sheet** for overflow) · desktop `side-rail`.
- **Menu sheet (mobile only):** a slide-out drawer listing navigation items only — the pages beyond the tab bar's primary slots. `primaryCount` (default 4) is config. Never rendered on desktop; the side rail carries every item.
- **Registry kept for scale:** mobile `top-tabs` · `hybrid` · `drawer` · `floating-dock`; desktop `top-nav` · `top+side` · `command-first` — config-driven, not built at MVP.
- **Fixed item set:** groups, feed, chat, events, menu (+ manage for role-holders) — items stay; geometry moves. The "menu" item is the sheet trigger, never a page.
- Badges, deep links, and state restoration behave identically in all patterns via the nav service; the compatibility matrix still gates any future pattern publish.

## 5. Element Variant Registry (every element, multiple styles)

Grouped into families; instances may override any single element.

| Element | Variants (MVP) |
|---|---|
| Nav bars (mobile/desktop) | classic · floating · labeled-icons · text-only |
| Buttons | filled · outlined · underline-link · tonal |
| Inputs/forms | underline · boxed · inline |
| Rows/lists | hairline · zebra · stacked-meta |
| Headers | masthead · minimal · data-bar |
| Modals & sheets | full-sheet · centered-modal · anchored-panel · drawer |
| Toasts & alerts | banner · snackbar · inline-callout |
| Tabs & segments | underline-tabs · pill-segments · boxed-tabs |
| Badges & chips | solid · outline · dot |
| Icons | line · filled · duotone (family-locked set) |
| Avatars & thumbnails | sharp · rounded · circled |
| Tables (desktop) | hairline-grid · zebra · ruled |
| Empty states | typographic-minimal · typographic-invitation |
| Skeletons | block · line-shimmer |
| Dividers | hairline · ruled-double |
| FABs | corner · docked-inline |
| Dropdowns & tooltips | plain · bordered |
| Pagination | simple · numbered |
| Signature surfaces | QR ticket · alumni ID card · countdowns (family-skinned) |

Every variant passes the law gates in both themes before release. **At MVP each element ships exactly ONE standard variant [LOCKED]** — the table above is the registry schema that stays in config so variants can be added later without code changes.

## 6. Structure & Behavior Config

- **Structure:** tabs (order/labels/icons/visibility), desktop layout pattern, Feed rails on/off, Groups home segments, Menu catalog sections & order, enabled group types (+ their names and joining rules).
- **Behavior policies:** vouching (on/off, setmates count, fallback), probation capability set, voting eligibility, event creation rights, dues cycle/tiers/reminders, emergency broadcast policy, chat edit/delete windows, news comments default, donor wall default, face-search policy, location precision, quiet hours, language.
- **Terminology glossary:** every UI noun (set, house, group, dues, AGM…) renamable per instance; flows through UI, emails, pushes.
- **Copy tables:** all system strings editable (voice rules still apply); English defaults, i18n-ready.
- **Feature flags:** all 112 MVP features flag-gated; disabling removes nav entry, catalog card, search index, and API surface cleanly.

## 7. Instance Settings (MVP) & The Studio (post-MVP)

- **MVP — Instance settings (Manage area):** a config editor for the active layers: color theme preset, terminology glossary, copy tables, feature flags, nav labels, menu overflow count. **Draft → publish with versioning and one-click rollback.** Validation gates refuse out-of-law publishes (contrast, required slots).
- **Post-MVP — full Studio:** live device-frame preview, family gallery, element variant panels, pattern gallery, presets export/import ("new school in 30 minutes").

## 8. Engineering Contract

- Zero instance constants in code (extends rules.md M1): one hardcoded color/label anywhere breaks white-labeling.
- Config lives in the DB as a typed, versioned document per instance (`instance_id` on every table — tenant insurance); API returns config at session boot; the shell is schema-driven.
- Policy engine reads behavior config server-side; permissions stay enforced at the API (M5) — config changes what the policy *is*, never where it's enforced.
- CI validates the default preset and runs the policy test matrix across config permutations.

**Web foundation (Next.js) contract:**
- **Server-first pages (M7):** every route is a React Server Component (or SSR) that renders WITH its data — no client-side page fetching, no loaders/skeletons on page load. Client components only where interactivity demands: WS chat, forms, optimistic mutations (L6 via TanStack Query).
- **One contracts source of truth (M8):** `packages/contracts` — zod schemas for every endpoint; API (Fastify), web (Next.js), and mobile (Expo) derive types from it. Next.js `typedRoutes` enabled.
- **Sessions:** HttpOnly cookie (`fedites_session`), hashed token in PostgreSQL `sessions` with expiry + revocation; RSC resolves the session server-side per request; 2FA (TOTP) gates login.
- **Realtime:** the WebSocket hub lives in the Fastify API; the Next.js client connects to the same origin via the reverse proxy (`/ws`). Badges refresh from the API (authoritative), WS only wakes the UI (I5).
- **Media:** uploads stream to MinIO via the API; serving uses signed URLs through `next/image` with a custom MinIO loader (WebP, sized to layout — D3/L1).
- **PWA:** installable web app (manifest + service worker, serwist) — offline shell, install prompts tuned in Phase 7.
- **Security:** security headers (CSP, HSTS, X-Frame-Options) + rate limiting on auth and money endpoints; permissions never client-side (M5).
- **Styling:** Tailwind CSS v4 tokens-as-vars = the M1 token layer; shadcn/ui primitives (Radix) themed to the Fedites Standard grammar (flat, hairline, radius 0 — A1/A4/A5); ESLint bans raw colors/px/z-index in app code.

## 9. What Stays Fixed (Platform Law, never configurable)

Accessibility floors · performance budgets · press states · reduced motion · no emojis (chat messages, comments, and reactions only) · copy voice rules · navigation integrity (I2–I6) · attention rules (J2–J5) · privacy rules (K1–K5) · engineering rules (M1–M6) · archive-never-delete · API-enforced permissions · audit logs.
