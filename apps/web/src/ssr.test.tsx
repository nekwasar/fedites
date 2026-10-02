/**
 * SSR render smoke test — the Fastify server renders complete pages from
 * pure inputs; this runs with no DOM and must not touch window.
 */
import { describe, it, expect } from "vitest";
import { renderPage } from "./ssr.js";
import { buildSessionBoot, defaultConfig } from "@fedites/config";

const INSTANCE_ID = "5f0b7c3a-9d1e-4a67-8b2f-3c4d5e6f7a8b";

describe("server-side rendering", () => {
  it("renders a complete signed-out landing page", () => {
    const session = buildSessionBoot(defaultConfig, { instanceId: INSTANCE_ID, device: "mobile", member: null });
    const html = renderPage({
      urlPath: "/",
      session,
      member: null,
      device: "mobile",
      routeData: {},
      unread: 0,
      clientEntry: "/src/main.tsx",
      cssAssets: [],
      devStylesHref: "/@fs/styles.css",
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('id="root"');
    expect(html).toContain("window.__PAGE__=");
    expect(html).toContain("/@vite/client");
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("inlines boot + route data without breaking the script block", () => {
    const session = buildSessionBoot(defaultConfig, { instanceId: INSTANCE_ID, device: "mobile", member: { id: INSTANCE_ID, displayName: "Ada", roles: ["president"], verified: true } });
    const html = renderPage({
      urlPath: "/chat",
      session,
      member: { id: INSTANCE_ID, displayName: "Ada", roles: ["president"], verification: "verified", totpEnabled: false, email: "a@b.c", phone: null },
      device: "mobile",
      routeData: { "chat.list": { threads: { threads: [{ type: "group", id: "g1", name: "Set 1998</script>", groupType: "set", lastAt: null, preview: "hi", unread: 0, pinned: false }] }, presence: { online: [] } } },
      unread: 4,
      clientEntry: "/src/main.tsx",
      cssAssets: ["/assets/main.js"],
    });
    expect(html).toContain("window.__PAGE__=");
    expect(html).toContain("Set 1998\\u003c/script>");
    expect(html).toContain("\"unread\":4");
  });
});
