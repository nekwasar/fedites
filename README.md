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

## Phase 0 — status (complete)

| Session | Deliverable | Where |
|---|---|---|
| 0.1 | Stack + scaffold: PWA + native shells, CI, staging deploy, env | root workspace, `.github/workflows/ci.yml`, `ops/`, `apps/mobile` (+ `eas.json`), PWA manifest in `apps/web/public` |
| 0.2 | Data model for the rails + config schema + `instance_id` everywhere + migrations + seed | `packages/db/migrations/0001_rails.sql`, `packages/db/src/seed.ts`, `packages/config/src/schema.ts` |
| 0.3 | Design system part 1: tokens, color theme layer, variant registry, family inheritance | `packages/tokens`, `packages/config/src/{themes,families,resolve,law}.ts` |
| 0.4 | Design system part 2: config-driven shell — nav patterns, placeholder tabs from nav schema, Studio preview scaffolding | `apps/web/src/App.tsx`, `apps/web/src/shell/nav-patterns.tsx` |
| ↳ parallel | Payment provider + WhatsApp business verification kick-off, privacy policy draft | external tracks — not code; see phases.md |

## Phase 5 — Memory & School (complete)

| Session | Deliverable | Where |
|---|---|---|
| 5.1 | Memory Lane core: throwback archive (era bulk upload), yearbooks + CSV search, on-this-day, hall of fame, memorials (§P state) | `apps/api/src/memory.ts`, migration 0011, web `MemoryLane.tsx` + Manage workbench |
| 5.2 | Wiki (revisions/lock/revert), slang dictionary, timeline, spotlights, articles | `apps/api/src/knowledge.ts`, web `Knowledge.tsx` + Manage queues |
| 5.3 | Nostalgia bundle: remember-when, recipes, radio, anthem/bell, stickers, capsules, letters, birthdays, awards | `apps/api/src/nostalgia.ts`, migration 0013, web `Nostalgia.tsx` |
| 5.4a | School Bridge: wishlist (fund/fulfil), adopt-a-project (ledger progress), past questions, tributes, bookings, records | `apps/api/src/schoolbridge.ts`, migration 0014, web `SchoolBridge.tsx` |
| 5.4b | Career: job board (fresh-grad priority), hiring pipeline, business directory + reviews, mentor office hours, referrals, endorsements | `apps/api/src/career.ts`, migration 0015, web `Career.tsx` |

## Phase 4 — Money (complete)

| Session | Deliverable | Where |
|---|---|---|
| 4.1 | Wallet/ledger core, pluggable gateway (manual ships), multi-currency, receipts | `apps/api/src/{money,payments}.ts`, migration 0008 |
| 4.2 | Dues: cycle/tiers/reminders, private status (§P), mark-paid/waive, ID tier marking | same module, web `Money.tsx` (Association + Manage) |
| 4.3 | Donations, campaigns, donor wall, confetti (F6), transparent ledger + CSV | `apps/api/src/giving.ts`, web `Giving.tsx` + `Confetti.tsx` |
| 4.4 | P2P approvals, tribute, pledges, reimbursements, sponsorships, scholarships, ledger publishing | `apps/api/src/structured.ts`, web `Structured.tsx` + Manage queues |

## Phase 3 — Belonging (complete)

| Session | Deliverable | Where |
|---|---|---|
| 3.1 | Events: calendar, create/RSVP (§P), group badges, countdowns, Activity bridge | `apps/api/src/events.ts`, web `EventsScreen` |
| 3.2 | Reunion suite (tasks/budget/RSVPs), QR tickets + door check-in, live counts, virtual attendance | same module, web organizer suite + jsQR scanner |
| 3.3 | Event photo wall + AI photo finder (pluggable stub, self-only) | `apps/api/src/{photos,face}.ts`, web `PhotoWall` + profile privacy section |
| 3.4 | Recognition engine (badges/streaks/founding) + intents, classmates rail, tune-my-feed, notify prefs | `apps/api/src/{recognition,recognition-routes}.ts`, profile + feed sections |

## Phase 2 — Daily Loop (complete)

| Session | Deliverable | Where |
|---|---|---|
| 2.1 | Group engine: one object, 6 types, join rules, Groups home with unseen tags | `apps/api/src/groups.ts`, web `GroupsHomeScreen` |
| 2.2 | Activity tab: posts/photos/polls, threaded comments, reactions, media, pin | `apps/api/src/activity.ts`, `media.ts`, web `GroupScreen` |
| 2.3 | Chat: WS realtime, receipts, typing, edit window, DMs, pin-to-feed | `apps/api/src/chat.ts`, `ws.ts`, web `ChatThread` |
| 2.4 | News bulletin: composer, reactions-only, discuss-in-set-group, promote | `apps/api/src/news.ts`, web `NewsScreen` |
| 2.5 | Feed v1: sources, rails v0, melt-into-group, less-from-group | `apps/api/src/feed.ts`, web `FeedScreen` |
| 2.6 | Group admin panel, reports, escalation, audit | `apps/api/src/moderation.ts` |

## Phase 1 — Rails (complete)

| Session | Deliverable | Where |
|---|---|---|
| 1.1 | Auth: signup (invite code), login, 2FA (TOTP), sessions | `apps/api/src/{auth,sessions,password,totp}.ts`, migration `0002` |
| 1.2 | Verification flow: invites, admin queue, set assignment, honorary, setmate vouching | `apps/api/src/verification.ts`, web `AuthScreen` + `ManageScreen` |
| 1.3 | Profile builder, digital alumni ID (QR), privacy v1, private family links, logged contact reveal | `apps/api/src/profile.ts`, web `ProfileScreen`/`IdScreen`/`MemberScreen` |
| 1.4 | Roles & permissions, Manage shell, notification dispatcher v1 (in-app inbox) | `apps/api/src/{manage,notify}.ts`, web `ManageScreen`/`InboxScreen` |

**Phase gate (walking skeleton):** every tab exists; a real member signs up with a code, is activated by an admin, is verified by 3 setmates, gets an ID card, and an admin role change sticks — all covered by `apps/api/src/phase1.pg.test.ts` and demoable via [DEMO.md](DEMO.md).

Demo credentials after seeding: every member's password is `demopass123` (e.g. `president@example.test`); invite code `WELCOME-98`.

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
