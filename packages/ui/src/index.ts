/**
 * Fedites component library — Phase 0 primitives (rules.md M2: every UI
 * element comes from here; no one-offs in apps).
 */
import { cssVarName } from "@fedites/tokens";

export { applyTheme, applyFamily } from "./theme.js";

/** The one-true color source used by inline SVG icon strokes. */
export function accentVar(): string {
  return `var(${cssVarName("accent")})`;
}

/* D1: one custom line-icon set, single stroke weight. No emojis. */
export interface IconProps {
  name: "house" | "news" | "chat" | "calendar" | "menu" | "shield" | "search" | "bell";
  size?: number;
}

export function Icon({ name, size = 24 }: IconProps): string {
  const stroke = 1.5; // single stroke weight
  const paths: Record<IconProps["name"], string> = {
    house: "M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10",
    news: "M4 4h13v16H4zM8 8h5M8 12h5M8 16h3M17 8h3v12H7",
    chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
    calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
    menu: "M4 6h16M4 12h16M4 18h16",
    shield: "M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6zM9 12l2 2 4-4",
    search: "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15 15l5 5",
    bell: "M6 16V10a6 6 0 1 1 12 0v6l2 3H4zM10 19a2 2 0 0 0 4 0",
  };
  return [
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"`,
    ` stroke="currentColor" stroke-width="${stroke}" stroke-linecap="square" stroke-linejoin="miter"`,
    ` aria-hidden="true"><path d="${paths[name]}" /></svg>`,
  ].join(" ");
}
