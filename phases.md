# Fedites — Phased Build Plan (v2)

> Session-by-session plan for building the platform defined in [spec.md](spec.md) (v7) with the 112-feature scope from [mvp.md](mvp.md).
> A **session** = one focused build increment ending in a demo.
>
> **v2:** the web foundation is rebuilt on the standard stack (Next.js + Tailwind + shadcn/ui + TanStack Query); one standard styling; server-first pages with no loaders; design mirrors per [spec.md §3.1](spec.md). Phase 0 re-scaffolds; the Fastify API, data model, and rails carry over intact.

---

## Principles

1. **One session = one demo-able increment.** If you can't show it on a phone at the end of the session, the session was too big or the wrong shape.
2. **Rails before surfaces.** Identity, roles, notifications, and the ledger exist before the features that sit on them.
3. **Walking skeleton early.** By end of Phase 1 a fake member can sign up, get verified, and see an empty-but-real app with all 6 tabs. Everything after fills gaps.
4. **Seed data from day one.** A fake school, 3 sets, all 6 group types, test members per role — every session demos like real life.
5. **Two parallel non-coding tracks** (long lead times — start early):
   - **Payments + WhatsApp business verification** → kick off in Phase 0, or Phase 4 slips.
   - **Content seeding** (yearbooks, houses, history, anthem recordings) → run from Phase 0 to Phase 7.

---

## Phase 0 — Foundations (5 sessions)

| Session | Deliverable | Demo gate |
|---|---|---|
| 0.1 | Standard-stack scaffold: **Next.js 15 (App Router) + Tailwind v4 + shadcn/ui + TanStack Query + zod contracts**, monorepo (Turborepo + pnpm), **Fastify API carried over**, CI (typecheck + test + lint + token + a11y gates), staging deploy, PWA + Expo app shells | Empty app deploys itself on every commit; typed routes compile |
| 0.2 | Data model for the rails: members, sets, roles, groups, activity posts, messages, events, ledger + **config schema and `instance_id` on every table** + migrations + seed script | Seed script populates a fake school |
| 0.3 | Design system: **one standard styling** — Tailwind token layer (colors/radius/spacing/motion as CSS vars), shadcn primitives themed to the Fedites Standard grammar (flat, hairline, radius 0), **color theme presets** (10 curated), dark mode designed together (C3) | Theme preset switches live in-app; dark/light pass AA |
| 0.4 | **Config-driven shell:** nav from schema (mobile tab-bar + Menu sheet · desktop side-rail), config boot at session start, server-first page skeleton with zero loaders, mirror-standard page scaffolds per [spec.md §3.1](spec.md) | Full nav walkthrough on a phone + desktop; menu sheet opens/closes; every page server-renders with data |
| 0.5 | **Platform engineering:** deployment topology doc (nginx + TLS, Next server, Fastify API, Postgres, Redis, MinIO, process manager), **env contract**, security headers + rate limiting, E2E (Playwright) + a11y (axe) + perf budget tooling wired into CI, backup/restore + migration runbook, observability floor (logs + error tracking) | CI runs E2E + a11y + perf on a real deploy; backup restore rehearsed |
| ↳ parallel | Kick off payment provider + Meta/WhatsApp business verification; privacy policy draft | Accounts approved (takes weeks — start now) |

## Phase 1 — Rails (4 sessions)

| Session | Deliverable | Demo gate |
|---|---|---|
| 1.1 | Auth: signup, login, 2FA, sessions | Member account exists securely |
| 1.2 | Verification flow: invitation codes, admin approval queue, set assignment, honorary accounts | New member: code → verified → assigned to Set '98 |
| 1.3 | Profile builder + digital alumni ID v1 + privacy controls v1 + private legacy family linking | Profile + scannable ID card |
| 1.4 | Roles & permissions + **Manage shell** (empty sections) + notification dispatcher v1 (in-app inbox) | Admin sees Manage; a role change sticks |

**Phase gate:** walking skeleton — every tab exists, one real member verified end-to-end, admin can approve and assign roles.

## Phase 2 — Daily Loop (6 sessions — the heart)

| Session | Deliverable | Demo gate |
|---|---|---|
| 2.1 | Group engine core: one group object, 6 types, membership rules, Groups home rows with unseen-activity tags | All 6 group types exist and joinable per rules |
| 2.2 | **Activity tab**: posts, photos, reactions, threaded comments, group polls, media upload | Set '98 runs a full Facebook-groups-style day |
| 2.3 | **Chat**: group chat (realtime: voice notes, media, reply/quote, read receipts, typing indicators), DMs, Chat tab, shared unread counts, pin-to-feed bridge | WhatsApp behavior; badges agree everywhere |
| 2.4 | **News bulletin**: admin composer, unread badge, reactions-only, "discuss in your set group," promote-to-News | Admin posts news; member discusses it in set group |
| 2.5 | **Feed v1**: sources, intent rails v0, melt-into-group with guards, "less from this group" | Scroll slides into Set '98's Activity and back |
| 2.6 | Lightweight in-group admin panel + reports + moderation v1 | Group admin pins, moderates, escalates with audit trail |

**Phase gate:** one set group survives a full week of real activity in-app. First internal beta moment.

## Phase 3 — Belonging (4 sessions)

| Session | Deliverable |
|---|---|
| 3.1 | Events: calendar, create/RSVP, group events badged into Events tab, countdowns |
| 3.2 | Reunion planning suite + QR door check-in + virtual attendance |
| 3.3 | Event photo wall + AI photo finder (**self-search-only** face pipeline) |
| 3.4 | Recognition engine + badges, streaks, founding status + personalization (intent capture, suggestions, tune-my-feed) |

**Phase gate:** plan a mini-reunion end-to-end — event, RSVP, check-in by QR, photos findable by face.

## Phase 4 — Money (4 sessions)

| Session | Deliverable |
|---|---|
| 4.1 | Wallet/ledger core + payment provider integration + multi-currency |
| 4.2 | Dues: collection, polite reminders, receipts, **private status** (member-only + admin-only views) |
| 4.3 | Donations, campaigns, donor wall, confetti, anonymous-giving toggle |
| 4.4 | P2P fundraiser approvals, tribute giving, pledge tracking, reimbursements, sponsorships + transparent ledger view + scholarship administration |

**Phase gate:** treasurer collects dues from 10 test payers and publishes a ledger view — no public dues visibility anywhere.

## Phase 5 — Memory & School (4 sessions)

| Session | Deliverable |
|---|---|
| 5.1 | Media library + Memory Lane shell: throwback archive, yearbook upload + search, on-this-day |
| 5.2 | Wiki, slang dictionary, history timeline |
| 5.3 | Fun bundle: school bell chime, remember-when prompts, recipe exchange, nostalgia radio, anthem player, crest stickers/frames, time capsules, letters to future self |
| 5.4 | School Bridge: wishlist, adopt-a-project, past questions bank, teacher tributes + career: job board, business directory, mentor office hours, referrals |

**Phase gate:** Memory Lane has real digitized content a nostalgic member can spend 20 minutes inside.

## Phase 6 — Governance & Polish (7 sessions)

| Session | Deliverable |
|---|---|
| 6.1 | Elections, motions & resolutions, AGM toolkit, constitution library |
| 6.2 | Full moderation, audit logs, analytics dashboard, data export, integrations |
| 6.3 | Comms: newsletter builder (storable/uploadable templates), email digests, WhatsApp bridge, SMS fallback |
| 6.4 | Craft pass: dark mode, low-bandwidth mode, PWA offline, quiet hours, accessibility, then security review + load test + backup drill |
| 6.5 | **Calls:** external-meeting integration — mentor office hours create/join Google Meet or Zoom links; deep links from the app | One-tap join from mentor booking |
| 6.6 | **Instance settings I:** config editor — color theme presets, terminology glossary, copy tables, feature flags | Admin changes colors/terms; versioned publish + rollback |
| 6.7 | **Instance settings II:** structure toggles (nav labels, menu overflow, catalog order), validation gates, config export/import | A second instance is configured and published safely |

## Phase 7 — Beta & Launch (3–4 sessions)

| Session | Deliverable |
|---|---|
| 7.1 | Private beta with **one set** (20–50 members): feedback loop, fix sprints |
| 7.2 | Real data seeding: yearbooks, houses, history; admin/treasurer training docs; **instance preset library + export/import; "new school in 30 minutes" dress rehearsal** |
| 7.3 | Launch wave-by-set: oldest set first, referral invitation codes open the next set each week |
| 7.4 | Play Store + App Store submissions and review cycles; PWA install prompts tuned | Apps live in both stores |

---

## Session Discipline (every session, no exceptions)

- Migrations in; feature behind a flag if partial; typecheck + tests green; seed/demo data updated; deployed to staging; 2-minute demo script written; changelog updated.
- Never two big subsystems in one session; every session touches at most one new rail.
- Phase gates are UAT checklists run by real humans: an admin, a treasurer, and five members — not just the builder.
- Every component lands in the standard style, reviewed against its design mirror ([spec.md §3.1](spec.md)), in both themes, passing law-gate tests (a11y, performance) — or it doesn't land.

## Totals & Risks

- **Rough total: ~37 build sessions + 2 parallel tracks.**
- **Riskiest external dependencies:** payment provider approval and WhatsApp business verification — start both in Phase 0 or Phase 4 slips.
- **Stack (locked, v7):** Next.js 15 App Router (React 19, RSC) + Tailwind CSS v4 + shadcn/ui (Radix) + TanStack Query + zod contracts (web) · Fastify (Node+TypeScript) API · Expo/React Native (mobile) · PostgreSQL · Redis · WebSockets · external meeting links (Google Meet / Zoom) for calls · MinIO media on VPS. Monorepo: Turborepo + pnpm with shared `packages/contracts`, `packages/config`, `packages/ui`.
- Styling is **one standard system at MVP** (single family, single variant per element, one nav pattern per device) — config-driven so families/variants/patterns scale later without rewrites ([configuration.md](configuration.md)).
- Build order follows spec.md §12: rails → daily loop → belonging → money → memory & school → governance & polish → beta & launch. Every page mirrors its reference app (spec.md §3.1); the Groups home is the one unique surface.
