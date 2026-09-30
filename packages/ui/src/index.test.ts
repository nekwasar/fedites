import { describe, it, expect } from "vitest";
import { Icon } from "./index.js";

describe("Icon (D1)", () => {
  it("renders line icons with a single stroke weight, no emojis", () => {
    const svg = Icon({ name: "house" });
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("covers the six fixed nav items plus top bar", () => {
    for (const name of ["house", "news", "chat", "calendar", "menu", "shield", "search", "bell"] as const) {
      expect(Icon({ name })).toContain("<path");
    }
  });
});
