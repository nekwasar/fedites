# Fedites — alumni community platform

White-label, single-school alumni platform. Docs: [spec.md](spec.md) · [mvp.md](mvp.md) · [rules.md](rules.md) · [configuration.md](configuration.md) · [phases.md](phases.md) · [features.md](features.md).

## Monorepo (Turborepo + pnpm)

| Package | Purpose |
|---|---|
| `packages/tokens` | Design tokens — spacing (4/8 grid), type scale, radius, motion, breakpoints (M1: the only place raw values live) |
| `packages/config` | Config engine — zod schemas, Color Theme presets, Style Families, nav patterns + compatibility matrix, element variant registry, precedence resolver, Platform Law gates |
| `packages/db` | Rails data model — SQL migrations (`instance_id` on every table), migration runner, fake-school seed |
| `packages/ui` | Component library — token-only primitives, hairline rows, press states, line icons |
| `apps/api` | Node/TS API — session-boot config service, policy engine (M5: permissions enforced at the API) |
| `apps/web` | React + Vite shell — config-driven nav (5 mobile + 4 desktop patterns), Studio preview scaffolding, PWA shell |
| `apps/mobile` | Expo shell — renders nav from the same session-boot config |

## Setup

```sh
pnpm install
cp .env.example .env   # point DATABASE_URL at your Postgres
pnpm db:migrate        # apply migrations
pnpm db:seed           # seed the fake school (3 sets, 6 group types, roles)
pnpm dev               # api :8787 + web :5173
```

## Phase 0 — status

| Session | Deliverable | Where |
|---|---|---|
| 0.1 | Stack + scaffold: PWA + native shells, CI, staging deploy, env | root workspace, `.github/workflows/ci.yml`, `ops/`, `apps/mobile` (+ `eas.json`), PWA manifest in `apps/web/public` |
| 0.2 | Data model for the rails + config schema + `instance_id` everywhere + migrations + seed | `packages/db/migrations/0001_rails.sql`, `packages/db/src/seed.ts`, `packages/config/src/schema.ts` |
| 0.3 | Design system part 1: tokens, color theme layer, variant registry, family inheritance | `packages/tokens`, `packages/config/src/{themes,families,resolve,law}.ts` |
| 0.4 | Design system part 2: config-driven shell — nav patterns, placeholder tabs from nav schema, Studio preview scaffolding | `apps/web/src/App.tsx`, `apps/web/src/shell/nav-patterns.tsx` |
| ↳ parallel | Payment provider + WhatsApp business verification kick-off, privacy policy draft | external tracks — not code; see phases.md |

### Demo gates

- **0.1** — every commit typechecks, lints (tokens + ESLint), tests, builds, builds Docker images, and deploys to staging via CI.
- **0.2** — `pnpm db:seed` populates a fake school: verified by `pnpm --filter @fedites/db test:pg` (every table has `instance_id`; all 6 group types exist).
- **0.3** — theme preset switches live in-app: open the web app → Studio preview panel (right edge) → pick any of the 10 presets or 3 families.
- **0.4** — nav pattern swaps via config: same panel → switch mobile pattern (tab-bar / top-tabs / hybrid / drawer / floating-dock) or desktop pattern (side-rail / top-nav / top+side / command-first), and flip the device frame.

## Engineering rules enforced in code

- **M1 tokens only** — `pnpm check:tokens` fails on raw hex colors / radii in component code.
- **M2 component library** — all UI comes from `packages/ui`.
- **M3 flags** — every incomplete feature is flag-gated off in the config document; disabled features drop their nav entry.
- **M5 API-enforced permissions** — `POST /v1/policy/check` evaluates the instance behavior config server-side.
- **M6 type safety** — strict TS, no `any`; API types inferred from the zod config schemas.
- **White-label** — zero school constants in code; the instance name/terminology/theme/behavior live in the `config_documents` row.
- **Law gates** — `runLawGates()` refuses configs failing WCAG AA contrast, nav integrity, variant registry, or the no-emoji rule (D1); the session-boot endpoint applies it before serving.
