/**
 * Config-driven navigation (phases.md 0.4): placeholder tabs rendered from
 * the nav schema. Five mobile patterns, four desktop patterns — same items,
 * different geometry (I2/E5). All styling via the token stylesheet classes
 * (M1); interactive elements are 44px targets with press states (F1/L5).
 */
import type { NavItemView } from "@fedites/config";
import { Icon, type IconName } from "@fedites/ui";
import { useEffect, useState } from "react";

const icons: Record<string, IconName> = {
  groups: "house",
  feed: "news",
  chat: "chat",
  events: "calendar",
  menu: "menu",
  manage: "shield",
};

export function MobileTabBar({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav className="tabbar" aria-label="Primary">
      {items.map((i) => (
        <button
          key={i.item}
          type="button"
          className="tabbar__item press"
          aria-current={route === i.route ? "page" : undefined}
          aria-label={i.label}
          onClick={() => onNavigate(i.route)}
        >
          <Icon name={icons[i.item] ?? "menu"} size={22} />
          <span>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function MobileTopTabs({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav className="topbar" aria-label="Primary">
      {items.map((i) => (
        <button
          key={i.item}
          type="button"
          className="topbar__tab press"
          aria-current={route === i.route ? "page" : undefined}
          onClick={() => onNavigate(i.route)}
        >
          {i.label}
        </button>
      ))}
    </nav>
  );
}

/** hybrid: top utility (search/news/notifications) + bottom tabs. */
export function MobileHybrid({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <>
      <MobileTopTabs items={items} route={route} onNavigate={onNavigate} />
      <MobileTabBar items={items} route={route} onNavigate={onNavigate} />
    </>
  );
}

export function MobileDrawer({ items, route, onNavigate, open, onClose }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void; open: boolean; onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        className="press"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => onNavigate("__drawer")}
        style={{
          position: "fixed", top: "var(--space-3)", left: "var(--space-3)",
          minHeight: "var(--tap)", minWidth: "var(--tap)",
          background: "var(--c-base)", border: "var(--hairline) solid var(--hairline-color)",
          cursor: "pointer", color: "var(--c-base-contrast)", zIndex: 41,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon name="menu" size={20} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          onClick={onClose}
          className="overlay"
          style={{ alignItems: "stretch" }}
        >
          <nav
            className="drawer-nav"
            aria-label="Primary"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((i) => (
              <button
                key={i.item}
                type="button"
                className="drawer-item press"
                aria-current={route === i.route ? "page" : undefined}
                onClick={() => { onNavigate(i.route); onClose(); }}
              >
                <Icon name={icons[i.item] ?? "menu"} size={20} />
                {i.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

export function MobileFloatingDock({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: "fixed",
        bottom: "var(--space-4)",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "var(--space-1)",
        padding: "var(--space-1)",
        background: "var(--c-base)",
        border: "var(--hairline) solid var(--hairline-color)",
        zIndex: 30,
      }}
    >
      {items.map((i) => (
        <span key={i.item} style={{ position: "relative", display: "flex" }}>
          {route === i.route && (
            <span aria-hidden="true" style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 3, background: "var(--c-accent)" }} />
          )}
          <button
            type="button"
            className="tabbar__item press"
            aria-current={route === i.route ? "page" : undefined}
            aria-label={i.label}
            onClick={() => onNavigate(i.route)}
            style={{ minWidth: 56 }}
          >
            <Icon name={icons[i.item] ?? "menu"} size={22} />
            <span>{i.label}</span>
          </button>
        </span>
      ))}
    </nav>
  );
}

/** Desktop side rail (E2/E5): persistent rail with labels + section sub-nav. */
export function DesktopSideRail({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav className="siderail" aria-label="Primary">
      {items.map((i) => (
        <button
          key={i.item}
          type="button"
          className="siderail__item press"
          aria-current={route === i.route ? "page" : undefined}
          onClick={() => onNavigate(i.route)}
        >
          <Icon name={icons[i.item] ?? "menu"} size={20} />
          {i.label}
        </button>
      ))}
    </nav>
  );
}

export function DesktopTopNav({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav
      className="topbar"
      aria-label="Primary"
      style={{ minHeight: 56, alignItems: "center", padding: "0 var(--space-6)" }}
    >
      {items.map((i) => (
        <button
          key={i.item}
          type="button"
          className="topbar__tab press"
          aria-current={route === i.route ? "page" : undefined}
          onClick={() => onNavigate(i.route)}
          style={{ font: "var(--weight-semibold) var(--type-body2) var(--font-ui)" }}
        >
          {i.label}
        </button>
      ))}
    </nav>
  );
}

export function DesktopTopSide({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <>
      <DesktopTopNav items={items} route={route} onNavigate={onNavigate} />
      <DesktopSideRail items={items} route={route} onNavigate={onNavigate} />
    </>
  );
}

/** command-first: minimal chrome + Cmd+K (I4: search in one gesture). */
export function DesktopCommandFirst({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <>
      <button
        type="button"
        className="press"
        aria-label="Command menu"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", top: "var(--space-3)", left: "var(--space-3)",
          minHeight: "var(--tap)", padding: "0 var(--space-4)",
          display: "flex", gap: "var(--space-2)", alignItems: "center",
          background: "var(--c-base)", border: "var(--hairline) solid var(--hairline-color)",
          color: "var(--c-neutral-600)", font: "var(--weight-medium) var(--type-body2) var(--font-ui)", cursor: "pointer", zIndex: 31,
        }}
      >
        <Icon name="search" size={16} /> Search <span className="tabular micro">Cmd K</span>
      </button>
      <nav aria-label="Primary" style={{ position: "fixed", bottom: "var(--space-3)", left: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-1)", zIndex: 31 }}>
        {items.map((i) => (
          <button
            key={i.item}
            type="button"
            className="press"
            aria-current={route === i.route ? "page" : undefined}
            onClick={() => onNavigate(i.route)}
            style={{
              display: "flex", gap: "var(--space-2)", alignItems: "center", minHeight: "var(--tap)",
              padding: "0 var(--space-3)", background: "transparent", border: "none",
              color: route === i.route ? "var(--c-accent)" : "var(--c-neutral-600)",
              font: "var(--weight-medium) var(--type-body2) var(--font-ui)", cursor: "pointer",
            }}
          >
            <Icon name={icons[i.item] ?? "menu"} size={16} /> {i.label}
          </button>
        ))}
      </nav>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command menu"
          onClick={() => setOpen(false)}
          className="overlay overlay--center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 480, background: "var(--c-base)", border: "var(--hairline) solid var(--hairline-color)", padding: "var(--space-4)" }}
          >
            <div className="micro">Search members, posts, chats, events</div>
            <input
              autoFocus
              placeholder="Type to search"
              style={{
                width: "100%", minHeight: "var(--tap)", marginTop: "var(--space-2)", padding: "0 var(--space-3)",
                border: "none", borderBottom: "var(--hairline) solid var(--hairline-color)",
                background: "transparent", color: "var(--c-base-contrast)", font: "var(--type-body) var(--font-ui)",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
