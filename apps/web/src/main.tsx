/**
 * Hydration entry. The server already rendered the complete page — boot,
 * chrome and screen content — so this bundle only attaches interactivity:
 * WS chat, forms, mutation responses. No fetch-on-mount for page data.
 */
import React from "react";
import { hydrateRoot } from "react-dom/client";
import "@fedites/ui/styles.css";
import App from "./App.js";
import type { SessionBoot, SessionMember } from "@fedites/config";
import { deriveBootState } from "./boot.js";
import type { AppProps } from "./page-types.js";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const shell = window.__PAGE__;
if (!shell) throw new Error("missing SSR payload");

const device: "mobile" | "desktop" = window.innerWidth < 1024 ? "mobile" : "desktop";
const boot = deriveBootState(shell.boot as SessionBoot, device);
const props = {
  boot,
  member: (shell.member as SessionMember | null) ?? null,
  unread: shell.unread ?? 0,
  routeData: shell.data ?? {},
  ssrPath: window.location.pathname,
  // Hydrate with the server's device guess (identical tree), then correct
  // pre-paint from the real viewport in a layout effect — no mismatch.
  ssrDevice: (shell as { device?: "mobile" | "desktop" }).device ?? device,
} satisfies AppProps;

hydrateRoot(
  root,
  <React.StrictMode>
    <App {...props} />
  </React.StrictMode>,
);
