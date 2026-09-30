# Phase 1 demo script (2 minutes)

Prereqs: `pnpm install`, Postgres running, `.env` set. Then:

```sh
pnpm db:migrate && pnpm db:seed   # fake school, demo members, WELCOME-98 invite code
pnpm dev                          # api :8787 + web :5173
```

Demo members (all: password `demopass123`): `president@example.test`, `treasurer@example.test`, `secretary@example.test`, `moderator@example.test`, `editor@example.test`, `member1..member5@example.test`, `teacher1@example.test` (honorary).

1. **1.1 Account exists securely** — Open the web app on a phone viewport. Sign out if needed → Sign in as `member1@example.test`. Enable 2FA under Menu → Two-factor authentication (add the secret to an authenticator app, confirm the code). Sign out, sign in again — the code is demanded; a wrong code is refused.
2. **1.2 Code → verified → Set '98** — Sign out. Sign in as `president@example.test` → Menu → Invite codes → create one. Sign out → New member tab → enter the code → profile → set year 1998 → create. Sign in as the new member (read-only pending). Sign in as three Set '98 members (`editor@`, `member1@`, `member2@example.test`) — each has an "Identify your setmate" notification → open it → the member is verified at the third confirmation. Or: sign in as president → Manage → Members → open the pending signup → Activate/Verify.
3. **1.3 Profile + ID card** — As the new member: Menu → edit city/profession/memory → save. Menu → Open my ID card → card + QR. Open a classmate's profile → contact is hidden → "Reveal contact details" (tells them + logs it).
4. **1.4 Manage + role change sticks** — As president: Manage tab (shield) appears only for role-holders → Overview stats → Members → pick a member → toggle the secretary role → that member's session immediately gains/loses Manage access and gets a notification. Audit log records the change (reversible 30 days).
