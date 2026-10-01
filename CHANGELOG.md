# Changelog

## Phase 5 — Memory & School, batch 1: Memory Lane core (complete)

### Session 5.1
- Throwback archive: era-organized (admin eras CRUD), year/caption metadata; member uploads pending until admin approval (§P); admin multi-file BULK upload in one request (enterprise seeding path).
- Yearbook digitization: per-year books, scanned covers, CSV name import (bulk, hundreds of names), name/section search.
- On this day: approved memories + group posts from this month/day in past years resurface.
- Hall of fame: admin-curated honourees with citations, member-linked or standalone.
- Memorial pages (§P locked): member request → admin approval (family confirmed) → memorial state (no logins, sessions revoked, no birthday pushes, content read-only); condolence book + funeral attendance coordination; moderation via archived (N1).
- Migration 0011; PG suite phase5-memory.pg.test.ts (6 tests). Fixed @fastify/multipart encapsulation (top-level registration, onFile buffer pattern).

## Phase 5 — Memory & School, batch 2: Knowledge & Voices (complete)

### Session 5.2
- School wiki: collaborative pages (slug-addressed, searchable), every save a revision, full revision history, revert-to-earlier (new revision — nothing lost, N1), admin page locks.
- Slang dictionary: member submissions pending → admin approval into the crowd-sourced glossary; searchable.
- History timeline: admin-curated milestones, chronological.
- Alumni spotlights: admin-published interview features celebrating members.
- Long-form articles: member-written (essays, memoirs, tributes) with admin screening before publication.
- Migration 0012; PG suite phase5-knowledge.pg.test.ts (6 tests).

## Phase 4 — Money, batch 1: Ledger + Dues (complete)

### Sessions 4.1 + 4.2
- One wallet/ledger (rail 5): ledger_entries gains status (pending/confirmed/voided — voided kept, N1), gateway reference, per-instance receipt numbers (RCPT-YYYY-NNNNNN), anonymous toggle (batch 2), entered-by, assessment link.
- Payment gateway abstraction (like the face provider): MANUAL gateway ships first — §P-mandated "mark as paid" for cash/offline with treasurer confirmation; Paystack/Flutterwave/Stripe adapters throw "not configured" until PAYMENT_PROVIDER + keys exist.
- Dues: admin-settable cycle → assessments per verified member (per-tier amounts override the base); member view strictly private (own only); admin views filterable and coarsely audit-logged; NO public dues data on any profile endpoint (tested).
- Mark paid (treasurer): confirms intent → ledger entry + receipt; waive audited with 30-day window (N2); polite reminders (K5 copy, quiet-hours-ready, J4/J5) for overdue only.
- Tiers: treasurer CRUD (annual/one-time etc., perks: voting/event-priority/id-marking), member assignment audited; digital alumni ID now carries tier marking (§8 real perk).
- instance.currency config slot (template default NGN) + multi-currency ledger rows stay un-merged per currency.
- Migration 0008; PG suite phase4-money.pg.test.ts (8 tests).

## Phase 4 — Money, batch 2: Giving (complete)

### Session 4.3
- Campaigns: duty-created (title/goal/deadline), live progress bars, close; goal completion records an F6 marker — the confetti moment (single component, transform/opacity only, reduced-motion honored).
- Donations: one-time toward a campaign or the community, anonymous toggle per payment (§P); intents confirmed by the treasurer via a Manage queue → one-ledger entries + receipts + recognition points (spec §8: giving is celebrated).
- Donor wall: named by default, anonymous respected, names only — no amounts, no league tables (K2).
- Transparent ledger: member-browsable view of confirmed non-private entries (dues NEVER appear — tested), per-currency totals, downloadable CSV (mvp §7).
- Recurring giving: monthly/quarterly/annually schedules produce polite confirmation intents + notices (manual-gateway consistent, never auto-charges).
- Feed: "Campaign progress" rail (spec §4.2 giver rail), dismissible.
- Migration 0009; PG suite phase4-giving.pg.test.ts (5 tests).

## Phase 4 — Money, batch 3: Structured Giving (complete)

### Session 4.4
- P2P fundraisers: member proposals go through an admin approval gate (audit-logged) before any money flows; approved fundraisers collect through the same intent→confirm pipeline; ledger rows carry p2p attribution.
- Pledge tracking: members record promised contributions (private — K5); overdue pledges get one polite in-app nudge per 30 days (never public); fulfilment rides the intent→confirm flow.
- Reimbursements: members submit claims with receipt uploads; treasurer approves → negative (money-out) ledger row, receipted + audited (N2).
- Sponsorships: duty-recorded sponsors with tiered recognition (bronze/silver/gold); confirmation receipts into the ledger; member-visible sponsor list (mvp §7 portal).
- Scholarships: endow → members apply for students → screen → select → disburse (ledger row + audit); disburse-before-select refused.
- Ledger publishing: treasurer publishes per-period snapshots (per-currency totals + counts) visible to members.
- Tribute giving: donations in memory/honor of someone — metadata rides intent→ledger memo ("In memory of …").
- Migration 0010; PG suite phase4-structured.pg.test.ts (7 tests).

## Phase 3 — Belonging, batch 1: Events & Reunions (complete)

### Sessions 3.1 + 3.2
- Unified calendar: upcoming/past, countdown chips, group events badged with the group name (spec §4.5).
- Creation by admins and group admins only (§P, enforced at the API with the event.create policy); school-wide and group-owned events.
- §2 bridge: creating a group event posts `kind: 'event'` into the group Activity + realtime ping.
- RSVP going/maybe/no with optimistic UI (L6); limited accounts refused until verified (§P).
- My QR ticket: deterministic per (event, member) secret (only the hash stored), HMAC-signed self-contained QR payload — re-issues stay stable.
- QR door mode: organizer opens/closes, scans with the camera (jsQR), tampered signatures and wrong-event tickets refused, duplicates flagged, live counts (going/maybe/checked-in).
- Reunion planning suite (organizers only): tasks with assignee/due/done, budget lines (planned), RSVP list with check-in status.
- Virtual attendance: organizer-set external meeting/livestream link (v6.1 — no native WebRTC) + live chat via the owning group.
- Anniversary flag for recurring reunion countdowns. No live location in this batch (permitted, not required).
- Migration `0004_events.sql`; PG suite `phase3-events.pg.test.ts` (permission matrix, §P RSVP refusal, ticket/check-in flow incl. tampering, suite, badges/bridge).

## Phase 3 — Belonging, batch 2: Photo Wall + AI Photo Finder (complete)

### Session 3.3
- Event photo wall: attendees (going/maybe/checked-in) upload images; 3:2 fixed ratio (D3); tags with member search land an inbox notice; photos reportable; archived not deleted (N1).
- Face engine (rail): pluggable provider interface — STUB ships first (deterministic content-hash embeddings; honest limitation: matches identical/near-identical bytes only, not faces). Real providers (insightface sidecar / cloud API) drop in via FACE_PROVIDER env without touching callers.
- K3 consent gates enforced at the API (M5): opt-in required before enrollment or search; the whole face index is deletable anytime — opt-out wipes every row (§P self-search-only by construction: the search key is always the caller's own reference embedding).
- Provider-version check: a provider change requires re-enrollment (409).
- Flags: events.photoWall + events.faceFinder; migration 0005; PG suite phase3-photos.pg.test.ts (5 tests).

## Phase 3 — Belonging, batch 3: Recognition + Personalization (complete)

### Session 3.4
- One recognition engine (rail 6): a single activity-points ledger feeds badges, streaks, and founding status. Points: post 5, comment 2, photo 5, check-in 10, RSVP 1, verified 20.
- Badges: verified, founding member, first words, conversationalist (10 comments), shutterbug (10 photos), event-goer (3 check-ins). Thresholds evaluated on the ledger; manual admin awards duty-gated + audited (N2).
- Founding member status: auto on verification within 30 days of instance creation; admin-awardable for late pioneers.
- Weekly streaks: private to the member (K5 — no shaming, no push nagging), shown in Menu alongside points. K2: public profiles show badge titles only — never points or league tables.
- Personalization (spec §5): join-intent capture (six options, multi-select, editable in Menu) boosts matching discovery suggestions; "Suggested classmates" rail (same-set, no DM yet) dismissible like all rails; tune-my-feed "More from this group" affinity (+12h rank boost per level, capped) alongside "Less from this group"; per-category notification preferences (mentions/events/news) stored and dispatcher-ready under absolute quiet hours (J4).
- Migration 0006; PG suite phase3-recognition.pg.test.ts (6 tests).

## Phase 2 — Daily Loop (complete)

### Session 2.1 — Group engine core
- One group object, six types (set/chapter/interest/guild/house/committee); joining rules per spec §6 enforced at the API: chapter + interest one-tap, guild request → group-admin approval, committee invite-only, set/house auto-assigned.
- Creation lifecycle: interest/guild start as `proposed` → duty-admin approval; committees skip; chapters are admin-created. Archive (read-only) never delete (N1).
- Groups home: adaptive density ("Find your people" vs "My groups"), unseen-activity tags (messages/posts/photos) from the one `thread_reads` watermark table, pinned-first + latest-unseen ordering, discovery with activity pulse (posts this week, member count) and city-chapter suggestion (§4.1).
- J2: groups ≥ 50 members default to mentions-only notifications.

### Session 2.2 — Activity tab
- Posts, photos, files, polls (one vote per member, counts within the group — K2), threaded comments, reactions (emoji-counts, toggling, no league tables — K2).
- Media library (rail 4): upload endpoint (25 MB cap) + authenticated serving; local-disk store now, MinIO swap later.
- Pinned announcements (group admins); archived groups read-only.

### Session 2.3 — Chat (realtime)
- Group chats + DMs; WebSockets hub with session-token auth, rooms (group / dm pair / personal), reconnect with backoff, pre-auth frame buffering + `ready` signal.
- Reply/quote, read receipts (watermark + live broadcast), typing indicators (ephemeral, never stored), edit within admin-settable window ("edited" shown), delete own anytime (tombstone).
- Pin-to-feed bridge: chat message → Activity post, linked both ways.
- I5: single unread implementation shared by Chat tab and Groups home — badges agree (tested).

### Session 2.4 — News bulletin
- Admin-only composer; comments admin-toggled per post (default off, refused server-side); reactions always on; "Discuss this in your set group" data when off; group post → promote-to-News with source attribution + audit.

### Session 2.5 — Feed v1
- Sources: News + your groups' activity; every card carries its source group; ordering explainable, newest-first; committee content only for members; feed-muted groups drop out ("Less from this group").
- Intent rails v0: countdowns + suggested groups; dismissal retires the rail (stored per member).
- Melt-into-group (F5 signature motion): 3+ consecutive same-group items morph the header into that group's space with the Open group / Back to My Feed pill.

### Session 2.6 — Group admin + moderation v1
- Reports (exactly one target); group admins + school moderators act; remove-content archives (reversible via undo within 30 days — N2); escalation to school moderators; every action audit-logged.

## Phase 1 — Rails (complete)

### Session 1.1 — Auth
- Signup with invite code (creates `pending` account), login (email + password, optional TOTP), logout, sessions (hashed tokens, HttpOnly cookie, 30-day, revocable), 2FA setup/enable/disable (RFC 6238 TOTP, zero deps), scrypt password hashing, rate limiting on auth endpoints.
- Migrations `0002_identity_rails.sql`: auth columns, sessions, family_links.

### Session 1.2 — Verification flow
- Invitation codes: verified members create codes (90-day expiry), used-once.
- Admin approval queue: pending signups → activate (limited) / verify (override) / honorary / reject (type-to-confirm on the client).
- Set claiming at signup; admin can correct the set in the queue.
- Setmate vouching: verified setmates get in-app "identify" requests; at 3 confirmations the member is verified automatically. Vouching leaves no public trace (§P).
- Rejection/decisions are audit-logged with a 30-day reversal window (N2).

### Session 1.3 — Profile, ID, privacy
- Profile builder (city, profession, bio, favorite memory) — PATCH /v1/me.
- Digital alumni ID v1: proof card + QR linking to the in-app profile; QR painted with currentColor so the family/theme skins it.
- Privacy v1: contact details private by default; revealing another member's contacts is a per-person, audit-logged action that notifies the owner (§P/K1).
- Private legacy family linking: add/remove relatives by email; visible only to the member.

### Session 1.4 — Roles, Manage, notifications
- Role-based permissions: president/treasurer/secretary/moderator/editor/member; assignments/removals audit-logged and reversible 30 days; role changes notify the member.
- Manage shell (role-gated): Overview stats + Members section (queue, decisions, roles editor); remaining sections are honest "opens in its build phase" states (M3).
- Notification dispatcher v1: one in-app inbox (rail 2); kinds for verification, roles, contact reveals; unread badge in the top bar.
- Policy engine extended: `pending` accounts are read-only; limited accounts can read + post in groups only (§P, M5).

### Parallel track
- Payments provider + WhatsApp business verification + privacy policy draft: external, still to kick off (phases.md).

## Phase 0 — Foundations (complete)
- Monorepo scaffold (Turborepo + pnpm), CI with staging deploy, rails data model (`instance_id` everywhere), config engine with law gates, design tokens, config-driven nav shell (5 mobile + 4 desktop patterns), Studio preview scaffolding, PWA + Expo shells.
