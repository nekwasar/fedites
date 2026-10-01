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
  family: {
    typePairing: { ui: string; mono: string; masthead: string };
    radius: { sm: string; md: string; lg: string };
    density?: "compact" | "regular" | "roomy";
    surface?: "hairline" | "tonal" | "glass";
  },
): void {
  target.style.setProperty("--family-font-ui", family.typePairing.ui);
  target.style.setProperty("--family-font-mono", family.typePairing.mono);
  target.style.setProperty("--family-font-masthead", family.typePairing.masthead);
  target.style.setProperty("--family-radius-sm", family.radius.sm);
  target.style.setProperty("--family-radius-md", family.radius.md);
  target.style.setProperty("--family-radius-lg", family.radius.lg);
  // Density (configuration.md §3): rhythm per family.
  const density = family.density ?? "compact";
  const rhythm = density === "compact"
    ? { row: "56px", padX: "16px", padY: "12px", gap: "12px" }
    : density === "regular"
      ? { row: "64px", padX: "20px", padY: "16px", gap: "16px" }
      : { row: "72px", padX: "24px", padY: "20px", gap: "20px" };
  target.style.setProperty("--density-row-h", rhythm.row);
  target.style.setProperty("--density-pad-x", rhythm.padX);
  target.style.setProperty("--density-pad-y", rhythm.padY);
  target.style.setProperty("--density-gap", rhythm.gap);
  // Surface treatment: tonal families raise alternate surfaces.
  if (family.surface === "tonal") {
    target.style.setProperty("--surface-alt", "var(--c-neutral-100)");
    target.style.setProperty("--surface-raised", "var(--c-neutral-50)");
  } else {
    target.style.setProperty("--surface-alt", "var(--c-neutral-50)");
    target.style.setProperty("--surface-raised", "var(--c-base)");
  }
}
