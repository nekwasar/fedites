/**
 * Menu sheet registry tests — one overflow item list, three variant
 * geometries, four opening animations; all from config. Mobile-only by
 * contract (desktop patterns never render a menu trigger).
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MenuSheet } from "./MenuSheet.js";
import { defaultConfig } from "@fedites/config";
import type { NavItemView } from "@fedites/config";

const items: NavItemView[] = [
  { item: "manage", label: "Manage", route: "/manage", requiresRole: true },
  { item: "events", label: "Events", route: "/events", requiresRole: false },
];

const h = (variant: string, animation: string): string =>
  renderToStaticMarkup(React.createElement(MenuSheet, {
    config: { ...defaultConfig.menuSheet, variant, animation } as typeof defaultConfig.menuSheet,
    items, route: "/manage", onNavigate: () => undefined, onClose: () => undefined, title: "Menu",
  }));

describe("menu sheet registry", () => {
  it("renders three distinct variant geometries from the same items", () => {
    expect(h("drawer", "slide")).toContain("menu-panel--drawer");
    expect(h("sheet", "rise")).toContain("menu-panel--sheet");
    expect(h("modal", "scale")).toContain("menu-panel--modal");
    expect(h("drawer", "slide")).toContain("aria-current=\"page\""); // active page marks
  });

  it("the opening animation is config-driven per variant", () => {
    expect(h("drawer", "slide")).toContain('data-anim="slide"');
    expect(h("drawer", "instant")).toContain('data-anim="instant"');
    expect(h("sheet", "rise")).toContain('data-anim="rise"');
    expect(h("modal", "scale")).toContain('data-anim="scale"');
  });

  it("carries only navigation items, labelled from the nav config", () => {
    const html = h("sheet", "rise");
    expect(html).toContain("Manage");
    expect(html).toContain("Events");
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
