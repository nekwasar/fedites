import { describe, it, expect } from "vitest";
import { Icon, iconSvg } from "./index.js";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("Icon (D1)", () => {
  it("renders line icons with a single stroke weight, no emojis", () => {
    const svg = iconSvg("house");
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("covers the six fixed nav items plus top bar and utility icons", () => {
    for (const name of ["house", "news", "chat", "calendar", "menu", "shield", "search", "bell", "check", "plus", "close", "back", "play", "pin"] as const) {
      expect(iconSvg(name)).toContain("<path");
    }
  });

  it("renders as a real React element — never raw markup as text", () => {
    const html = renderToStaticMarkup(React.createElement(Icon, { name: "house" }));
    expect(html).toContain("<svg");
    expect(html).not.toContain("&lt;svg");
  });
});
