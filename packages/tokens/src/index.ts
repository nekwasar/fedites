/**
 * Fedites design tokens — the only place raw values may live (rules.md M1).
 *
 * - Radius is a token; 0 is the Classic signature (A5).
 * - Spacing strictly on the 4/8px scale (A11).
 * - Locked type scale: 11/13/15/17/22/32/48 (B4).
 * - Locked breakpoints: 360/768/1024/1440 (E7).
 * - Motion: transform/opacity only, 150-250ms ease-out (F2); press ~100ms (F1).
 * - 44px minimum touch target (E9/L5).
 *
 * Color is NOT a token here — color lives in the Color Theme layer
 * (configuration.md §2). Tokens only reference color-slot NAMES.
 */

export const spacing = {
  "0": "0px",
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "6": "24px",
  "8": "32px",
  "12": "48px",
  "16": "64px",
  "20": "80px",
} as const;

export const typeSizes = {
  micro: "11px",
  body2: "13px",
  body: "15px",
  body1: "17px",
  title: "22px",
  headline: "32px",
  display: "48px",
} as const;

export const lineHeight = {
  micro: "16px",
  body2: "18px",
  body: "22px",
  body1: "24px",
  title: "28px",
  headline: "38px",
  display: "52px",
} as const;

/** Font weight steps — hierarchy comes from weight/size/case, never a second family (B1). */
export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const radius = {
  none: "0px",
  sm: "0px", // Classic pins the whole scale to 0; other families raise it via family config
  md: "0px",
  lg: "0px",
  full: "9999px",
} as const;

export const motion = {
  press: "100ms",
  fast: "150ms",
  base: "200ms",
  slow: "250ms",
  ease: "ease-out",
} as const;

export const breakpoints = {
  sm: "360px",
  md: "768px",
  lg: "1024px",
  xl: "1440px",
} as const;

export const tapTarget = "44px";

/** Density rhythm per family; Classic is compact. */
export const density = {
  rowHeight: "56px",
  rowPaddingX: "16px",
  rowPaddingY: "12px",
  hairline: "1px",
} as const;

export type FontSlot = "ui" | "mono" | "masthead";

/** B1: one family + one mono. Families may pair a different masthead face (Editorial). */
export const fontFamilies = {
  ui: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  masthead: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
} as const;

/** Color slot names owned by the Color Theme layer (configuration.md §2). */
export const colorSlots = [
  "accent",
  "accent-contrast",
  "base",
  "base-contrast",
  "neutral-50",
  "neutral-100",
  "neutral-200",
  "neutral-300",
  "neutral-400",
  "neutral-500",
  "neutral-600",
  "neutral-700",
  "neutral-800",
  "neutral-900",
  "success",
  "success-contrast",
  "warning",
  "warning-contrast",
  "danger",
  "danger-contrast",
  "info",
  "info-contrast",
  "hairline",
  "scrim",
] as const;

export type ColorSlot = (typeof colorSlots)[number];

export const cssVarName = (slot: string): string => `--c-${slot}`;
