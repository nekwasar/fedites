/**
 * Fedites web shell — config-driven, variant-driven, theme-driven.
 * The session boot payload is the single source: color theme (light/dark),
 * style family (radius/density/surface/fonts), and the resolved element
 * variants (configuration.md §5). The UiProvider hands them to the library;
 * screens compose library components only (M1/M2 — no raw values).
 * Mobile-first (E1); desktop restructures (E2/E5). Landing (§P public web)
 * for signed-out visitors with the mobile-only install sheet.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { applyTheme, applyFamily, UiProvider, type UiConfig } from "@fedites/ui";
import { themePresets, families, mobilePatterns, desktopPatterns, type NavPatternId, type Inbox, type VerificationStatus, type Invite, type IdCard, type MemberPublic, type ManageOverview } from "@fedites/config";
import type { AppProps, BootState } from "./page-types.js";
import { parseRoute } from "./router.js";
import { Api, ApiError } from "./api.js";
import { AuthScreen } from "./screens/AuthScreen.js";
import { InboxScreen, Empty } from "./screens/InboxScreen.js";
import { ProfileScreen } from "./screens/ProfileScreen.js";
import { IdScreen } from "./screens/IdScreen.js";
import { MemberScreen } from "./screens/MemberScreen.js";
import { ManageScreen } from "./screens/ManageScreen.js";
import {
  MobileTabBar, MobileTopTabs, MobileHybrid, MobileDrawer, MobileFloatingDock,
  DesktopSideRail, DesktopTopNav, DesktopTopSide, DesktopCommandFirst,
} from "./shell/nav-patterns.js";
import { GroupsHomeScreen, type GroupsHomeData } from "./screens/GroupsHomeScreen.js";
import type { NewsResponse, FeedResponse, ChatMessage, ChatThread, GroupProfile, ActivityFeed } from "./phase2-types.js";
import type { EventListItem, EventTask, BudgetItem, JobRow, CampaignView, DonorWall, TransparentLedger, DonationSchedule, MoneyOverview } from "./events-types.js";
import type { MemorySsrData } from "./screens/MemoryLane.js";
import type { KnowledgeSsrData } from "./screens/Knowledge.js";
import type { NostalgiaSsrData } from "./screens/Nostalgia.js";
import type { BridgeSsrData } from "./screens/SchoolBridge.js";
import type { ProfileSsrData } from "./screens/ProfileScreen.js";
import { GroupScreen } from "./screens/GroupScreen.js";
import { ChatThreadScreen } from "./screens/ChatThread.js";
import { ChatListScreen } from "./screens/ChatScreen.js";
import { NewsScreen, FeedScreen } from "./screens/NewsFeed.js";
import { EventsScreen, EventDetailScreen } from "./screens/EventsScreen.js";
import { GivingSection, CampaignScreen, TransparentLedgerScreen } from "./screens/Giving.js";
import { MemoryLaneScreen } from "./screens/MemoryLane.js";
import { KnowledgeScreen } from "./screens/Knowledge.js";
import { NostalgiaScreen } from "./screens/Nostalgia.js";
import { SchoolBridgeScreen } from "./screens/SchoolBridge.js";
import { CareerScreen } from "./screens/Career.js";
import { useRealtime } from "./realtime.js";
import { LandingScreen, AppChoiceSheet } from "./screens/Landing.js";
import { Icon } from "@fedites/ui";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const DESKTOP_MIN = 1024;

/** Studio preview: desktop + admin only. A docked slide-over that PUSHES
 *  content (never overlaps chrome). Device frames preview from here. */
function StudioDock({
  boot, device, onDevice, onPattern, onTheme, onFamily, canPreview, open, onClose,
}: {
  boot: BootState;
  device: "mobile" | "desktop";
  onDevice: (d: "mobile" | "desktop") => void;
  onPattern: (p: NavPatternId) => void;
  onTheme: (id: string) => void;
  onFamily: (id: (typeof families)[number]["id"]) => void;
  canPreview: boolean;
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  if (!canPreview) return null;
  if (!boot.session.config.instance.flags.some((f) => f.key === "demo.previewSession" && f.enabled)) return null;
  if (!open) {
    return (
      <button type="button" className="studio-tab press" aria-label="Open Studio preview" onClick={onClose}>
        Studio
      </button>
    );
  }
  const segStyle: React.CSSProperties = { minHeight: 44, width: "100%", textAlign: "left", cursor: "pointer", padding: "0 var(--space-3)", border: "var(--hairline) solid var(--hairline-color)", background: "var(--c-base)", font: "var(--weight-medium) var(--type-body2) var(--font-ui)", color: "var(--c-base-contrast)" };
  const segStyleActive = (on: boolean): React.CSSProperties => ({
    ...segStyle,
    background: on ? "var(--c-accent)" : "var(--c-base)",
    color: on ? "var(--c-accent-contrast)" : "var(--c-base-contrast)",
  });
  return (
    <aside className="studio-dock" aria-label="Studio preview">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "var(--space-3)" }}>
        <span className="micro">Studio preview</span>
        <button type="button" className="btn btn--underline-link press" onClick={onClose}>Close</button>
      </div>
      <p className="micro" style={{ margin: "0 0 var(--space-3)" }}>{boot.session.config.instance.copy["preview.banner"]}</p>
      <div className="micro" style={{ paddingBottom: 4 }}>Device frame</div>
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        {(["mobile", "desktop"] as const).map((d) => (
          <button key={d} type="button" className="press" onClick={() => onDevice(d)} style={{ ...segStyleActive(device === d), width: "auto", flex: 1 }}>
            {d}
          </button>
        ))}
      </div>
      <div className="micro" style={{ paddingBottom: 4 }}>Nav pattern</div>
      <div style={{ display: "grid", gap: "var(--space-1)", marginBottom: "var(--space-3)" }}>
        {(device === "mobile" ? mobilePatterns : desktopPatterns).map((p) => (
          <button key={p} type="button" className="press" onClick={() => onPattern(p)} style={segStyle}>{p}</button>
        ))}
      </div>
      <div className="micro" style={{ paddingBottom: 4 }}>Color theme</div>
      <div style={{ display: "grid", gap: "var(--space-1)", marginBottom: "var(--space-3)" }}>
        {themePresets.map((t) => (
          <button key={t.id} type="button" className="press" onClick={() => onTheme(t.id)} aria-label={`Theme ${t.name}`} style={{ ...segStyle, display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, background: t.light.accent, border: "var(--hairline) solid var(--hairline-color)", display: "inline-block" }} />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      <div className="micro" style={{ paddingBottom: 4 }}>Style family</div>
      <div style={{ display: "grid", gap: "var(--space-1)" }}>
        {families.map((f) => (
          <button key={f.id} type="button" className="press" onClick={() => onFamily(f.id)} style={segStyle}>{f.name}</button>
        ))}
      </div>
    </aside>
  );
}

function NewProposal({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const [name, setName] = useState("");
  const [type, setType] = useState<"chapter" | "interest" | "guild" | "committee">("interest");
  const [done, setDone] = useState<string | null>(null);
  return (
    <main className="screen-pad" style={{ maxWidth: 480 }}>
      <h1 className="screen-title">Propose a group</h1>
      {done !== null ? (
        <Empty title="Proposal sent" body={`Status: ${done}. Admins review new proposals.`} action={<button type="button" className="btn btn--filled press" onClick={() => onNavigate("/")}>Back to Groups</button>} />
      ) : (
        <div style={{ padding: "0 var(--density-pad-x)" }}>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
            {(["interest", "guild", "chapter", "committee"] as const).map((t) => (
              <button key={t} type="button" className="press" onClick={() => setType(t)} aria-pressed={type === t}
                style={{ minHeight: "var(--tap)", padding: "0 var(--space-3)", cursor: "pointer", border: "var(--hairline) solid var(--hairline-color)", background: type === t ? "var(--c-accent)" : "var(--c-base)", color: type === t ? "var(--c-accent-contrast)" : "var(--c-base-contrast)", font: "var(--weight-medium) var(--type-body2) var(--font-ui)" }}>
                {t}
              </button>
            ))}
          </div>
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" aria-label="Group name"
            style={{ width: "100%", minHeight: "var(--tap)", border: "none", borderBottom: "var(--hairline) solid var(--hairline-color)", background: "transparent", font: "var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)" }}
          />
          <button type="button" className="btn btn--filled press" style={{ marginTop: "var(--space-3)" }} disabled={name.trim().length < 2}
            onClick={() => void Api.createGroup({ type, name }).then((r) => setDone(r.status))}>
            Submit proposal
          </button>
        </div>
      )}
    </main>
  );
}

/** App props — the Fastify server renders every page with boot, chrome and
 *  screen data already resolved; navigation is real document navigation. */
export default function App({ boot, member, unread: initialUnread, routeData, ssrPath, ssrDevice }: AppProps): React.ReactElement {
  const [unread, setUnread] = useState(initialUnread);
  const [dark, setDark] = useState(
    typeof window !== "undefined" && window.localStorage.getItem("fedites.dark") === "1",
  );
  const [studioOpen, setStudioOpen] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">(
    ssrDevice ?? (typeof window !== "undefined" && window.innerWidth < DESKTOP_MIN ? "mobile" : "desktop"),
  );
  // Hydrate with the server's device guess, then correct pre-paint from the
  // real viewport (layout effect never paints the wrong frame).
  const IsoLayout = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
  IsoLayout(() => {
    if (typeof window === "undefined") return;
    const real: "mobile" | "desktop" = window.innerWidth < DESKTOP_MIN ? "mobile" : "desktop";
    setDevice(real);
  }, []);
  // Keep the device frame in sync with viewport changes (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = (): void => setDevice(window.innerWidth < DESKTOP_MIN ? "mobile" : "desktop");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const realtime = useRealtime(API_URL, member !== null, member !== null ? ["member:" + member.id] : []);
  const [newsUnread, setNewsUnread] = useState(0);
  const [overrides, setOverrides] = useState<{
    themeId?: string;
    familyId?: string;
    mobilePattern?: (typeof mobilePatterns)[number];
    desktopPattern?: (typeof desktopPatterns)[number];
  }>({});

  // Route is derived once per document; navigation is a real page load.
  const route = useMemo(
    () => parseRoute(typeof window !== "undefined" ? window.location.pathname : ssrPath ?? "/"),
    [ssrPath],
  );

  // Full-page navigation: every link is a server request; the server
  // renders the complete next page (data included). No client routing.
  const go = useCallback((to: string): void => {
    if (to === "__drawer") { setStudioOpen(true); return; }
    if (typeof window !== "undefined") window.location.assign(to);
  }, []);

  const refreshUnread = useCallback((): void => {
    if (member === null) { setUnread(0); return; }
    Api.inbox().then((i) => setUnread(i.unread)).catch(() => undefined);
  }, [member]);

  // Realtime (2.3): WS events wake the UI; counts always come from the API
  // (I5 — badges never disagree). A "news.new" bumps the News badge.
  useEffect(() => {
    if (realtime === null) return;
    if (realtime.type === "news.new") setNewsUnread((n) => n + 1);
    if (realtime.type === "message.new" || realtime.type === "read") refreshUnread();
    if (realtime.type === "post.new") refreshUnread();
  }, [realtime, refreshUnread]);

  // Theme + family application (0.3 gate), now dark-aware (C3).
  useEffect(() => {
    if (!boot) return;
    window.localStorage.setItem("fedites.dark", dark ? "1" : "0");
    const preset =
      overrides.themeId !== undefined
        ? themePresets.find((t) => t.id === overrides.themeId) ?? null
        : null;
    if (preset !== null) {
      applyTheme(document.documentElement, dark ? preset.dark : preset.light);
    } else {
      applyTheme(document.documentElement, (dark ? boot.session.resolved.themeDark : boot.session.resolved.theme) as Parameters<typeof applyTheme>[1]);
    }
    const family =
      overrides.familyId !== undefined
        ? families.find((f) => f.id === overrides.familyId)
        : boot.session.resolved.family;
    if (family) applyFamily(document.documentElement, family);
  }, [boot, overrides, dark]);

  const uiConfig: UiConfig = useMemo(() => {
    const family = boot.session.resolved.family;
    return {
      variants: boot.session.resolved.variants as Record<string, string>,
      density: family.density,
      surface: family.surface,
      press: family.press,
    };
  }, [boot]);

  const nav = boot.session.config.nav;
  const effNav = {
    ...nav,
    mobile: overrides.mobilePattern ?? nav.mobile,
    desktop: overrides.desktopPattern ?? nav.desktop,
  };
  const isDesktopViewport = device === "desktop";
  const pattern = (isDesktopViewport ? effNav.desktop : effNav.mobile);
  const items = boot.navItems;
  const contentMargin =
    isDesktopViewport && (pattern === "side-rail" || pattern === "top+side") ? 220 : 0;
  const studioWidth = studioOpen && isDesktopViewport ? 300 : 0;
  const topOffset = pattern === "top-tabs" || pattern === "top-nav" || pattern === "top+side" ? 48 : 0;

  const authed = member !== null;
  const dutyRoles = authed && member.roles.some((r) => r !== "member");

  const screen = (): React.ReactElement => {
    if (route.path === "/auth") {
      return authed
        ? <Empty title="You are signed in" body="Your account is active on this device." action={<button type="button" className="btn btn--filled press" onClick={() => go("/")}>Go home</button>} />
        : <AuthScreen onDone={() => go("/")} />;
    }
    if (!authed) {
      return (
        <Empty
          title="Sign in to continue"
          body="This area needs a member account. New here? You will need an invite code."
          action={<button type="button" className="btn btn--filled press" onClick={() => go("/auth")}>Sign in or join</button>}
        />
      );
    }
    switch (route.path) {
      case "/": return <GroupsHomeScreen onNavigate={go} ssrData={routeData.home as GroupsHomeData} />;
      case "/feed": return <FeedScreen onNavigate={go} ssrData={{ feed: (routeData.feed as { feed?: FeedResponse } | undefined)?.feed }} />;
      case "/chat": {
        const chatList = routeData["chat.list"] as { threads?: { threads: ChatThread[] }; presence?: { online: string[] } } | undefined;
        return <ChatListScreen config={boot.session.config.chatPage} onNavigate={go} ssrData={{ threads: chatList?.threads?.threads, presence: chatList?.presence }} />;
      }
      case "/news": return <NewsScreen signedIn={authed} onNavigate={go} ssrData={{ news: (routeData.news as { news?: NewsResponse } | undefined)?.news }} />;
      case "/groups": {
        const groupData = routeData.group as { profile?: GroupProfile; activity?: ActivityFeed; requests?: { requests: Array<{ id: string; display_name: string }> } } | undefined;
        return route.param !== undefined
          ? <GroupScreen groupId={route.param} onNavigate={go} signedIn={authed} onOpenChat={(g) => go(`/chats/group/${g}`)} ssrData={groupData} />
          : <Empty title="Group not found" body="The link may be wrong." />;
      }
      case "/chats": {
        const threadData = routeData["chat.thread"] as { messages?: { messages: ChatMessage[] } } | undefined;
        return route.param !== undefined && route.path === "/chats"
          ? <ChatThreadScreen type={(route.seg === "dm" ? "dm" : "group")} id={route.param} onNavigate={go} ssrData={{ messages: threadData?.messages }} />
          : <ChatListScreen config={boot.session.config.chatPage} onNavigate={go} />;
      }
      case "/groups/new": return <NewProposal onNavigate={go} />;
      case "/money/campaigns": {
        const givingData = routeData.giving as { campaigns?: { campaigns: CampaignView[] }; schedules?: { schedules: DonationSchedule[] }; overview?: MoneyOverview } | undefined;
        const campaignData = routeData.campaign as { campaigns?: { campaigns: CampaignView[] }; wall?: DonorWall } | undefined;
        return route.param !== undefined && route.path === "/money/campaigns"
          ? <CampaignScreen campaignId={route.param} onNavigate={go} ssrData={campaignData} />
          : <GivingSection ssrData={givingData} />;
      }
      case "/money/ledger": return <TransparentLedgerScreen ssrData={{ ledger: (routeData.ledger as { ledger?: TransparentLedger } | undefined)?.ledger }} />;
      case "/memory": return <MemoryLaneScreen member={member} ssrData={routeData.memory as MemorySsrData} />;
      case "/knowledge": return <KnowledgeScreen ssrData={routeData.knowledge as KnowledgeSsrData} />;
      case "/nostalgia": return <NostalgiaScreen ssrData={routeData.nostalgia as NostalgiaSsrData} />;
      case "/bridge":
        return <SchoolBridgeScreen isAdmin={member.roles.some((r) => ["president", "treasurer", "secretary", "moderator"].includes(r))} ssrData={routeData.bridge as BridgeSsrData} />;
      case "/careers": {
        const careerData = routeData.career as { jobs?: { jobs: JobRow[] }; saved?: { jobs: Array<{ id: string; title: string; company_name: string }> }; applications?: { applications: Array<{ id: string; title: string; companyName: string; status: string; createdAt: string }> } } | undefined;
        return <CareerScreen careersConfig={boot.session.config.careersPage} ssrData={{ jobs: careerData?.jobs?.jobs, saved: careerData?.saved?.jobs, apps: careerData?.applications?.applications }} />;
      }
      case "/notifications": return <InboxScreen onNavigate={go} ssrData={{ inbox: (routeData.inbox as { inbox?: Inbox | undefined } | undefined)?.inbox }} />;
      case "/me": {
        const profileData = routeData.profile as { status?: VerificationStatus; invites?: { invites: Invite[] }; recognition?: NonNullable<ProfileSsrData["recognition"]>; intents?: { intents: string[]; options: string[] }; prefs?: { prefs: { mentions: string; events: string; news: string } } } | undefined;
        return <ProfileScreen member={member} onNavigate={go} dark={dark} onDark={setDark} ssrData={profileData} />;
      }
      case "/id": return <IdScreen ssrData={{ card: (routeData.id as { card?: IdCard } | undefined)?.card }} />;
      case "/members": {
        const memberData = routeData.member as { member?: MemberPublic; badges?: { badges: Array<{ badge: string; title: string; awardedAt: string }> } } | undefined;
        return route.param !== undefined ? <MemberScreen id={route.param} ssrData={memberData} /> : <Empty title="Member not found" body="The link may be wrong." />;
      }
      case "/manage": return dutyRoles ? <ManageScreen member={member} onNavigate={go} ssrData={{ overview: (routeData.manage as { overview?: ManageOverview } | undefined)?.overview }} /> : <Empty title="Admins only" body="The Manage panel is for role-holders." />;
      case "/menu": {
        const profileData2 = routeData.profile as { status?: VerificationStatus; invites?: { invites: Invite[] }; recognition?: NonNullable<ProfileSsrData["recognition"]>; intents?: { intents: string[]; options: string[] }; prefs?: { prefs: { mentions: string; events: string; news: string } } } | undefined;
        return <ProfileScreen member={member} onNavigate={go} dark={dark} onDark={setDark} ssrData={profileData2} />;
      }
      case "/events": {
        const eventData = routeData.event as { event?: EventListItem; tasks?: { tasks: EventTask[]; budget: BudgetItem[] }; attendees?: { attendees: Array<{ memberId: string; name: string; response: string; checkedIn: boolean }> }; live?: { counts: { going: number; maybe: number; checkedIn: number }; checkInOpen: boolean } } | undefined;
        return route.param !== undefined && route.path === "/events"
          ? <EventDetailScreen eventId={route.param} onNavigate={go} member={member} ssrData={{ event: eventData?.event, tasks: eventData?.tasks, attendees: eventData?.attendees, live: eventData?.live }} />
          : <EventsScreen onNavigate={go} isAdmin={authed && member.roles.some((r) => ["president", "treasurer", "secretary", "moderator"].includes(r))} ssrData={{ events: (routeData.events as { events?: { upcoming: EventListItem[]; past: EventListItem[] } } | undefined)?.events }} />;
      }
      default: return <GroupsHomeScreen onNavigate={go} />;
    }
  };

  if (!authed) {
    return (
      <UiProvider value={uiConfig}>
        <LandingScreen
          boot={{
            brand: boot.session.config.instance.shortName,
            about: boot.session.config.instance.copy["landing.about"] ?? "One school, one community. Reconnect, belong, and give back.",
          }}
          onSignedIn={(pending) => go(pending === "/" ? "/" : pending)}
        />
        <AppChoiceSheet />
      </UiProvider>
    );
  }

  const patterns: Record<string, React.ReactElement> = {
    "tab-bar": <MobileTabBar items={items} route={route.path} onNavigate={go} />,
    "top-tabs": <MobileTopTabs items={items} route={route.path} onNavigate={go} />,
    hybrid: <MobileHybrid items={items} route={route.path} onNavigate={go} />,
    drawer: <MobileDrawer items={items} route={route.path} onNavigate={go} open={studioOpen} onClose={() => setStudioOpen(false)} />,
    "floating-dock": <MobileFloatingDock items={items} route={route.path} onNavigate={go} />,
    "side-rail": <DesktopSideRail items={items} route={route.path} onNavigate={go} />,
    "top-nav": <DesktopTopNav items={items} route={route.path} onNavigate={go} />,
    "top+side": <DesktopTopSide items={items} route={route.path} onNavigate={go} />,
    "command-first": <DesktopCommandFirst items={items} route={route.path} onNavigate={go} />,
  };

  return (
    <UiProvider value={uiConfig}>
      <header className="masthead" style={{ marginLeft: contentMargin, marginTop: pattern === "top-nav" || pattern === "top+side" ? 56 : 0, marginRight: studioWidth, position: "relative" }}>
        <span
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "var(--space-3)" }}
          onClick={() => go("/")}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") go("/"); }}
        >
          <span className="crest-block" aria-hidden="true">{boot.session.config.instance.shortName.slice(0, 1)}</span>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span>{boot.session.config.instance.shortName}</span>
            <span className="masthead-sub">alumni community</span>
          </span>
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <button type="button" className="press" aria-label="News" onClick={() => { setNewsUnread(0); go("/news"); }} style={{ position: "relative", minHeight: "var(--tap)", minWidth: "var(--tap)", background: "transparent", border: "none", cursor: "pointer", color: "var(--c-base-contrast)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="news" size={22} />
            {newsUnread > 0 && (
              <span className="badge tabular" style={{ position: "absolute", top: 4, right: 4, padding: "1px 5px" }}>{newsUnread}</span>
            )}
          </button>
          <button type="button" className="press" aria-label="Notifications" onClick={() => go("/notifications")} style={{ position: "relative", minHeight: "var(--tap)", minWidth: "var(--tap)", background: "transparent", border: "none", cursor: "pointer", color: "var(--c-base-contrast)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="bell" size={22} />
            {unread > 0 && (
              <span className="badge tabular" style={{ position: "absolute", top: 4, right: 4, padding: "1px 5px" }}>{unread}</span>
            )}
          </button>
          <button type="button" className="press" aria-label="Your profile" onClick={() => go("/me")} style={{ minHeight: "var(--tap)", minWidth: "var(--tap)", background: "transparent", border: "none", cursor: "pointer", color: "var(--c-accent)" }}>
            <span className="avatar avatar--circled">{member.displayName.slice(0, 1)}</span>
          </button>
        </span>
      </header>
      <div style={{ marginLeft: contentMargin, marginTop: topOffset, marginRight: studioWidth }}>
        <div className="content screen-pad">
          {screen()}
        </div>
      </div>
      {patterns[pattern]}
      <StudioDock
        boot={boot}
        canPreview={dutyRoles && isDesktopViewport}
        device={device ?? (isDesktopViewport ? "desktop" : "mobile")}
        onDevice={setDevice}
        onPattern={(p) => {
          if ((mobilePatterns as readonly string[]).includes(p)) setOverrides((o) => ({ ...o, mobilePattern: p as (typeof mobilePatterns)[number] }));
          if ((desktopPatterns as readonly string[]).includes(p)) setOverrides((o) => ({ ...o, desktopPattern: p as (typeof desktopPatterns)[number] }));
        }}
        onTheme={(id) => setOverrides((o) => ({ ...o, themeId: id }))}
        onFamily={(id) => setOverrides((o) => ({ ...o, familyId: id }))}
        open={studioOpen}
        onClose={() => setStudioOpen((v) => !v)}
      />
    </UiProvider>
  );
}

export { ApiError };
