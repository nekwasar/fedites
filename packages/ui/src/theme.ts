/**
 * Theme application — mounts the resolved Color Theme as CSS variables
 * and the family as family tokens (M1: components reference variables only).
 * This is what makes "theme preset switches live in-app" (0.3 demo gate) work.
 */
import type { ColorSlotName } from "@fedites/config";
import { cssVarName, colorSlots } from "@fedites/tokens";

export function applyTheme(
  target: HTMLElement,
  theme: Record<ColorSlotName, string>,
): void {
  for (const slot of colorSlots) {
    const value = theme[slot];
    if (value !== undefined) target.style.setProperty(cssVarName(slot), value);
  }
}

export function applyFamily(
  target: HTMLElement,
  family: { typePairing: { ui: string; mono: string; masthead: string }; radius: { sm: string; md: string; lg: string } },
): void {
  target.style.setProperty("--family-font-ui", family.typePairing.ui);
  target.style.setProperty("--family-font-mono", family.typePairing.mono);
  target.style.setProperty("--family-font-masthead", family.typePairing.masthead);
  target.style.setProperty("--family-radius-sm", family.radius.sm);
  target.style.setProperty("--family-radius-md", family.radius.md);
  target.style.setProperty("--family-radius-lg", family.radius.lg);
}
