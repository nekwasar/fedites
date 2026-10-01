/**
 * Config-driven navigation (phases.md 0.4): placeholder tabs rendered from
 * the nav schema. Five mobile patterns, four desktop patterns — same items,
 * different geometry (I2/E5). All interactive elements are 44px targets,
 * have press states (F1), and pass a11y floors (L5).
 */
import type { NavItemView } from "@fedites/config";
import { Icon } from "@fedites/ui";
import React from "react";

const icons: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  groups: "house",
  feed: "news",
  chat: "chat",
  events: "calendar",
  menu: "menu",
  manage: "shield",
};

function NavButton({ item, active, onClick }: { item: NavItemView; active: boolean; onClick: (route: string) => void }) {
  return (
    <button
      type="button"
      className="press"
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      onClick={() => onClick(item.route)}
      style={{
        minHeight: 44,
        minWidth: 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "8px 12px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "var(--c-accent)" : "var(--c-neutral-600)",
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        lineHeight: "16px",
        letterSpacing: "0.04em",
      }}
    >
      <Icon name={icons[item.item] ?? "menu"} size={22} />
      <span>{item.label}</span>
    </button>
  );
}

export function MobileTabBar({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-around",
        borderTop: "1px solid var(--c-hairline)",
        background: "var(--c-base)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map((i) => (
        <span key={i.item} style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative" }}>
          {route === i.route && (
            <span aria-hidden="true" style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 3, background: "var(--c-accent)" }} />
          )}
          <NavButton item={i} active={route === i.route} onClick={onNavigate} />
        </span>
      ))}
    </nav>
  );
}

export function MobileTopTabs({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        borderBottom: "1px solid var(--c-hairline)",
        background: "var(--c-base)",
        overflowX: "auto",
      }}
    >
      {items.map((i) => (
        <button
          key={i.item}
          type="button"
          className="press"
          aria-current={route === i.route ? "page" : undefined}
          onClick={() => onNavigate(i.route)}
          style={{
            minHeight: 44,
            padding: "0 16px",
            background: "transparent",
            border: "none",
            borderBottom: route === i.route ? "2px solid var(--c-accent)" : "2px solid transparent",
            color: route === i.route ? "var(--c-accent)" : "var(--c-neutral-600)",
            font: "500 13px var(--font-ui)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
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
      <MobileTopTabs items={[items[0]!, items[4]!]} route={route} onNavigate={onNavigate} />
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
        onClick={() => onNavigate("__drawer")}
        style={{
          position: "fixed", top: 12, left: 12, minHeight: 44, minWidth: 44,
          background: "var(--c-base)", border: "1px solid var(--c-hairline)", cursor: "pointer",
          color: "var(--c-base-contrast)", zIndex: 41,
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
          style={{
            position: "fixed", inset: 0, background: "var(--c-scrim)", zIndex: 40,
            display: "flex", alignItems: "stretch",
          }}
        >
          <nav
            aria-label="Primary"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280, background: "var(--c-base)", height: "100%",
              borderRight: "1px solid var(--c-hairline)", paddingTop: 64,
            }}
          >
            {items.map((i) => (
              <button
                key={i.item}
                type="button"
                className="press"
                aria-current={route === i.route ? "page" : undefined}
                onClick={() => { onNavigate(i.route); onClose(); }}
                style={{
                  display: "flex", gap: 12, alignItems: "center", width: "100%", minHeight: 44,
                  padding: "0 16px", background: "transparent", border: "none",
                  borderBottom: "1px solid var(--c-hairline)",
                  color: route === i.route ? "var(--c-accent)" : "var(--c-base-contrast)",
                  font: "500 15px var(--font-ui)", cursor: "pointer", textAlign: "left",
                }}
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
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 4,
        padding: 4,
        background: "var(--c-base)",
        border: "1px solid var(--c-hairline)",
      }}
    >
      {items.map((i) => (
        <NavButton key={i.item} item={i} active={route === i.route} onClick={onNavigate} />
      ))}
    </nav>
  );
}

/** Desktop side rail (E2/E5): persistent rail with labels + section sub-nav. */
export function DesktopSideRail({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: "fixed", top: 0, bottom: 0, left: 0, width: 220,
        borderRight: "1px solid var(--c-hairline)", background: "var(--c-base)",
        display: "flex", flexDirection: "column", paddingTop: 16,
      }}
    >
      {items.map((i) => (
        <button
          key={i.item}
          type="button"
          className="press"
          aria-current={route === i.route ? "page" : undefined}
          onClick={() => onNavigate(i.route)}
          style={{
            display: "flex", gap: 12, alignItems: "center", minHeight: 44,
            padding: "0 16px", background: "transparent", border: "none",
            borderLeft: route === i.route ? "2px solid var(--c-accent)" : "2px solid transparent",
            color: route === i.route ? "var(--c-accent)" : "var(--c-base-contrast)",
            font: "500 15px var(--font-ui)", cursor: "pointer", textAlign: "left",
          }}
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
      aria-label="Primary"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, display: "flex", gap: 4,
        alignItems: "center", minHeight: 56, padding: "0 24px",
        borderBottom: "1px solid var(--c-hairline)", background: "var(--c-base)",
      }}
    >
      {items.map((i) => (
        <button
          key={i.item}
          type="button"
          className="press"
          aria-current={route === i.route ? "page" : undefined}
          onClick={() => onNavigate(i.route)}
          style={{
            minHeight: 44, padding: "0 16px", background: "transparent", border: "none",
            borderBottom: route === i.route ? "2px solid var(--c-accent)" : "2px solid transparent",
            color: route === i.route ? "var(--c-accent)" : "var(--c-neutral-600)",
            font: "600 13px var(--font-ui)", cursor: "pointer",
          }}
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
      <DesktopTopNav items={[items[0]!, items[4]!]} route={route} onNavigate={onNavigate} />
      <DesktopSideRail items={items} route={route} onNavigate={onNavigate} />
    </>
  );
}

/** command-first: minimal chrome + Cmd+K (I4: search in one gesture). */
export function DesktopCommandFirst({ items, route, onNavigate }: { items: NavItemView[]; route: string; onNavigate: (route: string) => void }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
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
          position: "fixed", top: 12, left: 12, minHeight: 44, padding: "0 16px",
          display: "flex", gap: 8, alignItems: "center",
          background: "var(--c-base)", border: "1px solid var(--c-hairline)",
          color: "var(--c-neutral-600)", font: "500 13px var(--font-ui)", cursor: "pointer",
        }}
      >
        <Icon name="search" size={16} /> Search <span className="tabular">Cmd K</span>
      </button>
      <nav aria-label="Primary" style={{ position: "fixed", bottom: 12, left: 12, display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((i) => (
          <button
            key={i.item}
            type="button"
            className="press"
            aria-current={route === i.route ? "page" : undefined}
            onClick={() => onNavigate(i.route)}
            style={{
              display: "flex", gap: 8, alignItems: "center", minHeight: 44,
              padding: "0 12px", background: "transparent", border: "none",
              color: route === i.route ? "var(--c-accent)" : "var(--c-neutral-600)",
              font: "500 13px var(--font-ui)", cursor: "pointer",
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
          style={{ position: "fixed", inset: 0, background: "var(--c-scrim)", zIndex: 50, display: "flex", justifyContent: "center", paddingTop: 120 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 480, background: "var(--c-base)", border: "1px solid var(--c-hairline)", padding: 16 }}
          >
            <div className="micro">Search members, posts, chats, events</div>
            <input
              autoFocus
              placeholder="Type to search"
              style={{
                width: "100%", minHeight: 44, marginTop: 8, padding: "0 12px",
                border: "none", borderBottom: "1px solid var(--c-hairline)",
                background: "transparent", color: "var(--c-base-contrast)", font: "15px var(--font-ui)",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
