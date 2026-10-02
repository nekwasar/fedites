/**
 * Server-side rendering entry (Vite SSR). Fastify imports this (dev via
 * vite.ssrLoadModule, prod via the built dist/server bundle) and calls
 * renderPage per request: the full page — boot, chrome and screen with all
 * of its data — is rendered to HTML before it reaches the browser. Nothing
 * page-level is loaded client-side; the client bundle only hydrates
 * interactivity (WS chat, forms, mutation responses).
 */
import React from "react";
import { renderToString } from "react-dom/server";
import App from "./App.js";
import { deriveBootState } from "./boot.js";
import type { SessionBoot, SessionMember } from "@fedites/config";

export interface SsrPageInput {
  urlPath: string;
  session: SessionBoot;
  member: SessionMember | null;
  device: "mobile" | "desktop";
  routeData: Record<string, unknown>;
  unread: number;
  /** Client bundle wiring: dev = "/src/main.tsx"; prod = built entry + css. */
  clientEntry: string;
  cssAssets: string[];
  devStylesHref?: string;
}

/** JSON that is safe to inline into a <script> block. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function renderPage(input: SsrPageInput): string {
  const boot = deriveBootState(input.session, input.device);
  const html = renderToString(
    React.createElement(App, {
      boot,
      member: input.member,
      unread: input.unread,
      routeData: input.routeData,
      ssrPath: input.urlPath,
      ssrDevice: input.device,
    }),
  );
  const shell = {
    boot: input.session,
    member: input.member,
    unread: input.unread,
    data: input.routeData,
    device: input.device,
  };
  const styles = input.devStylesHref !== undefined
    ? `<link rel="stylesheet" href="${input.devStylesHref}" />`
    : input.cssAssets.map((c) => `<link rel="stylesheet" href="${c}" />`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="manifest" href="/manifest.webmanifest" />
<title>Fedites</title>
${styles}
</head>
<body>
<div id="root">${html}</div>
<script>window.__PAGE__=${inlineJson(shell)};</script>
<script type="module" src="${input.clientEntry}"></script>
</body>
</html>`;
}
