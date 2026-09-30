/**
 * Fedites web shell — config-driven (phases.md 0.4).
 * Renders: resolved color theme (0.3) + nav pattern from config (0.4)
 * + placeholder screens with typographic empty states (G4).
 * The Studio preview scaffolding allows switching family/theme/nav/device
 * without a store update — clients hot-reload config (configuration.md §7).
 */
import React, { useEffect, useMemo, useState } from "react";
import { applyTheme, applyFamily } from "@fedites/ui";
import { fetchSessionBoot, type BootState } from "./boot.js";
import {
  MobileTabBar, MobileTopTabs, MobileHybrid, MobileDrawer, MobileFloatingDock,
  DesktopSideRail, DesktopTopNav, DesktopTopSide, DesktopCommandFirst,
} from "./shell/nav-patterns.js";
import { themePresets, families, mobilePatterns, desktopPatterns, type NavPatternId } from "@fedites/config";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

const tabJobs: Record<string, string> = {
  "/": "tab.groups.job",
  "/feed": "tab.feed.job",
  "/chat": "tab.chat.job",
  "/events": "tab.events.job",
  "/menu": "tab.menu.job",
  "/manage": "tab.menu.job",
};

function PlaceholderScreen({ boot, route }: { boot: BootState; route: string }): React.ReactElement {
  const copyKey = tabJobs[route] ?? "tab.groups.job";
  const navItem = boot.navItems.find((i) => i.route === route);
  const flags = new Map(boot.session.config.instance.flags.map((f) => [f.key, f.enabled]));
  const enabled = navItem ? flags.get(`nav.${navItem.item}`) !== false : true;
  const itemKey = navItem?.item ?? "groups";
  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">{navItem?.label ?? "Groups"}</h1>
      <div className="micro" style={{ padding: "0 16px 16px" }}>
        {boot.session.config.instance.copy[copyKey] ?? ""}
      </div>
      {!enabled && (
        <div className="empty">
          <h2>Coming in a later phase</h2>
          <p>This feature ships behind a flag until its build phase (M3).</p>
        </div>
      )}
      {enabled && (
        <div className="empty">
          <h2>{boot.session.config.instance.copy[`empty.${itemKey}.title`] ?? "Nothing here yet"}</h2>
          <p>{boot.session.config.instance.copy[`empty.${itemKey}.body`] ?? "Content will appear here."}</p>
          {route === "/" && <button type="button" className="btn btn--filled press">Find your people</button>}
        </div>
      )}
    </main>
  );
}

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
  const [open, setOpen] = useState(true);
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
        style={{ minHeight: 44, background: "transparent", border: "none", cursor: "pointer", font: "600 11px var(--font-ui)", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {open ? "Close preview" : "Preview"}
      </button>
      {open && (
        <div style={{ display: "grid", gap: 16 }}>
          <div className="micro">Preview banner</div>
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
            <button
              key={p}
              type="button"
              className="press"
              onClick={() => onPattern(p)}
              style={{ minHeight: 44, width: "100%", textAlign: "left", border: "1px solid var(--c-hairline)", background: "var(--c-base)", font: "13px var(--font-ui)", cursor: "pointer", padding: "0 12px" }}
            >
              {p}
            </button>
          ))}

          <div className="micro">Color theme presets</div>
          {themePresets.map((t) => (
            <button
              key={t.id}
              type="button"
              className="press"
              onClick={() => onTheme(t.id)}
              aria-label={`Theme ${t.name}`}
              style={{ minHeight: 44, width: "100%", display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--c-hairline)", background: "var(--c-base)", cursor: "pointer", padding: "0 12px" }}
            >
              <span style={{ width: 24, height: 24, background: t.light.accent, display: "inline-block" }} />
              <span style={{ font: "13px var(--font-ui)", color: "var(--c-base-contrast)" }}>{t.name}</span>
            </button>
          ))}

          <div className="micro">Style family</div>
          {families.map((f) => (
            <button
              key={f.id}
              type="button"
              className="press"
              onClick={() => onFamily(f.id)}
              style={{ minHeight: 44, width: "100%", textAlign: "left", border: "1px solid var(--c-hairline)", background: "var(--c-base)", font: "13px var(--font-ui)", cursor: "pointer", padding: "0 12px" }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

export default function App(): React.ReactElement {
  const [boot, setBoot] = useState<BootState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState("/");
  const [device, setDevice] = useState<"mobile" | "desktop">(
    window.innerWidth < 1024 ? "mobile" : "desktop",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overrides, setOverrides] = useState<{
    themeId?: string;
    familyId?: string;
    mobilePattern?: (typeof mobilePatterns)[number];
    desktopPattern?: (typeof desktopPatterns)[number];
  }>({});

  const handlePattern = (p: NavPatternId): void => {
    if ((mobilePatterns as readonly string[]).includes(p)) {
      setOverrides((o) => ({ ...o, mobilePattern: p as (typeof mobilePatterns)[number] }));
    }
    if ((desktopPatterns as readonly string[]).includes(p)) {
      setOverrides((o) => ({ ...o, desktopPattern: p as (typeof desktopPatterns)[number] }));
    }
  };

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("device", device);
    return p;
  }, [device]);

  useEffect(() => {
    fetchSessionBoot(API_URL, params)
      .then(setBoot)
      .catch((e: unknown) => setError(String(e)));
  }, [params]);

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
      const resolved = boot.session.resolved.theme as unknown as Record<string, string | undefined>;
      const full = { ...resolved };
      for (const k of Object.keys(full)) if (full[k] === undefined) delete full[k];
      applyTheme(document.documentElement, full as Parameters<typeof applyTheme>[1]);
    }
    const family =
      overrides.familyId !== undefined
        ? families.find((f) => f.id === overrides.familyId)
        : boot.session.resolved.family;
    if (family) applyFamily(document.documentElement, family);
  }, [boot, overrides, device]);

  if (error !== null) {
    return (
      <div className="empty">
        <h2>Could not reach the platform</h2>
        <p>Check that the API is running, then try again.</p>
        <button type="button" className="btn btn--filled press" onClick={() => location.reload()}>Retry</button>
      </div>
    );
  }
  if (boot === null) {
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
  const topOffset = pattern === "top-tabs" || pattern === "top-nav" || pattern === "hybrid" ? 48 : 0;

  const navigate = (r: string): void => {
    if (r === "__drawer") { setDrawerOpen(true); return; }
    setRoute(r);
    window.history.pushState(null, "", r);
  };

  const patterns: Record<string, React.ReactElement> = {
    "tab-bar": <MobileTabBar items={items} route={route} onNavigate={navigate} />,
    "top-tabs": <MobileTopTabs items={items} route={route} onNavigate={navigate} />,
    hybrid: <MobileHybrid items={items} route={route} onNavigate={navigate} />,
    drawer: (
      <MobileDrawer items={items} route={route} onNavigate={navigate} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    ),
    "floating-dock": <MobileFloatingDock items={items} route={route} onNavigate={navigate} />,
    "side-rail": <DesktopSideRail items={items} route={route} onNavigate={navigate} />,
    "top-nav": <DesktopTopNav items={items} route={route} onNavigate={navigate} />,
    "top+side": <DesktopTopSide items={items} route={route} onNavigate={navigate} />,
    "command-first": <DesktopCommandFirst items={items} route={route} onNavigate={navigate} />,
  };

  return (
    <>
      <header className="masthead" style={{ marginLeft: contentMargin, marginTop: pattern === "top-nav" || pattern === "top+side" ? 56 : 0 }}>
        {boot.session.config.instance.shortName}
        <span className="micro" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
          {boot.session.resolved.family.name}
        </span>
      </header>
      <div style={{ marginLeft: contentMargin, marginTop: topOffset }}>
        <PlaceholderScreen boot={{ ...boot, session: { ...boot.session, config: { ...boot.session.config, nav: effNav } } }} route={route} />
      </div>
      {patterns[pattern]}
      <StudioPreview
        boot={boot}
        device={device}
        onDevice={setDevice}
        onPattern={handlePattern}
        onTheme={(id) => setOverrides((o) => ({ ...o, themeId: id }))}
        onFamily={(id) => setOverrides((o) => ({ ...o, familyId: id }))}
      />
    </>
  );
}
