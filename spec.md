# Fedites — Platform Specification (v3)

> Single-school alumni community platform. This document is the master architecture spec.
> Feature scope: the 116 MVP features defined in [mvp.md](mvp.md). Full catalog (162 features) in [features.md](features.md).

---

## 1. Foundation

- **One school, one community.** Fedites serves a single school and its alumni body. A single association container holds every member, set, group, event, and naira. No multi-tenancy complexity.
- **One identity per person.** A verified member record powers the directory, events, chats, payments, and the digital alumni ID. Honorary accounts for teachers/staff.
- **Personalization as a core layer**, not a feature — the app reshapes itself around why each member joined (§3).

## 2. Navigation (role-aware, mobile-first)

**Bottom nav — 5 tabs for everyone, + 1 for role-holders:**

| Tab | What lives there |
|---|---|
| **Home** ("For You") | Personalized feed, reactions & threaded comments, official announcements (pinned), polls, birthday reminders, on-this-day, school news, alumni spotlights, long-form articles, livestreams, confetti moments, civic cards (campaigns, election notices) |
| **Network** | Member directory, global alumni map, alumni near me, people-you-may-know, connections & follows, chapters, interest groups, professional guilds, sports houses, committee workspaces, city ambassadors, business directory, job board, mentor office hours, referrals & endorsements |
| **Explore** | Discovery hub — every space and feature as a card (§6) |
| **Events** | Event calendar, reunion planning suite, my QR ticket, virtual attendance, event photo wall, AI photo finder, anniversary countdowns |
| **Me** | Profile builder, digital alumni ID, private dues status, memberships & roles, badges & streaks, leaderboards, founding member status, time capsules, letters to future self, private legacy family linking, privacy controls, 2FA, quiet hours, dark mode, low-bandwidth mode, language, PWA install, my payments & receipts, suggestion box |
| **Manage** 🔒 | Committee Panel (§5) — visible only to members holding a role |

**Top bar (always):** 💬 Chats (DMs + group chats) · 🔔 Notification center · 🔍 Universal search.

## 3. Personalization Engine ("built for me")

- **Join-intent capture** at onboarding: Reconnect · Network & jobs · Give back to school · Events & reunions · Grow my business · Mentor (multi-select, editable in Me).
- **For You feed** ranks by: your groups → your set → your city → school-wide, then intent rails (networker sees jobs/business first; nostalgic sees Memory Lane & on-this-day; giver sees campaign progress; event-seeker sees countdowns).
- **Smart defaults:** auto-join your set group and sports house on day one, suggested city chapter, set reunion pre-pinned in Events. Nobody starts in an empty app.
- **Personal moments:** QR ticket surfaces event morning, pledge progress on campaigns you gave to, time-capsule reminders, birthday prompts only for your set/close connections.
- **Always tunable:** "tune my feed" more/less controls, per-category notification preferences with quiet hours, per-group notification defaults (big groups default to mentions-only).
- **Explore ranks by intent** — curated order, never an encyclopedic wall.

## 4. Groups Architecture (one engine, many flavors)

All groups are **one group object** with a type — never six separate products:

| Type | Created by | Joining | Modules |
|---|---|---|---|
| **Set group** (year group) | System, auto per set | Auto-join on verification | Chat, set events, set fundraising |
| **Geographic chapter** | Admin | One-tap; auto-suggested by city | Chat, city meetups, chapter dues |
| **Interest group** | Member proposal → admin approval | Open join | Chat, forums, gallery, casual events |
| **Professional guild** | Member proposal | Request to join | Chat, jobs focus, mentor hours, referrals |
| **Sports house** | System (legacy houses seeded) | Auto-assigned | Chat, inter-house competitions, standings |
| **Committee workspace** | Exec, direct | Invite-only | Chat, task board, files, minutes, deadlines |

- **Shell + pluggable modules:** always-on = profile, members & roles, chat, pinned announcements, polls, member list; toggleable = events, gallery, files, dues, fundraising, task board, join queue.
- **Lifecycle:** proposal → approval (committees skip) → "Start here" post + intro thread on join → activity pulse on every card so nobody joins ghost towns → inactivity nudge → **archive (read-only), never delete**.
- **Group admins** get the lightweight Manage panel inside their group only (approve, moderate, pin, create events).
- **Wired into the rails:** group events → Events tab (badged), group fundraising → school ledger, moderation escalates to association moderators with audit trail.

## 5. Manage — Committee Panel (role-holders only, in-app)

One gated tab, sections matching duties:

| Section | Contains |
|---|---|
| **Overview** | Admin dashboard — pending approvals, quick stats, today's tasks |
| **Members** | Verification queue, invitation codes, roles & permissions, honorary membership, membership tiers, set assignment, private dues status |
| **Moderation** | Report queue, mutes/bans, audit trail |
| **Money** | Dues & reminders, donations, campaigns, P2P approvals, tribute giving, pledge tracking, ledger publishing, scholarships, reimbursements, sponsorships, multi-currency |
| **Events** | Reunion planning suite (budgets, tasks, RSVPs), QR door mode, live counts, virtual attendance setup |
| **Speak** | Announcements composer (→ WhatsApp bridge), newsletter builder (storable/uploadable templates), email digests, SMS fallback |
| **Govern** | Elections setup, motions & resolutions, AGM toolkit (quorum, agenda, proxies, minutes), constitution library |
| **Content** | Spotlight scheduling, yearbook/memory-lane uploads, wishlist & adopt-a-project management, internship approvals |
| **Oversight** | Analytics dashboard, audit logs, data export, integrations (Mailchimp, Zapier, accounting) |

## 6. Explore — Discovery Engine

Every feature as a card, grouped by time:

- **🟢 Present** — chats, forums, groups, directory, business directory, job board, mentor office hours, livestreams
- **🟡 Past / Memory Lane** — throwback archive, yearbook, history timeline, wiki, slang dictionary, media library, trivia, games arcade, fantasy leagues, remember-when threads, recipe exchange, nostalgia radio, anthem player, crest stickers, hall of fame, memorial pages, condolence coordination
- **🔵 Future** — events, reunion suite, countdowns, time capsules, letters to future self
- **🟣 People** — chapters, guilds, houses, ambassadors
- **🟠 Association** — dues, donate, campaigns, scholarships, ledger, constitution, suggestion box
- **🏫 School Bridge** — wishlist, adopt-a-project, student mentorship, career day, internship pipeline, past questions, teacher tributes, facility booking, records verification

**Discovery mechanics:** first-run tour (5 swipe cards) · empty states as billboards · universal search finds features ("yearbook" jumps to the space) · onboarding survey pins relevant cards to Home · "feature of the week" in announcements and email digest footer.

## 7. Money & Participation Without Pressure

- **No public dues badge anywhere.** Dues status is **private** — the member sees only their own in Me; admins see it only in Manage → Members (filterable, audit-logged). Tiers still carry real perks: voting rights, event priority, digital ID marking.
- **Giving is celebrated, opt-in:** confetti + recognition points + donor wall, with an **anonymous-giving toggle** on every payment.
- **Outcomes loop back into the feed:** wishlist items fulfilled and adopt-a-project progress posts show members their money becoming a renovated lab — the retention engine.
- **Transparent ledger** browsable by all members, one tap from every campaign.
- **Polite multi-channel reminders:** push → WhatsApp bridge → SMS fallback, respecting quiet hours.
- **Low-friction civic entry:** one-tap polls and suggestion box on Home.

## 8. The Seven Shared Rails

1. **One identity** — a single member record powers directory, events, chats, payments, digital ID.
2. **One notification center** — one inbox; push, email digest, WhatsApp bridge, and SMS fallback are channels the same message routes through. Quiet hours apply globally.
3. **One universal search** — people, posts, events, groups, wiki, yearbook names, past questions, and feature names from a single bar.
4. **One media library** — feed photos, event walls, yearbook scans, newsletters draw from the same organized store.
5. **One wallet/ledger** — dues, donations, sponsorships, reimbursements all write to one ledger; the transparent ledger is a filtered view.
6. **One recognition engine** — badges, streaks, leaderboards, founding status all read the same activity points.
7. **One moderation & privacy layer** — the same reporting, visibility, and admin tools apply to every surface.

**Golden rule:** no feature ships unless it (a) uses the shared identity, (b) emits an activity event into the feed/notification rails, and (c) respects privacy settings.

## 9. Connective Flows (features feeding features)

- **Announcement posted** → auto-mirrors to WhatsApp bridge → drops into the weekly email digest → pushes to mentioned members → pins on Home.
- **Event created** → calendar + pinned in group chat + countdown starts + QR tickets issued; afterwards the photo wall feeds AI photo finder, and on-this-day resurfaces it next year.
- **Payment lands** → instant receipt + ledger entry + donor wall + confetti + recognition points.
- **Newsletter builder** pulls top feed content; templates storable and uploadable.
- **One face engine** indexes both event walls and the throwback archive.

## 10. Onboarding & Progressive Disclosure

- **Day 0:** verify → profile → set assignment → auto-join set group & sports house → join-intent capture → first-run tour → land in your set chat.
- **Week 1:** feed, directory, DMs.
- **Ongoing:** groups, events, dues.
- **Earned/unlocked:** badges, arcade.
- **Elected:** Manage tab appears for role-holders.
- Explore remains the permanent catalog for everything else.

## 11. Build Order (each slice shippable)

1. **Rails:** auth, verification, profiles, sets, roles, notification dispatcher, admin shell.
2. **Daily loop:** feed, reactions, comments, DMs, group chats, directory, announcements.
3. **Belonging:** groups engine (all 6 types), events core (calendar, reunion suite, QR check-in), badges.
4. **Money:** dues, donations, campaigns, wallet/ledger, multi-currency.
5. **Memory & school:** Memory Lane, School Bridge, jobs, mentor hours.
6. **Governance & polish:** elections, AGM toolkit, full moderation, analytics, PWA, dark mode, low-bandwidth.

## 12. MVP Coverage Check

| MVP section (mvp.md) | Where it lives |
|---|---|
| 1 Identity & Verification (8) | Onboarding + Me + Manage→Members |
| 2 Networking & Careers (10) | Network + Explore |
| 3 Communication (10) | Home/Chats + Manage→Speak |
| 4 Feed, Content & Memory (13) | Home + Explore→Memory Lane |
| 5 Events & Reunions (6) | Events tab + Manage→Events |
| 6 Groups & Chapters (6) | Groups engine (§4) |
| 7 Money & Giving (11) | Home cards + Explore + Manage→Money |
| 8 Governance & Admin (12) | Manage panel (+ member-facing constitution & suggestion box) |
| 9 The School Bridge (10) | Explore→School Bridge + Manage→Content |
| 10 Milestones & Recognition (10) | Me + Home + Events |
| 12 Fun & Nostalgia (11) | Explore→Memory Lane + system-wide touches |
| 13 Comfort, Trust & Craft (9) | Me settings + platform defaults |

**Excluded by design:** all of §11 (Care, Welfare & Support), §§14–15 (Growth & Platform, Marketplace), and every struck item from mvp.md — no Telegram bridge, no stories, no podcast & video channel, no merchandise store, no auctions & raffles, no investment club, no group savings circles, no welfare fund, no milestone celebrations, no legacy admission registry, no retired teachers' welfare, no digital business cards, no anonymous salary insights, no mentorship matching, no auto-translation, no public dues badge.
