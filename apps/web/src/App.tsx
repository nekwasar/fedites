/**
 * Fedites web shell — config-driven + authenticated (Phase 1).
 * Rails now live: session auth, verification flow, profiles, ID card,
 * notification inbox, Manage panel. Tabs render placeholders until their
 * phase (M3). Mobile-first layouts (E1); desktop restructures (E2/E5).
 */
import React, { useCallback, useEffect, useState } from "react";
import { applyTheme, applyFamily } from "@fedites/ui";
import { themePresets, families, mobilePatterns, desktopPatterns, type NavPatternId, type SessionMember as ContractMember } from "@fedites/config";
import { fetchSessionBoot, type BootState } from "./boot.js";
import { Api, ApiError } from "./api.js";
import { useRoute } from "./router.js";
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
import { GroupsHomeScreen } from "./screens/GroupsHomeScreen.js";
import { GroupScreen } from "./screens/GroupScreen.js";
import { ChatListScreen, ChatThreadScreen } from "./screens/ChatThread.js";
import { NewsScreen, FeedScreen } from "./screens/NewsFeed.js";
import { EventsScreen, EventDetailScreen } from "./screens/EventsScreen.js";
import { GivingSection, CampaignScreen, TransparentLedgerScreen } from "./screens/Giving.js";
import { MemoryLaneScreen } from "./screens/MemoryLane.js";
import { useRealtime } from "./realtime.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

/** Studio preview scaffolding (0.4): device frames + live config switchers. */
function StudioPreview({
  boot, device, onDevice, onPattern, onTheme, onFamily,
}: {
  boot: BootState;
  device: "mobile" | "desktop";
  onDevice: (d: "mobile" | "desktop") => void;
  onPattern: (p: NavPatternId) => void;
  onTheme: (id: string) => void;
  onFamily: (id: (typeof families)[number]["id"]) => void;
}): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  if (!boot.session.config.instance.flags.some((f) => f.key === "demo.previewSession" && f.enabled)) return null;
  return (
    <aside
      aria-label="Studio preview"
      style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: open ? 300 : 44,
        borderLeft: "1px solid var(--c-hairline)", background: "var(--c-neutral-50)",
        zIndex: 60, overflowY: "auto", padding: open ? 16 : 8,
      }}
    >
      <button
        type="button"
        className="press"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ minHeight: 44, background: "transparent", border: "none", cursor: "pointer", font: "600 11px var(--font-ui)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-base-contrast)" }}
      >
        {open ? "Close preview" : "Preview"}
      </button>
      {open && (
        <div style={{ display: "grid", gap: 16 }}>
          <p style={{ margin: 0, font: "13px var(--font-ui)" }}>{boot.session.config.instance.copy["preview.banner"]}</p>
          <div className="micro">Device frame</div>
          <div>
            {(["mobile", "desktop"] as const).map((d) => (
              <button key={d} type="button" className="press" onClick={() => onDevice(d)} style={{ minHeight: 44, marginRight: 8, border: "1px solid var(--c-hairline)", background: device === d ? "var(--c-accent)" : "var(--c-base)", color: device === d ? "var(--c-accent-contrast)" : "var(--c-base-contrast)", font: "13px var(--font-ui)", cursor: "pointer", padding: "0 12px" }}>
                {d}
              </button>
            ))}
          </div>
          <div className="micro">Nav pattern (config swap)</div>
          {(device === "mobile" ? mobilePatterns : desktopPatterns).map((p) => (
            <button key={p} type="button" className="press" onClick={() => onPattern(p)} style={{ minHeight: 44, width: "100%", textAlign: "left", border: "1px solid var(--c-hairline)", background: "var(--c-base)", font: "13px var(--font-ui)", cursor: "pointer", padding: "0 12px" }}>
              {p}
            </button>
          ))}
          <div className="micro">Color theme presets</div>
          {themePresets.map((t) => (
            <button key={t.id} type="button" className="press" onClick={() => onTheme(t.id)} aria-label={`Theme ${t.name}`} style={{ minHeight: 44, width: "100%", display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--c-hairline)", background: "var(--c-base)", cursor: "pointer", padding: "0 12px" }}>
              <span style={{ width: 24, height: 24, background: t.light.accent, display: "inline-block" }} />
              <span style={{ font: "13px var(--font-ui)", color: "var(--c-base-contrast)" }}>{t.name}</span>
            </button>
          ))}
          <div className="micro">Style family</div>
          {families.map((f) => (
            <button key={f.id} type="button" className="press" onClick={() => onFamily(f.id)} style={{ minHeight: 44, width: "100%", textAlign: "left", border: "1px solid var(--c-hairline)", background: "var(--c-base)", font: "13px var(--font-ui)", cursor: "pointer", padding: "0 12px" }}>
              {f.name}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function NewProposal({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const [name, setName] = useState("");
  const [type, setType] = useState<"chapter" | "interest" | "guild" | "committee">("interest");
  const [done, setDone] = useState<string | null>(null);
  return (
    <main style={{ paddingBottom: 96, maxWidth: 480 }}>
      <h1 className="screen-title">Propose a group</h1>
      {done !== null ? (
        <Empty title="Proposal sent" body={`Status: ${done}. Admins review new proposals.`} action={<button type="button" className="btn btn--filled press" onClick={() => onNavigate("/")}>Back to Groups</button>} />
      ) : (
        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {(["interest", "guild", "chapter", "committee"] as const).map((t) => (
              <button key={t} type="button" className="press" onClick={() => setType(t)} aria-pressed={type === t}
                style={{ minHeight: 44, padding: "0 12px", cursor: "pointer", border: "1px solid var(--c-hairline)", background: type === t ? "var(--c-accent)" : "var(--c-base)", color: type === t ? "var(--c-accent-contrast)" : "var(--c-base-contrast)", font: "13px var(--font-ui)" }}>
                {t}
              </button>
            ))}
          </div>
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" aria-label="Group name"
            style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }}
          />
          <button type="button" className="btn btn--filled press" style={{ marginTop: 12 }} disabled={name.trim().length < 2}
            onClick={() => void Api.createGroup({ type, name }).then((r) => setDone(r.status))}>
            Submit proposal
          </button>
        </div>
      )}
    </main>
  );
}

export default function App(): React.ReactElement {
  const [boot, setBoot] = useState<BootState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [member, setMember] = useState<ContractMember | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [unread, setUnread] = useState(0);
  const [route, navigate] = useRoute();
  const [device, setDevice] = useState<"mobile" | "desktop">(
    window.innerWidth < 1024 ? "mobile" : "desktop",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const realtime = useRealtime(API_URL, member !== null, member !== null ? ["member:" + member.id] : []);
  const [newsUnread, setNewsUnread] = useState(0);
  const [overrides, setOverrides] = useState<{
    themeId?: string;
    familyId?: string;
    mobilePattern?: (typeof mobilePatterns)[number];
    desktopPattern?: (typeof desktopPatterns)[number];
  }>({});

  const params = useCallback(() => {
    const p = new URLSearchParams();
    p.set("device", device);
    return p;
  }, [device]);

  useEffect(() => {
    fetchSessionBoot(API_URL, params())
      .then(setBoot)
      .catch((e: unknown) => setBootError(String(e)));
  }, [params]);

  const refreshSession = useCallback((): void => {
    Api.session()
      .then((s) => { setMember(s.member); })
      .catch(() => setMember(null))
      .finally(() => setSessionLoaded(true));
  }, []);

  useEffect(refreshSession, [refreshSession, route]);

  const refreshUnread = useCallback((): void => {
    if (member === null) { setUnread(0); return; }
    Api.inbox().then((i) => setUnread(i.unread)).catch(() => undefined);
  }, [member]);

  useEffect(refreshUnread, [refreshUnread]);

  // Realtime (2.3): WS events wake the UI; counts always come from the API
  // (I5 — badges never disagree). A "news.new" bumps the News badge.
  useEffect(() => {
    if (realtime === null) return;
    if (realtime.type === "news.new") setNewsUnread((n) => n + 1);
    if (realtime.type === "message.new" || realtime.type === "read") {
      Api.chatThreads().catch(() => undefined);
      refreshUnread();
    }
    if (realtime.type === "post.new") refreshUnread();
  }, [realtime, refreshUnread]);

  // Live theme/family application (0.3 demo gate).
  useEffect(() => {
    if (!boot) return;
    const preset =
      overrides.themeId !== undefined
        ? themePresets.find((t) => t.id === overrides.themeId)
        : null;
    if (preset) {
      applyTheme(document.documentElement, preset.light);
    } else {
      applyTheme(document.documentElement, boot.session.resolved.theme as Parameters<typeof applyTheme>[1]);
    }
    const family =
      overrides.familyId !== undefined
        ? families.find((f) => f.id === overrides.familyId)
        : boot.session.resolved.family;
    if (family) applyFamily(document.documentElement, family);
  }, [boot, overrides, device]);

  if (bootError !== null) {
    return (
      <Empty
        title="Could not reach the platform"
        body="Check that the API is running, then try again."
        action={<button type="button" className="btn btn--filled press" onClick={() => location.reload()}>Retry</button>}
      />
    );
  }
  if (boot === null || !sessionLoaded) {
    return (
      <div style={{ padding: 16, display: "grid", gap: 8 }}>
        <div className="skeleton" style={{ height: 32, maxWidth: 240 }} />
        <div className="skeleton" style={{ height: 16 }} />
        <div className="skeleton" style={{ height: 16 }} />
        <div className="skeleton" style={{ height: 16, maxWidth: 320 }} />
      </div>
    );
  }

  const nav = boot.session.config.nav;
  const effNav = {
    ...nav,
    mobile: overrides.mobilePattern ?? nav.mobile,
    desktop: overrides.desktopPattern ?? nav.desktop,
  };
  const pattern = device === "mobile" ? effNav.mobile : effNav.desktop;
  const items = boot.navItems;
  const contentMargin =
    device === "desktop" && (pattern === "side-rail" || pattern === "top+side") ? 220 : 0;
  const topOffset = pattern === "top-tabs" || pattern === "top-nav" || pattern === "top+side" ? 48 : 0;

  const go = (r: string): void => {
    if (r === "__drawer") { setDrawerOpen(true); return; }
    navigate(r);
  };

  const authed = member !== null;
  const dutyRoles = authed && member.roles.some((r) => r !== "member");

  const screen = (): React.ReactElement => {
    if (route.path === "/auth") {
      return authed
        ? <Empty title="You are signed in" body="Your account is active on this device." action={<button type="button" className="btn btn--filled press" onClick={() => go("/")}>Go home</button>} />
        : <AuthScreen onDone={() => { refreshSession(); navigate("/"); }} />;
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
      case "/": return <GroupsHomeScreen onNavigate={go} />;
      case "/feed": return <FeedScreen onNavigate={go} />;
      case "/chat": return <ChatListScreen onNavigate={go} />;
      case "/news": return <NewsScreen signedIn={authed} onNavigate={go} />;
      case "/groups":
        return route.param !== undefined
          ? <GroupScreen groupId={route.param} onNavigate={go} signedIn={authed} onOpenChat={(g) => go(`/chats/group/${g}`)} />
          : <Empty title="Group not found" body="The link may be wrong." />;
      case "/chats":
        return route.param !== undefined && route.path === "/chats"
          ? <ChatThreadScreen type={(window.location.pathname.split("/")[2] === "dm" ? "dm" : "group")} id={route.param} onNavigate={go} />
          : <ChatListScreen onNavigate={go} />;
      case "/groups/new": return authed ? <NewProposal onNavigate={go} /> : <Empty title="Sign in first" body="Proposals need a member account." />;
      case "/money/campaigns":
        return route.param !== undefined && route.path === "/money/campaigns"
          ? <CampaignScreen campaignId={route.param} onNavigate={go} />
          : <GivingSection />;
      case "/money/ledger": return <TransparentLedgerScreen />;
      case "/memory": return authed ? <MemoryLaneScreen member={member} /> : <Empty title="Sign in first" body="Memory Lane is for members." />;
      case "/notifications": return <InboxScreen onNavigate={go} />;
      case "/me": return <ProfileScreen member={member} onNavigate={go} />;
      case "/id": return <IdScreen />;
      case "/members": return route.param !== undefined ? <MemberScreen id={route.param} /> : <Empty title="Member not found" body="The link may be wrong." />;
      case "/manage": return dutyRoles ? <ManageScreen member={member} onNavigate={go} /> : <Empty title="Admins only" body="The Manage panel is for role-holders." />;
      case "/menu": return <ProfileScreen member={member} onNavigate={go} />;
      case "/events":
        return route.param !== undefined && route.path === "/events"
          ? <EventDetailScreen eventId={route.param} onNavigate={go} member={member} />
          : <EventsScreen onNavigate={go} isAdmin={authed && member.roles.some((r) => ["president", "treasurer", "secretary", "moderator"].includes(r))} />;
      case "/events-new": return authed ? <EventsScreen onNavigate={go} isAdmin={true} /> : <Empty title="Sign in first" body="Event creation needs a member account." />;
      default: return <GroupsHomeScreen onNavigate={go} />;
    }
  };

  const patterns: Record<string, React.ReactElement> = {
    "tab-bar": <MobileTabBar items={items} route={route.path} onNavigate={go} />,
    "top-tabs": <MobileTopTabs items={items} route={route.path} onNavigate={go} />,
    hybrid: <MobileHybrid items={items} route={route.path} onNavigate={go} />,
    drawer: <MobileDrawer items={items} route={route.path} onNavigate={go} open={drawerOpen} onClose={() => setDrawerOpen(false)} />,
    "floating-dock": <MobileFloatingDock items={items} route={route.path} onNavigate={go} />,
    "side-rail": <DesktopSideRail items={items} route={route.path} onNavigate={go} />,
    "top-nav": <DesktopTopNav items={items} route={route.path} onNavigate={go} />,
    "top+side": <DesktopTopSide items={items} route={route.path} onNavigate={go} />,
    "command-first": <DesktopCommandFirst items={items} route={route.path} onNavigate={go} />,
  };

  return (
    <>
      <header className="masthead" style={{ marginLeft: contentMargin, marginTop: pattern === "top-nav" || pattern === "top+side" ? 56 : 0, position: "relative" }}>
        <span
          style={{ cursor: "pointer" }}
          onClick={() => go("/")}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") go("/"); }}
        >
          {boot.session.config.instance.shortName}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" className="press" aria-label="News" onClick={() => { setNewsUnread(0); go("/news"); }} style={{ position: "relative", minHeight: 44, minWidth: 44, background: "transparent", border: "none", cursor: "pointer", color: "var(--c-base-contrast)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 4h13v16H4zM8 8h5M8 12h5M8 16h3M17 8h3v12H7" /></svg>
            {newsUnread > 0 && (
              <span className="tabular" style={{ position: "absolute", top: 4, right: 2, background: "var(--c-accent)", color: "var(--c-accent-contrast)", font: "600 10px var(--font-ui)", padding: "1px 5px" }}>{newsUnread}</span>
            )}
          </button>
          <button type="button" className="press" aria-label="Notifications" onClick={() => go("/notifications")} style={{ position: "relative", minHeight: 44, minWidth: 44, background: "transparent", border: "none", cursor: "pointer", color: "var(--c-base-contrast)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 16V10a6 6 0 1 1 12 0v6l2 3H4zM10 19a2 2 0 0 0 4 0" /></svg>
            {unread > 0 && (
              <span className="tabular" style={{ position: "absolute", top: 4, right: 2, background: "var(--c-accent)", color: "var(--c-accent-contrast)", font: "600 10px var(--font-ui)", padding: "1px 5px" }}>{unread}</span>
            )}
          </button>
          {authed ? (
            <button type="button" className="press" aria-label="Your profile" onClick={() => go("/me")} style={{ minHeight: 44, minWidth: 44, background: "transparent", border: "1px solid var(--c-hairline)", cursor: "pointer", font: "600 14px var(--font-masthead)", color: "var(--c-accent)" }}>
              {member.displayName.slice(0, 1)}
            </button>
          ) : (
            <button type="button" className="btn btn--filled press" onClick={() => go("/auth")}>Sign in</button>
          )}
        </span>
      </header>
      <div style={{ marginLeft: contentMargin, marginTop: topOffset }}>
        {screen()}
      </div>
      {patterns[pattern]}
      <StudioPreview
        boot={boot}
        device={device}
        onDevice={setDevice}
        onPattern={(p) => {
          if ((mobilePatterns as readonly string[]).includes(p)) setOverrides((o) => ({ ...o, mobilePattern: p as (typeof mobilePatterns)[number] }));
          if ((desktopPatterns as readonly string[]).includes(p)) setOverrides((o) => ({ ...o, desktopPattern: p as (typeof desktopPatterns)[number] }));
        }}
        onTheme={(id) => setOverrides((o) => ({ ...o, themeId: id }))}
        onFamily={(id) => setOverrides((o) => ({ ...o, familyId: id }))}
      />
    </>
  );
}

export { ApiError };
