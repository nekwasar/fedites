# Fedites — Configuration Catalog

> The build spec for everything configurable in a Fedites instance. Companion to [spec.md](spec.md) §15 and [rules.md](rules.md) §O.
> Fedites is a **white-label template**: one codebase, many school instances, everything configurable through the **Studio** — except Platform Law.

---

## 1. The Configuration Stack (precedence, highest wins)

```
5. Element overrides   — per-element variant swaps (buttons = outlined, rest inherited)
4. Instance overrides  — the school's own deltas (terminology, flags, nav geometry)
3. Color Theme         — standalone layer; NEVER part of a family
2. Style Family        — structure & style pack (surfaces, density, icons, motion)
1. Platform Law        — fixed gates: a11y, performance, privacy, press states, no emojis (chat messages, comments, and reactions only)
```

Precedence is deterministic: element > instance > color theme > family > law. Overrides persist as deltas, so composing "Minimalist family + Heritage color theme + outlined buttons" works cleanly.

## 2. Color Themes (independent layer)

- Every color slot is defined here, validated for WCAG AA in light and dark before publish.
- **Slots:** `accent`, `accent-contrast`, `base`, `base-contrast`, `neutral-50…900`, `success`, `warning`, `danger`, `info`, plus dark-mode mirrors.
- **Curated presets** (popular school combinations): Wine Red + White (Fedites default) · Navy + Gold · Forest Green + Cream · Maroon + Sky · Royal Blue + White · Purple + Silver · Black + Orange · Teal + Coral · Heritage Brown + Parchment · Slate + Crimson.
- Admins may define custom palettes; the Studio **refuses to publish** any palette failing contrast or semantic-distinction checks.

## 3. Style Families (structure & style — never color)

Each family is a versioned pack defining: radius scale, surface treatment, elevation/blur, density, spacing rhythm, icon set, type pairing, motion language, and a default variant for every element in §5.

| Family | Character | Status |
|---|---|---|
| **Fedites Classic** | Flat solids, radius 0, hairline rows, sharp everything — the signature look | MVP |
| **Minimalist** | Thin strokes, generous whitespace, single type family, quiet accents | MVP |
| **Editorial** | Serif mastheads, rules and columns, heritage print grammar | MVP |
| Brutalist Grid | Visible grid, table-like structures | Roadmap |
| Soft/Modern | Radius tokens raised, tonal surfaces | Roadmap |
| Material-inspired | Elevation, ripple press states, shared-axis motion | Roadmap |
| Glassmorphism | Blur surfaces with flat fallback tokens on low-end devices | Roadmap |

**Law gates for every family & variant:** WCAG AA, 44px touch targets, keyboard/screen-reader, performance budget, press states (family-implemented), reduced-motion honored, no emojis (chat messages, comments, and reactions only).

## 4. Navigation Geometry (per device, configurable)

- **Mobile patterns:** `tab-bar` (default) · `top-tabs` · `hybrid` (top utility + bottom tabs) · `drawer` · `floating-dock`
- **Desktop patterns:** `side-rail` (default) · `top-nav` · `top+side` · `command-first` (minimal chrome + Cmd+K)
- **Fixed item set:** groups, feed, chat, events, menu (+ manage for role-holders) — items stay; geometry moves.
- Patterns own their overflow (e.g., tab-bar's "More" sheet); badges, deep links, and state restoration behave identically in all patterns via the nav service.
- Studio publishes only pattern × device × item-count combinations in the validated compatibility matrix.

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

Every variant passes the law gates in both themes before release. **No element ships with a single style.**

## 6. Structure & Behavior Config

- **Structure:** tabs (order/labels/icons/visibility), desktop layout pattern, Feed rails on/off, Groups home segments, Menu catalog sections & order, enabled group types (+ their names and joining rules).
- **Behavior policies:** vouching (on/off, setmates count, fallback), probation capability set, voting eligibility, event creation rights, dues cycle/tiers/reminders, emergency broadcast policy, chat edit/delete windows, news comments default, donor wall default, face-search policy, location precision, quiet hours, language.
- **Terminology glossary:** every UI noun (set, house, group, dues, AGM…) renamable per instance; flows through UI, emails, pushes.
- **Copy tables:** all system strings editable (voice rules still apply); English defaults, i18n-ready.
- **Feature flags:** all 112 MVP features flag-gated; disabling removes nav entry, catalog card, search index, and API surface cleanly.

## 7. The Studio (Manage area)

- **Live preview** in device frames (phone/tablet/desktop) as you edit.
- **Draft → preview → publish:** versioned publishes; clients hot-reload config — no store update needed for theme/copy/structure changes.
- **History & rollback:** every publish is a snapshot; one-click revert.
- **Validation gates:** refuses to publish a11y/performance/contrast failures; compatibility matrix enforced.
- **Presets & portability:** starter packages + **export/import** of full instance config; "Fedites wine-red/white" is itself the default preset. Target: **a new school configured in 30 minutes**.

## 8. Engineering Contract

- Zero instance constants in code (extends rules.md M1): one hardcoded color/label anywhere breaks white-labeling.
- Config lives in the DB as a typed, versioned document per instance (`instance_id` on every table — tenant insurance); served via CDN cache; API returns config at session boot.
- Schema-driven shell: nav, Menu catalog, and Feed rails render from config schemas.
- Policy engine reads behavior config server-side; permissions stay enforced at the API (M5) — config changes what the policy *is*, never where it's enforced.
- CI validates the default preset and runs the policy test matrix across config permutations.

## 9. What Stays Fixed (Platform Law, never configurable)

Accessibility floors · performance budgets · press states · reduced motion · no emojis (chat messages, comments, and reactions only) · copy voice rules · navigation integrity (I2–I6) · attention rules (J2–J5) · privacy rules (K1–K5) · engineering rules (M1–M6) · archive-never-delete · API-enforced permissions · audit logs.
