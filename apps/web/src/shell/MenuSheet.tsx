/**
 * MENU SHEET REGISTRY — the mobile-only slide-out navigation. Config-driven
 * component factory (configuration.md §5): variant (drawer/sheet/modal) and
 * opening animation (slide/rise/scale/instant) come from the menuSheet
 * config section; content is ONLY navigation items (the pages that do not
 * fit the mobile pattern's primary slots). Desktop never renders a menu —
 * its nav shows everything. Zero styling constants (M1): token classes.
 */
import React, { useEffect } from "react";
import { Icon, type IconName } from "@fedites/ui";
import type { MenuSheetConfig } from "@fedites/config";
import type { NavItemView } from "@fedites/config";

const icons: Record<string, IconName> = {
  groups: "house", feed: "news", chat: "chat", events: "calendar", menu: "menu", manage: "shield",
};

export function MenuSheet({ config, items, route, onNavigate, onClose, title }: {
  config: MenuSheetConfig;
  items: NavItemView[];
  route: string;
  onNavigate: (route: string) => void;
  onClose: () => void;
  title: string;
}): React.ReactElement {
  // Escape closes; focus lands on the first item (keyboard-first, F1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="menu-scrim" onClick={onClose} role="presentation">
      <div
        className={`menu-panel menu-panel--${config.variant}`}
        data-anim={config.animation}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-panel__title">
          <Icon name="menu" size={18} />
          {title}
        </div>
        <div className="menu-panel__list">
          {items.map((i) => (
            <button
              key={i.item}
              type="button"
              className="menu-item press"
              aria-current={route === i.route ? "page" : undefined}
              onClick={() => onNavigate(i.route)}
            >
              <Icon name={icons[i.item] ?? "menu"} size={20} />
              {i.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
