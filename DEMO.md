# Phase 4 batch 2 demo (Giving)

1. **Campaign** — As president: Manage → Money → create "Science Lab Roof" (goal 500,000).
2. **Give** — As member1 (Menu → Give back): amount, tick "Give anonymously" → Give to this campaign. As member2: give named.
3. **Confirm** — As treasurer: Manage → Money → Awaiting confirmation → Confirm each → receipts issued; recognition points recorded.
4. **Goal + wall** — Campaign page: progress 100%, confetti moment (F6), donor wall shows "Anonymous friend" and "Gozie Member" — names only.
5. **Transparent ledger** — One tap from the campaign: every confirmed gift (dues never appear), per-currency totals, Download CSV.
6. **Recurring** — Member schedules a monthly gift → treasurer run creates the confirmation intent + gentle notice.

---

# Phase 4 batch 1 demo (Ledger + Dues)

1. **Tiers** — As treasurer: Manage → Money → Add tier ("Annual", 20000). Assign tiers to members.
2. **Cycle** — Run cycle (period 2026) → one assessment per verified member; tier amounts override the base.
3. **Pay** — As member1 (Menu → Association): your dues show privately — Pay → "recorded, awaiting treasurer". No other member can see any of it; the public profile leaks nothing (tested).
4. **Mark paid** — As treasurer: Money queue → optional reference → Mark paid → receipt number issued. Member's Association view shows the receipt; open it.
5. **Reminders** — Run reminders → polite in-app notices for overdue only (K5 copy).
6. **Waive** — Treasurer waives an assessment (audited, reversible 30 days).

---

# Phase 3 batch 3 demo (Recognition + Personalization)

1. **Earn** — Post in Set '98 as member1 → Menu → Recognition shows points, the "First words" badge, and your (private) week streak. Comment ten times → "Conversationalist" appears.
2. **Founding** — New signups verified within 30 days of instance creation get "Founding member" automatically; admins can award it manually (audited).
3. **Intents** — Menu → "What brings you here" → pick Network & jobs + Events & reunions → Save → Discovery in Groups home floats matching suggestions.
4. **Classmates rail** — Feed shows "Suggested classmates" (same set, no chat yet) → Say hello opens their profile. Dismiss retires it.
5. **Tune** — On any feed card: "More from this group" — older posts from that group now rank above newer ones elsewhere; "Less" mutes entirely.

---

# Phase 3 batch 2 demo (Photo wall + face finder)

Continuing from batch 1's running app:

1. **Wall** — Open the Mini Reunion as member1 (going) → Add photo (pick any image) → it lands on the wall at 3:2. As member2: Tag → search → pick member1 → member1's inbox shows "tagged you in a photo".
2. **Opt-in** — As member1: Menu → Face search → Turn on → Enroll reference selfie (pick the SAME image file used on the wall).
3. **Find me** — Back on the event wall → Find me → the photo is matched and shown (stub provider: identical bytes match; real face embeddings drop in later).
4. **Self-only + deletion** — As member2: opt in, enroll a DIFFERENT image → Find me returns nothing despite member1's photo existing. As member1: Delete my face data → index gone, finder refuses.

---

# Phase 3 batch 1 demo (Events & Reunions)

```sh
pnpm db:migrate && pnpm db:seed   # seeds the Set '98 Mini Reunion (60 days out) + AGM
pnpm dev
```

1. **Calendar** — Events tab: AGM (30d) and the Set '98 Mini Reunion (60d, badged "Set '98") with countdown chips.
2. **Create** — As president: Create event → school-wide or within a group (members cannot create — §P). Creating inside Set '98 drops an event post into the group Activity.
3. **RSVP** — As member1: open the reunion → Going (optimistic) → the ticket sheet opens with your QR.
4. **Door mode** — As president: open the event → Organizer section → Open door → Scan ticket → point the camera at member1's screen → "Checked in", live counts update. Duplicates flagged; a tampered QR is refused.
5. **Suite** — Add tasks ("Book the DJ", assign), mark done; add budget lines; see the RSVP list with check-in status.
6. **Virtual attendance** — AGM carries a "Join virtually" link (v6.1: external Meet/Zoom; chat via the owning group).

---

# Phase 2 demo script (the daily loop)

```sh
pnpm db:migrate && pnpm db:seed
pnpm dev    # api :8787 (WS on /ws) + web :5173
```

Sign in as any demo member (`demopass123`).

1. **2.1 Groups home** — Home shows My groups with unseen tags; Discover more suggests city chapter (if your profile city is Lagos) and busy interest groups; Propose a group → admin approves it in Manage.
2. **2.2 Activity day in Set '98** — Open Set '98 → post, comment (threaded), react, create a poll and vote. Group admin pins the announcement — it jumps to the top.
3. **2.3 Chat** — Chat tab lists group chats + DMs with previews and unread badges; send a message (appears instantly — optimistic), reply/quote, edit within 15 minutes ("edited"), delete your own. Two browsers: typing indicator + live messages + Seen receipts. Badges on Groups home and Chat agree. Pin a message to the feed → it becomes an Activity post.
4. **2.4 News** — Sign in as president → News icon (top bar) → composer → post with comments off. As a member: reactions work; comments refused; "Discuss this in your set group" jumps to your set group. Promote a standout group post → News shows "From Set '98".
5. **2.5 Feed** — Feed mixes News + group activity, each card shows its source crest; 3+ consecutive items from one group morph the header into that group ("Open group / Back to My Feed"); "Less from this group" mutes; dismiss the rails.
6. **2.6 Moderation** — Report a spammy post; group admin removes it (content archived, audit written); escalate another to school moderators who see it in their queue.

---

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
