# Fedites — Platform Specification (v6)

> Single-school alumni community platform. Master architecture spec.
> Feature scope: the 112 MVP features in [mvp.md](mvp.md). Full catalog (162) in [features.md](features.md).
>
> **v4 changelog:** navigation reworked — Groups is now the home page; Feed is a separate personalized scroll; Chat is its own tab; Menu replaces Explore/Network/Me; every group has Activity | Chat tabs; no global member feed.
> **v5 changelog:** clarification decisions locked — trust-based onboarding (invite code + 3-setmate vouching, limited accounts), native in-app calls, admin-settable governance, games & leaderboards removed, plus ~25 behavioral decisions recorded in [rules.md §P](rules.md) (binding).
> **v6 changelog:** white-label template architecture — Style Families (structure/style, never color), Color Theme as its own layer with school presets, configurable navigation geometry per device, per-element style variants, the Studio, and the Platform Law vs Family Grammar split. Full catalog in [configuration.md](configuration.md).
> **v6.1 changelog:** calls redirected to external meeting links (Meet/Zoom) — native WebRTC removed from scope. Tech stack locked: React+Vite web, Expo mobile, Node/TypeScript backend.

---

## 1. Foundation

- **One school, one community.** Fedites serves a single school and its alumni body. One association container holds every member, set, group, event, and naira. No multi-tenancy complexity.
- **One identity per person.** A verified member record powers the directory, events, chats, payments, and the digital alumni ID. Honorary accounts for teachers/staff.
- **No global member feed.** Members never post "school-wide." All member-generated content lives inside groups. The only school-wide channel is **News**, posted by school/alumni admins. This concentrates activity in groups instead of spreading it thin.
- **Trust-based onboarding.** Signup requires an invite code from a verified member. Accounts stay limited — read + group posts only, no DMs, money, or RSVPs — until 3 setmates identify the member or an admin overrides. Vouching is invisible once verified.
- **Template, not a bespoke app.** Fedites is a white-label product: every school deploys a fully configured instance. All branding, structure, and behavior live in instance config (§15) — zero school-specific values in code.

## 2. Content Model (three layers)

| Layer | Who posts | Nature | Lives in |
|---|---|---|---|
| **News bulletin** | School + alumni admins only | Permanent, searchable, high-signal; comments toggled per post by admins (default off), reactions always on, "discuss this in your set group" button when comments are off; admins may **promote a standout group post into News** with source attribution | News page (top-bar icon) + cards in Feed |
| **Group Activity** | Group members | Permanent, searchable Facebook-groups-style feed: posts, photos, polls, events, files, reactions, threaded comments | Inside each group → **Activity** tab |
| **Group Chat** | Group members | Ephemeral WhatsApp-style rolling conversation | Inside each group → **Chat** tab; also a row in the Chat tab |

**Bridges:** chat message → **"Pin to feed"** (worth keeping becomes an Activity post). Group Activity post → admin **"Promote to News"**.

## 3. Navigation (5 tabs + Manage, mobile-first)

| Tab | Job | Icon |
|---|---|---|
| **Groups** *(home)* | All your spaces + discovery | 🏘️ |
| **Feed** | Personalized latest activity; slides into group feeds | 📰 |
| **Chat** | WhatsApp-style: group chats + private chats | 💬 |
| **Events** | Calendar, countdowns, my QR ticket | 📅 |
| **Menu** | Profile, settings, directory, full feature catalog | ☰ |
| **Manage** 🔒 | Committee Panel — role-holders only | 🛡️ |

**Top bar (all pages):** 🔍 universal search · 📰 News (unread badge) · 🔔 notification center.

Each page has one clear job: **Groups = spaces · Feed = content · Chat = conversations · Events = time · Menu = self & catalog · Manage = duty.**

## 4. Page Specifications

### 4.1 Groups (home)
- **Adaptive by membership density.**
  - **New users** → "Find your people": auto-joined set group + sports house at top, then suggested city chapter, trending interest groups (each card shows an **activity pulse** — posts this week, member count — so nobody joins ghost towns), browse by type.
  - **Established users** → **"My groups"**: one row per group — crest · name · **unseen-activity tags** (💬 12 · 🆕 5 new · 📷 12 new photos) · timestamp. Pinned groups first, then sorted by latest unseen activity.
- **"Discover more"** remains as a compact segment — discovery shrinks as the list fills, never disappears.
- Key rule: a group exists in two places — its row here (the **space**, with activity tags) and its row in Chat (the **conversation**, chat previews only). Same thread, two doors, one shared unread count.

### 4.2 Feed
- **Sources:** official News + your groups' activity + group content you're permitted to see. Never a leaky global feed.
- **Order:** personalized — your groups → your set → your city → school-wide; **intent rails** pinned at top (jobs/business for networkers, countdowns for event-seekers, campaign progress for givers, Memory Lane/on-this-day for the nostalgic, "suggested classmates" for new users — rails retire once used or dismissed).
- **The slide-into-group mechanism:** scrolling a run of items from one group morphs the feed into that group's **Activity** tab — header becomes the group name, a pill shows *"You're browsing Set '98's activity · [Open group] [Back to My Feed]"*, and scrolling continues seamlessly. Every card always shows its source group crest.
- **Guardrails:** visibility-filtered per viewer (committee workspaces never appear unless you're a member) · "less from this group" mute controls · melt triggers only on groups.
- **Effect:** drives group joins instead of replacing them.

### 4.3 Chat
- **Rows: group chats + private DMs only.** Last-message preview, unread badge, timestamp, pinned chats, new-chat FAB. Pure WhatsApp mental model.
- **Message rules:** delete own messages anytime; edit within 15 minutes ("edited" shown).
- **Calls:** external-meeting links (Google Meet / Zoom) generated in-app for mentor office hours and committee meetings; one tap joins. Native WebRTC calls are out of MVP scope.
- Group chat header tap → jumps into the full group space (Activity | Chat tabs).
- Unread counts are shared with the Groups home rows — badges never disagree.

### 4.4 Inside every group — two tabs
- **Activity** = permanent, searchable feed (posts, photos, polls, events, files, reactions, threaded comments).
- **Chat** = ephemeral WhatsApp-style stream.
- **Pin-to-feed bridge:** a chat message worth keeping is pinned into Activity. Chat dies in scroll; Activity endures.

### 4.5 Events
- Unified calendar, reunion planning suite, anniversary countdowns, my QR ticket, virtual attendance, event photo wall, AI photo finder. Group-owned events appear here badged with their group crest.
- **Events are created by admins and group admins only.** Live location sharing is a temporary, explicit opt-in at events; everywhere else, location is city-level only.

### 4.6 Menu
- **Profile card at top** (photo, name, set, digital ID, roles) — then settings — then the **full feature catalog grid**:
  - **Memory Lane:** throwback archive, yearbook, history timeline, wiki, slang dictionary, media library, remember-when threads, recipe exchange, nostalgia radio, anthem player, crest stickers, hall of fame, memorial pages, condolence coordination
  - **School Bridge:** wishlist, adopt-a-project, student mentorship, career day, internship pipeline, past questions bank, teacher tributes, facility booking, records verification
  - **Association:** dues status (private), donate, campaigns, transparent ledger, constitution library, suggestion box (always anonymous)
  - **People:** member directory, global alumni map, alumni near me, people-you-may-know, connections, business directory, job board, mentor office hours, referrals & endorsements, city ambassadors
  - **Recognition:** badges & streaks, founding member status, time capsules, letters to future self
  - **Settings:** privacy controls, 2FA, quiet hours, dark mode, low-bandwidth mode, language, PWA install, my payments & receipts, private legacy family linking

## 5. Personalization Engine ("built for me")

- **Join-intent capture** at onboarding: Reconnect · Network & jobs · Give back to school · Events & reunions · Grow my business · Mentor (multi-select, editable in Menu).
- The engine powers three small, explainable things — no black box:
  1. **Feed ordering** (your groups → set → city → school-wide, plus intent rails).
  2. **Groups home sorting** (pinned + latest unseen activity) and **suggested groups** (intent + city + activity pulse).
  3. **Menu/Explore card ranking** by intent and activity.
- **Smart defaults:** auto-join set group + sports house on day one; suggested city chapter; set reunion pre-pinned in Events. Nobody starts in an empty app.
- **Personal moments:** QR ticket surfaces event morning, pledge progress on campaigns you gave to, time-capsule reminders, birthday prompts only for your set/close connections.
- **Always tunable:** "tune my feed" more/less controls, per-category notification preferences with quiet hours, per-group notification defaults (big groups = mentions-only).

## 6. Groups Architecture (one engine, many flavors)

All groups are **one group object** with a type — never six separate products:

| Type | Created by | Joining | Modules |
|---|---|---|---|
| **Set group** (year group) | System, auto per set | Auto-join on verification | Activity, Chat, set events, set fundraising |
| **Geographic chapter** | Admin | One-tap; auto-suggested by city | Activity, Chat, city meetups, chapter dues |
| **Interest group** | Member proposal → admin approval | Open join | Activity, Chat, gallery, casual events |
| **Professional guild** | Member proposal | Request to join | Activity, Chat, jobs focus, mentor hours, referrals |
| **Sports house** | System (legacy houses seeded) | Auto-assigned | Activity, Chat, inter-house competitions, standings |
| **Committee workspace** | Exec, direct | Invite-only, private | Activity, Chat, task board, files, minutes, deadlines |

- **Anatomy:** always-on = group profile (name, crest, banner), members & roles, **Activity tab**, **Chat tab**, pinned announcements, polls, member list. Toggleable modules per type: events, gallery, files, dues, fundraising, task board, join-request queue.
- **Lifecycle:** proposal → approval (committees skip) → "Start here" post + intro thread on join → activity pulse on every card → inactivity nudge → **archive (read-only), never delete**.
- **Group admins** get the lightweight Manage panel inside their group only (approve, moderate, pin, promote-to-news, create events).
- **Wired into the rails:** group events → Events tab (badged), group fundraising → school ledger, moderation escalates to school moderators with audit trail.

## 7. Manage — Committee Panel (role-holders only, in-app)

One gated tab, sections matching duties:

| Section | Contains |
|---|---|
| **Overview** | Admin dashboard — pending approvals, quick stats, today's tasks |
| **Members** | Verification queue, invitation codes, roles & permissions, honorary membership, membership tiers, set assignment, private dues status |
| **Moderation** | Report queue, mutes/bans, audit trail |
| **Money** | Dues & reminders, donations, campaigns, P2P approvals, tribute giving, pledge tracking, ledger publishing, scholarships, reimbursements, sponsorships, multi-currency |
| **Events** | Reunion planning suite (budgets, tasks, RSVPs), QR door mode, live counts, virtual attendance setup |
| **Speak** | News composer (→ WhatsApp bridge, email digest, SMS fallback), newsletter builder (storable/uploadable templates), promote group post → News |
| **Govern** | Elections setup, motions & resolutions, AGM toolkit (quorum, agenda, proxies, minutes), constitution library. **All verified members can vote**, regardless of dues status |
| **Content** | Spotlight scheduling, yearbook/Memory Lane uploads, wishlist & adopt-a-project management, internship approvals |
| **Oversight** | Analytics dashboard, audit logs, data export, integrations (Mailchimp, Zapier, accounting) |
| **Settings** | Dues cycle & tiers config, emergency broadcast policy (any admin + second-admin approval by default, configurable), contact-reveal audit view |
| **Studio** | The customization workbench: color themes, style families, nav patterns, element variants, terminology, copy tables, feature flags — with live preview, publish/versioning, export/import (§15) |

## 8. Money & Participation Without Pressure

- **No public dues badge anywhere.** Dues status is **private** — the member sees only their own (Menu → Association); admins see it only in Manage → Members (filterable, audit-logged). Tiers still carry real perks: voting rights, event priority, digital ID marking.
- **Giving is celebrated, opt-in:** confetti + recognition points + donor wall, with an **anonymous-giving toggle** on every payment.
- **Outcomes loop back into the Feed:** wishlist items fulfilled and adopt-a-project progress posts show members their money becoming a renovated lab — the retention engine.
- **Transparent ledger** browsable by all members, one tap from every campaign.
- **Dues cycle, tiers, and reminders are admin-settable** configuration. Payments accept the **online gateway plus manual "mark as paid"** for cash/offline, every payment receipted.
- **Donor wall is named by default**; the anonymous toggle remains per payment.
- **Polite multi-channel reminders:** push → WhatsApp bridge → SMS fallback, respecting quiet hours.
- **Low-friction civic entry:** one-tap polls and suggestion box in Menu; campaign and election cards appear in Feed and News.

## 9. The Seven Shared Rails

1. **One identity** — a single member record powers directory, events, chats, payments, digital ID.
2. **One notification center** — one inbox; push, email digest, WhatsApp bridge, SMS fallback are channels the same message routes through. Quiet hours apply globally.
3. **One universal search** — people, group Activity posts, chats, events, groups, wiki, yearbook names, past questions, News, and feature names from a single bar.
4. **One media library** — Feed photos, group galleries, event walls, yearbook scans, newsletters draw from the same organized store.
5. **One wallet/ledger** — dues, donations, sponsorships, reimbursements all write to one ledger; the transparent ledger is a filtered view.
6. **One recognition engine** — badges, streaks, leaderboards, founding status all read the same activity points.
7. **One moderation & privacy layer** — the same reporting, visibility, and admin tools apply to every surface, including the Feed's visibility filter.

**Golden rule:** no feature ships unless it (a) uses the shared identity, (b) emits an activity event into the notification rails (and Group Activity where it belongs), and (c) respects privacy settings.

## 10. Connective Flows (features feeding features)

- **News posted** → auto-mirrors to WhatsApp bridge → drops into weekly email digest → pushes to mentioned members → appears as a Feed card and News unread badge.
- **Group post promoted** → appears in News with source attribution → members tap through into the group (discovery).
- **Chat message pinned** → becomes an Activity post → searchable forever.
- **Event created** → calendar + group Activity post + countdown starts + QR tickets issued; afterwards the photo wall feeds AI photo finder, and on-this-day resurfaces it next year.
- **Payment lands** → instant receipt + ledger entry + donor wall + confetti + recognition points.
- **Feed melt** → scrolling one group's items morphs into its Activity tab → tap "Open group" → join-if-not-member → group discovery loop.
- **Newsletter builder** pulls top News + group Activity content; templates storable and uploadable.
- **One face engine** indexes event walls, group galleries, and the throwback archive.

## 11. Onboarding & Progressive Disclosure

- **Day 0:** verify → profile → set assignment → auto-join set group & sports house → join-intent capture → first-run tour (one card per tab) → **land on Groups home** with your set group and house already at the top.
- **Probation (limited accounts):** read everything, post in groups; DMs, money features, and event RSVP unlock after **3 setmates identify** the member or an **admin override**. Vouching leaves no public trace.
- **Verification UX:** invite-code entry → profile → set claim → vouching requests go to setmates in-app.
- **Week 1:** Chat, Feed, suggested-classmates rail, city-chapter suggestion.
- **Ongoing:** join groups from Discover, RSVP events, pay dues.
- **Earned/unlocked:** badges, arcade.
- **Elected:** Manage tab appears for role-holders.
- Menu remains the permanent catalog for everything else.

## 12. Build Order (each slice shippable)

1. **Rails:** auth, verification (invite codes + vouching), profiles, sets, roles, notification dispatcher, admin shell, **config service + instance_id schema**.
2. **Daily loop:** groups engine (all 6 types, Activity + Chat tabs), Chat tab, DMs, News bulletin, Feed v1 (sources + melt), Groups home.
3. **Belonging:** events core (calendar, reunion suite, QR check-in), badges, personalization (intent rails, suggestions).
4. **Money:** dues, donations, campaigns, wallet/ledger, multi-currency.
5. **Memory & school:** Memory Lane, School Bridge, jobs, mentor hours.
6. **Governance & polish:** elections, AGM toolkit, full moderation, analytics, PWA, dark mode, low-bandwidth, **the Studio (§15)**.

## 13. MVP Coverage Check

| MVP section (mvp.md) | Where it lives |
|---|---|
| 1 Identity & Verification (8) | Onboarding + Menu (profile, ID, privacy) + Manage→Members |
| 2 Networking & Careers (10) | Menu→People + Feed intent rails + chapter/ambassador flows |
| 3 Communication (10) | Chat tab + group Chat tabs + forums (threaded Activity in groups) + Manage→Speak |
| 4 Feed, Content & Memory (13) | Feed + group Activity + News bulletin + Menu→Memory Lane |
| 5 Events & Reunions (6) | Events tab + Manage→Events |
| 6 Groups & Chapters (6) | Groups home + groups engine (§6) |
| 7 Money & Giving (11) | Menu→Association + Feed/News cards + Manage→Money |
| 8 Governance & Admin (12) | Manage panel (+ member-facing constitution & suggestion box in Menu) |
| 9 The School Bridge (10) | Menu→School Bridge + Manage→Content |
| 10 Milestones & Recognition (9) | Menu→Recognition + Feed moments + Events |
| 12 Fun & Nostalgia (8) | Menu→Memory Lane + system-wide touches |
| 13 Comfort, Trust & Craft (9) | Menu→Settings + platform defaults |

**Excluded by design:** all of §11 (Care, Welfare & Support), §§14–15 (Growth & Platform, Marketplace), and every struck item from mvp.md — no Telegram bridge, no stories, no podcast & video channel, no merchandise store, no auctions & raffles, no investment club, no group savings circles, no welfare fund, no milestone celebrations, no legacy admission registry, no retired teachers' welfare, no digital business cards, no anonymous salary insights, no mentorship matching, no auto-translation, no public dues badge, **no global member feed**, no games (trivia, arcade, fantasy leagues), no leaderboards.

## 14. Locked Decisions Register

All behavioral decisions from the clarification sessions are recorded in [rules.md §P](rules.md) and are **binding** on this spec: invite-code signup with 3-setmate vouching (read + group posts until vouched, invisible after), self-only face search, city-level location with event opt-in, logged contact reveals, admin-toggled news comments, chat delete-anytime/edit-15-minutes, native in-app calls, online + manual payments, named-by-default donor wall, admin-settable dues cycle & emergency policy, all-verified voting, admin/group-admin event creation, always-anonymous suggestion box, member-upload archives with admin approval, memorial state for deceased members, Fedites-first branding, PWA + app-store distribution, English i18n-ready, in-app alumni ID, no games, no leaderboards.

## 15. White-Label & Configuration

Fedites ships as a reusable template — any school, anywhere, anytime.

- **Config stack (precedence):** element overrides > instance overrides > **Color Theme** > **Style Family** > Platform Law.
- **Color Theme is its own layer** — never part of a family. Curated presets of popular school color combinations (wine red + white is the Fedites default), plus custom palettes gated by contrast validation.
- **Style Families** define structure and style — surfaces, radius, density, icons, type pairing, motion, element defaults — **never color**. MVP: **Fedites Classic** (flat, sharp, hairline — the signature look), **Minimalist**, **Editorial**. Roadmap: Brutalist Grid, Soft/Modern, Material-inspired, Glassmorphism.
- **Navigation geometry is configurable per device** — mobile: tab-bar, top-tabs, hybrid, drawer, floating dock; desktop: side-rail, top-nav, top+side, command-first. Items stay; geometry moves.
- **Every element has multiple style variants** (nav bars, buttons, modals, toasts, tabs, badges, icons, tables, and more), grouped into families, with per-element overrides.
- **Platform Law stays fixed for every family and instance:** accessibility floors, performance budgets, press states, no emojis, copy/privacy/navigation rules, API-enforced permissions, archive-never-delete.
- **The Studio** (Manage area): live preview in device frames, draft → preview → publish with versioning and rollback, validation gates that refuse to publish a11y/performance failures, terminology glossary, copy tables, feature flags, and export/import of full instance presets.
- Full catalog and schemas: [configuration.md](configuration.md).
