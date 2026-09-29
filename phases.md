# Fedites — Phased Build Plan

> Session-by-session plan for building the platform defined in [spec.md](spec.md) (v4) with the 116-feature scope from [mvp.md](mvp.md).
> A **session** = one focused build increment ending in a demo.

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

## Phase 0 — Foundations (2–3 sessions)

| Session | Deliverable | Demo gate |
|---|---|---|
| 0.1 | Stack pick + scaffold: PWA + native app shells (Play/App Store), CI, staging deploy, env setup | Empty app deploys itself on every commit |
| 0.2 | Data model for the rails: members, sets, roles, groups, activity posts, messages, events, ledger + migrations + seed script | Seed script populates a fake school |
| 0.3 | Design system: tokens, core components, **6-tab shell** (Groups / Feed / Chat / Events / Menu / Manage — all placeholder) | Full nav walkthrough on a phone |
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
| 3.4 | Recognition engine + badges, streaks, leaderboards, founding status + personalization (intent capture, suggestions, tune-my-feed) |

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
| 5.3 | Fun bundle: trivia, one or two arcade games, remember-when prompts, recipe exchange, nostalgia radio, anthem player, stickers/frames |
| 5.4 | School Bridge: wishlist, adopt-a-project, past questions bank, teacher tributes + career: job board, business directory, mentor office hours, referrals |

**Phase gate:** Memory Lane has real digitized content a nostalgic member can spend 20 minutes inside.

## Phase 6 — Governance & Polish (5 sessions)

| Session | Deliverable |
|---|---|
| 6.1 | Elections, motions & resolutions, AGM toolkit, constitution library |
| 6.2 | Full moderation, audit logs, analytics dashboard, data export, integrations |
| 6.3 | Comms: newsletter builder (storable/uploadable templates), email digests, WhatsApp bridge, SMS fallback |
| 6.4 | Craft pass: dark mode, low-bandwidth mode, PWA offline, quiet hours, accessibility, then security review + load test + backup drill |
| 6.5 | Native audio/video calls (1:1 and group) + mentor office hours integration | Members call in-app |

## Phase 7 — Beta & Launch (3–4 sessions)

| Session | Deliverable |
|---|---|
| 7.1 | Private beta with **one set** (20–50 members): feedback loop, fix sprints |
| 7.2 | Real data seeding: yearbooks, houses, history; admin/treasurer training docs |
| 7.3 | Launch wave-by-set: oldest set first, referral invitation codes open the next set each week |
| 7.4 | Play Store + App Store submissions and review cycles; PWA install prompts tuned | Apps live in both stores |

---

## Session Discipline (every session, no exceptions)

- Migrations in; feature behind a flag if partial; typecheck + tests green; seed/demo data updated; deployed to staging; 2-minute demo script written; changelog updated.
- Never two big subsystems in one session; every session touches at most one new rail.
- Phase gates are UAT checklists run by real humans: an admin, a treasurer, and five members — not just the builder.

## Totals & Risks

- **Rough total: ~29 build sessions + 2 parallel tracks.**
- **Riskiest external dependencies:** payment provider approval and WhatsApp business verification — start both in Phase 0 or Phase 4 slips.
- Build order follows spec.md §12: rails → daily loop → belonging → money → memory & school → governance & polish → beta & launch.
