# Changelog

## Phase 1 — Rails (in progress)

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
