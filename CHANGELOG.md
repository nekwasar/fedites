# Changelog

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
