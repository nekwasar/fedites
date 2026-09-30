import { describe, it, expect } from "vitest";
import { Placeholder } from "./placeholder.js";

describe("placeholder screens", () => {
  it("render empty-state copy from the config copy table (G4, no emojis)", () => {
    const html = Placeholder({
      title: "Groups",
      job: "All your spaces and discovery",
      emptyTitle: "No groups yet",
      emptyBody: "Your set group and house appear here once you are verified.",
      cta: null,
    });
    expect(html).toContain("No groups yet");
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(html).toContain("<h2>");
  });
});
