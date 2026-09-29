# Fedites — Design & Engineering Rules

> Strict rules for building the platform in [spec.md](spec.md). Every rule is enforceable and checked at review.
> **[LOCKED]** = user-stated, non-negotiable. **[PROPOSED]** = curated starter selection — trim or amend by ID.
> **DRAFT v1.2 — two-tier split (Platform Law / Family Grammar, §O) and white-label decisions incorporated.**

---

## A. Visual Style & Design Language

**A1. No cards UI.** [LOCKED — Family Grammar: defines the Fedites Classic family]
No rounded boxes, no drop shadows, no elevated surfaces. Content is organized by whitespace, 1px hairlines, and section headers. If a design "needs" a card, it needs a section instead.
*Check: no `box-shadow` or `border-radius` in Classic-family component code; visual review per screen.*
*White-label note: other Style Families (Minimalist, Editorial, later Material/Glassmorphism) may define their own surface treatment — they must pass the Platform Law gates (§O), not this rule.*

**A4. Flat solids only.** [FAMILY GRAMMAR — Fedites Classic default]
No gradients, no glassmorphism, no blur, no textured depth. Colors are solid fills; hierarchy comes from weight, size, and position.
*Check: no `gradient`/`backdrop-filter` in Classic-family code; other families may use elevation/blur only with performance fallbacks and law-gate passes.*

**A5. Radius is a token — 0 is the signature.** [FAMILY GRAMMAR — Fedites Classic default]
Sharp corners (radius 0) are the Classic visual fingerprint; radius moved from law to a theme token so other families can choose soft corners.
*Check: all components use the `--radius` scale token; the Classic preset pins it to 0.*

**A6. Monochrome base + one accent.** [PROPOSED]
Ink-on-paper scheme: near-black on near-white (and inverse for dark), plus exactly one school-derived accent. If a second accent is ever needed, it's a mistake.

**DECIDED:** the accent is **wine red** on a **white** base; all neutrals derive from it.
**White-label note:** color is **not** part of Style Families — it is its own **Color Theme layer** with curated school presets (§O, [configuration.md](configuration.md)); wine red + white is the Fedites default preset.
*Check: palette file contains one accent token; themes validated for AA contrast on publish.*

**A7. Crest identity.** [PROPOSED]
All color derives from the school crest; the crest appears only in mastheads, the digital ID, and empty states — never scattered as decoration.
*Check: design review; crest usage inventory each phase.*

**A11. Strict spacing grid.** [PROPOSED]
All spacing from the 4/8px scale — margins, padding, gaps, heights. No 13px, no 22px, no ad-hoc values.
*Check: tokens only; lint for raw pixel values.*

**A12. Photos are content, never decoration.** [PROPOSED]
Photos appear in galleries, avatars, archives, and event walls only. No hero-image backgrounds, no photo headers.
*Check: visual review; no `background-image` outside media components.*

## B. Typography

**B1. One family + one mono.** [PROPOSED]
A single type family (plus monospace for code/IDs). Hierarchy via weight, size, and case — never a second family.

**DECIDED:** sans-serif family for UI, **monospace for accents** (IDs, money, set years, timestamps).
*Check: font imports limited to two files.*

**B2. Uppercase micro-labels.** [PROPOSED]
Section headers and metadata use uppercase micro-labels with letter-spacing — the institutional/print signature. Body text is always sentence case.
*Check: typography components; no hand-styled uppercase.*

**B4. Locked type scale.** [PROPOSED]
Exactly these sizes: 11 / 13 / 15 / 17 / 22 / 32 / 48. Nothing else ships.
*Check: type tokens only.*

**B6. Tabular numerals.** [PROPOSED]
All counts, money, timestamps, and IDs render in tabular figures so columns align.
*Check: `font-variant-numeric: tabular-nums` on numeric components.*

## C. Color Semantics

**C2. Semantic colors reserved.** [PROPOSED]
Green means success only. Red means destructive/error only. Neither appears decoratively — success states, errors, destructive buttons.
*Check: color usage audit per phase.*

**C3. Light and dark designed together.** [PROPOSED]
Dark mode is not inverted — it's designed simultaneously, both passing contrast. Any new component ships in both.

**DECIDED:** **light-first** at launch; dark available in settings.
*Check: components reviewed in both themes before merge.*

**C5. Never color-only meaning.** [PROPOSED]
Every state (error, success, unread, verified) pairs color with text or icon.
*Check: accessibility review.*

## D. Iconography & Media

**D1. No emojis.** [LOCKED]
No emojis anywhere: UI, buttons, system copy, notifications, emails, empty states. One custom line-icon set, single stroke weight. Member-authored chat content is the only emoji territory.
*Check: lint/copy review; system strings audited.*

**D3. Fixed photo ratios.** [PROPOSED]
1:1 avatars, 3:2 gallery images, 16:9 event banners. No filters, no UI colorization of member photos.
*Check: media components enforce ratios.*

## E. Desktop vs Mobile Structure

**E1. Mobile is the app-first experience.** [LOCKED]
Bottom tabs, single column, actions in thumb zone, designed first. Every feature is designed on mobile before desktop.
*Check: feature branches demo on mobile first.*

**E2. Desktop is more extensive, never a stretched phone.** [LOCKED]
Desktop restructures: 3-pane layouts (list | detail | context), side-rail navigation, dense tables. Same features, different arrangement.
*Check: per-page desktop blueprint exists before build (see phase discipline).*

**E3. Group view split on desktop.** [PROPOSED]
Desktop groups show Activity and Chat side-by-side (WhatsApp Web pattern). Mobile keeps Activity | Chat tabs.
*Check: layout component variants.*

**E5. Navigation restructures, never shrinks.** [PROPOSED]
Desktop: persistent side rail with tab labels + section sub-nav. Mobile: bottom tabs. One `breakpoint` switch, no hamburger-on-desktop.
*Check: nav component.*

**E7. Locked breakpoints.** [PROPOSED]
360 / 768 / 1024 / 1440. Four widths, four layouts. No in-between hacks.
*Check: breakpoint tokens only.*

**E9. Input modality per device.** [PROPOSED]
44px minimum touch targets on mobile; hover states exist on desktop only.
*Check: interaction review.*

**E10. Sheets, not modals, on mobile.** [PROPOSED]
Create/compose flows are full-screen sheets on mobile and anchored panels on desktop. No desktop-style centered modals on phones.
*Check: overlay components.*

**E11. Feature parity.** [PROPOSED]
Same features on both platforms; only density and arrangement differ.
*Check: parity checklist at each phase gate.*

## F. Motion & Micro-interactions

**F1. Micro pushes.** [LOCKED]
Every tappable element responds to press with a fast tactile state: ~100ms scale to 0.97 or darken, plus subtle haptic on key actions (send, check-in, payment). Nothing tappable is dead.
*Check: interactive component base class enforces press state; components without it fail review.*

**F2. Motion budget.** [PROPOSED]
Only `transform` and `opacity` animate, 150–250ms, ease-out. No layout animations, no height/color transitions.
*Check: lint on transition properties.*

**F3. Motion communicates state only.** [PROPOSED]
Zero decorative animation. If it doesn't tell you something changed, it doesn't animate.
*Check: motion review per feature.*

**F5. One signature motion.** [PROPOSED]
The Feed melt-into-group transition is the app's one recognizable move — polish it, protect it, don't dilute it with other showpieces.
*Check: design review.*

**F6. Confetti is earned.** [PROPOSED]
Confetti on payment success and campaign goal completion — nowhere else.
*Check: single confetti component, two call sites.*

**F7. Skeletons, never spinners.** [PROPOSED]
Loading states are layout-shaped skeletons. No spinners except inside buttons.
*Check: loading components.*

**F9. Reduced motion honored.** [PROPOSED]
System reduced-motion preference disables all non-essential animation app-wide.
*Check: media query wired through motion tokens.*

## G. Components & Patterns

**G1. Lists, not cards.** [PROPOSED]
Rows with hairline dividers are the default pattern — groups, chat, directory, events, everything.
*Check: row component reuse.*

**G4. Typographic empty states.** [PROPOSED]
Empty states are a headline, one sentence of invitation, one action button. No illustrations, no images.
*Check: empty-state component.*

**G6. Inline labels.** [PROPOSED]
Form fields always show their label above/on the field — never placeholder-only.
*Check: form components.*

**G7. Tabs only for true siblings.** [PROPOSED]
Activity | Chat qualifies. Anything else (filtering, categories) uses segments or lists.
*Check: component audit.*

**G9. Type-to-confirm destruction.** [PROPOSED]
Destructive actions (archive group, remove admin, ban member) require typing the entity name.
*Check: confirm component.*

**G10. One primary action per screen.** [PROPOSED]
Exactly one filled primary button per view; everything else is secondary/ghost.
*Check: visual review.*

## H. Copy & Voice

**H1. Warm, school-proud, plain.** [PROPOSED]
Voice of an old classmate who writes well. No corporate speak ("utilize," "leverage," "users" — they're members).
*Check: copy review.*

**H2. Sentence case everywhere.** [PROPOSED]
Except the uppercase micro-labels (B2).
*Check: lint on headings.*

**H4. Buttons are verbs.** [PROPOSED]
"Pay dues," "RSVP," "Verify member" — never "Submit," "OK," "Continue."
*Check: copy review.*

**H5. Two-sentence errors.** [PROPOSED]
What happened + what to do next. One sentence each.
*Check: error message inventory.*

## I. Navigation & IA

**I2. Tab order is law.** [PROPOSED]
Groups / Feed / Chat / Events / Menu (+ Manage for role-holders). Never reorders, never grows beyond 6.
*Check: nav component; spec is the source of truth.*

**I4. Search in one gesture.** [PROPOSED]
Universal search reachable from every page with one tap/keystroke; desktop gets Cmd+K.
*Check: layout shell.*

**I5. Badges never lie.** [PROPOSED]
One badge system, one source of truth for unread counts — Groups home and Chat tab always agree.
*Check: unread model tested.*

**I6. Everything deep-links.** [PROPOSED]
Every group, post, message, event, payment has a shareable URL.
*Check: route inventory per phase.*

## J. Attention & Notifications

**J2. Mentions-only default for large groups.** [PROPOSED]
Groups above 50 members default to mentions-only; member can raise it, never the system.
*Check: group defaults.*

**J3. No marketing pushes.** [PROPOSED]
Every push maps to a real event the member cares about (mention, event starting, payment receipt, verified). Zero "come back!" pushes.
*Check: push inventory per feature.*

**J4. Quiet hours are absolute.** [PROPOSED]
Member quiet hours suppress everything. Only a labeled admin emergency broadcast can override, and it says so.
*Check: dispatcher logic tested.*

**J5. Channels have jobs.** [PROPOSED]
Push = urgent personal. Email digest = weekly recap. WhatsApp bridge = News only. SMS = essential fallback. Never cross-purposes.
*Check: dispatcher config.*

## K. Privacy & Trust

**K1. Private by default.** [PROPOSED]
Dues status, family links, contact details, birthday visibility — all private unless the member opens them.
*Check: permission matrix review.*

**K2. No public popularity metrics.** [PROPOSED]
No follower counts, no public like totals, no "most viewed." Reactions are visible as emoji-counts within groups only, never as member league tables of likes.
*Check: no such fields exposed in API.*

**K3. Face features are opt-in per feature.** [PROPOSED]
AI photo finder requires explicit opt-in; any member's face index deletable anytime, taking their data with it.
*Check: consent flags on member record.*

**K5. No dark patterns.** [PROPOSED]
No guilt-trip copy, no fake urgency, no streak-shaming, no confirm-shaming ("No, I hate my classmates"). Declining is always one neutral tap.
*Check: copy review; decline paths tested.*

## L. Performance & Accessibility

**L1. Performance budget.** [PROPOSED]
Interactive under 3s on a mid-range Android over 3G; images lazy-loaded, WebP, sized to layout. Budget checked each phase, not at the end.
*Check: CI performance test.*

**L3. Low-bandwidth mode is real.** [PROPOSED]
A text-first mode: images load only on tap, no auto-playing media. It's a feature, not a fallback.
*Check: flag-tested per phase gate.*

**L5. Accessibility is engineering, not polish.** [PROPOSED]
WCAG AA contrast, full keyboard navigation on desktop, screen-reader labels on every component, focus visible.
*Check: a11y lint + manual pass per feature.*

**L6. Optimistic UI.** [PROPOSED]
Every send, reaction, and RSVP appears instantly and reconciles in background. No interaction waits on the network.
*Check: interaction review.*

## M. Engineering & Code

**M1. Tokens only.** [PROPOSED]
Zero hardcoded colors, spacing, sizes, radii, or durations in component code. Everything references design tokens.
*Check: lint rule.*

**M2. Component library, no one-offs.** [PROPOSED]
Every UI element comes from the internal library. Need something new? Build it into the library first.
*Check: review; duplicate-component lint.*

**M3. Flags on everything incomplete.** [PROPOSED]
Partial features ship dark behind flags; staging demos can enable them, production cannot until done.
*Check: flag registry reviewed per session.*

**M5. Permissions enforced at the API.** [PROPOSED]
Never in the UI alone. The client hiding a button is courtesy; the server refusing is law.
*Check: API tests per role per endpoint.*

**M6. Type safety everywhere.** [PROPOSED]
Strict mode, no `any`, API types generated from one schema source of truth.
*Check: CI typecheck.*

## N. Product Behavior

**N1. Archive, never delete.** [PROPOSED]
Groups and member content are archived (read-only, preserved). Twenty years of set history must never vanish.
*Check: no hard-delete paths in schema.*

**N2. Admin actions reversible 30 days.** [PROPOSED]
Soft-delete window on admin destructive actions, surfaced in audit logs.
*Check: audit + restore flows tested.*

---

## O. Platform Law vs Family Grammar

The app is a white-label template — each school configures its own instance. Rules split into two tiers.

**Platform Law — binds every family and every instance; never configurable:**
Accessibility floors (WCAG AA, 44px targets, keyboard/screen-reader, focus visible) · performance budgets (L1) · press states (F1 — each family implements its own, e.g. ripple counts) · reduced motion (F9) · no emojis (D1) · copy rules (H1–H5) · navigation integrity (I1–I6) · attention rules (J1–J5) · privacy rules (K1–K6) · engineering rules (M1–M6) · product behavior (N1–N2) · API-enforced permissions, audit logs, archive-never-delete. The Studio cannot publish any family, variant, or theme that fails a law gate.

**Family Grammar — per style family, configurable:**
Surface treatment (hairlines vs cards vs glass), elevation, blur, radius, density, icon set, type pairing, motion personality. A1/A4/A5 define the **Fedites Classic** family — the default and signature look. Families ship as versioned packs; every variant must pass the law gates before release.

---

## P. Locked Product Decisions

From the clarification sessions. These are **decided** — they override any conflicting [PROPOSED] rule and bind [spec.md](spec.md).

**Trust & onboarding**
- Signup requires an **invite code from a verified member**.
- Accounts are **limited until 3 setmates identify them** (fallback: **admin override**). Limited = read everything + post in groups; **no DMs, no money features, no event RSVP**.
- Vouching is **invisible after verification** — no names, no counts displayed.

**Privacy**
- Contact details (phone, email) are **private by default**; revealing another member's contacts is a per-person, **logged** action.
- Face search is **self-only** — you can only find photos of yourself.
- Location is **city-level by default**; live location only as a temporary, explicit opt-in at events.
- The **suggestion box is always anonymous**.
- The public web is a **minimal static page** (about + request invite) — no member content is ever public.

**Communication**
- Chat: **delete own messages anytime; edit within 15 minutes** ("edited" shown).
- **Native in-app audio/video calls**, including mentor office hours.
- News comments: **admin-toggled per post** (default off); reactions always on; "discuss in your set group" button when comments are off.
- MVP chat ships with voice notes, photo/video, reply/quote, read receipts, and typing indicators.

**Money & governance**
- Payments: **online gateway + manual "mark as paid"** (cash/offline), all with receipts.
- Donor wall is **named by default**; anonymous toggle per payment.
- **Dues cycle, tiers, and reminders are admin-settable** configuration.
- **All verified members vote**, regardless of dues status.
- **Events are created by admins and group admins only.**
- Emergency broadcast: **any admin, requires second-admin approval**; alternative policies are admin-configurable.

**Content & archives**
- Memory Lane: **members upload, admins approve** into the official archive.
- Memorial pages: **member request + admin approval** (family confirmed by admins).
- Deceased members enter a **memorial state**: content preserved read-only, crest frame, no logins, no birthday pushes.

**Platform**
- Branding is **Fedites-first**; school name/crest appear on profile and ID, not the masthead.
- Distribution: **PWA + native apps in Play Store and App Store**.
- **English only, i18n-ready** strings.
- Digital alumni ID: **in-app proof card** with QR linking to the public profile.
- **No games in MVP**; **leaderboards deferred** (see K2, N2).
- **White-label template product:** one codebase, many instances; `instance_id` on every table; zero instance constants in code (extends M1).
- **Style Families** define structure and style, **never color**: Fedites Classic (default), Minimalist, Editorial at MVP; Brutalist Grid, Soft/Modern, Material-inspired, Glassmorphism post-launch.
- **Color Theme is its own layer** (independent of family) with curated school color presets; wine red + white is the default preset.
- **Navigation geometry is configurable per device** (mobile: tab-bar, top-tabs, hybrid, drawer, floating dock; desktop: side-rail, top-nav, top+side, command-first); nav items stay fixed as a set, geometry moves.
- **Every element has multiple style variants**, grouped into families, with per-element overrides; precedence: element > instance > theme > family > law.
- **The Studio** ships in Phase 6: live preview, draft → preview → publish with versioning/rollback, validation gates, export/import of instance presets.

---

## Enforcement Summary

| Layer | Mechanism |
|---|---|
| Code | Lint rules (A4, A11, B4, D1, F2, M1, M6), component library (M2), tokens (M1) |
| Review | Per-feature checklist: cards? emojis? press state? both themes? a11y? copy? |
| Phase gates | UAT includes rules pass — admin, treasurer, five members walk the flows |
| Spec | rules.md is binding on spec.md; conflicts resolve in favor of rules.md |

**Status: DRAFT v1.** Trim/amend by ID — deletions, additions, or rewording all welcome before this becomes v1.0 binding.
