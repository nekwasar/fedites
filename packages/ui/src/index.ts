/**
 * Fedites component library — Phase 0 primitives (rules.md M2: every UI
 * element comes from here; no one-offs in apps).
 *
 * D1: one custom line-icon set, single stroke weight, no emojis. Icon is a
 * real React component (a string-valued component renders raw markup as
 * text — the enterprise bug caught in the UI).
 */
import React from "react";
import { cssVarName } from "@fedites/tokens";

export { applyTheme, applyFamily } from "./theme.js";
export * from "./components.js";

/** The one-true color source used by inline SVG icon strokes. */
export function accentVar(): string {
  return `var(${cssVarName("accent")})`;
}

export type IconName =
  | "house" | "news" | "chat" | "calendar" | "menu" | "shield" | "search" | "bell"
  | "check" | "plus" | "close" | "back" | "play" | "pin";

const PATHS: Record<IconName, string> = {
  house: "M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10",
  news: "M4 4h13v16H4zM8 8h5M8 12h5M8 16h3M17 8h3v12H7",
  chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  menu: "M4 6h16M4 12h16M4 18h16",
  shield: "M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6zM9 12l2 2 4-4",
  search: "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15 15l5 5",
  bell: "M6 16V10a6 6 0 1 1 12 0v6l2 3H4zM10 19a2 2 0 0 0 4 0",
  check: "M4 12l5 5L20 7",
  plus: "M12 4v16M4 12h16",
  close: "M5 5l14 14M19 5L5 19",
  back: "M14 5l-7 7 7 7",
  play: "M7 4l13 8-13 8z",
  pin: "M9 3h6l-1 7 4 4v2H6v-2l4-4zM12 16v5",
};

/** Raw SVG string — exported for tests and non-React contexts. */
export function iconSvg(name: IconName, size = 24): string {
  return [
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"`,
    ` stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"`,
    ` aria-hidden="true"><path d="${PATHS[name]}" /></svg>`,
  ].join(" ");
}

/** Real React icon component. */
export function Icon({ name, size = 24 }: { name: IconName; size?: number }): React.ReactElement {
  return React.createElement("span", {
    dangerouslySetInnerHTML: { __html: iconSvg(name, size) },
    style: { display: "inline-flex", lineHeight: 0 },
  });
}
