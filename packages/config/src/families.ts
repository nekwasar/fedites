/**
 * Style Families (configuration.md §3) — structure & style packs, never color.
 * Fedites Classic (default, signature), Minimalist, Editorial ship at MVP.
 * Roadmap families (Brutalist Grid, Soft/Modern, Material-inspired, Glassmorphism)
 * are intentionally NOT defined here yet.
 */
import type { StyleFamily, ElementOverrides } from "./schema.js";
import { elementVariantRegistry, isKnownElement, isKnownVariant } from "./schema.js";

export const feditesClassic: StyleFamily = {
  id: "fedites-classic",
  name: "Fedites Classic",
  version: 1,
  radius: { sm: "0px", md: "0px", lg: "0px", full: "9999px" },
  surface: "hairline",
  elevation: "none",
  blurAllowed: false,
  density: "compact",
  iconSet: "line",
  typePairing: {
    ui: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    masthead: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  press: "darken",
  defaultVariants: {
    navBar: "classic",
    button: "filled",
    input: "underline",
    row: "hairline",
    header: "masthead",
    modal: "full-sheet",
    toast: "banner",
    tabs: "underline-tabs",
    badge: "solid",
    icons: "line",
    avatar: "sharp",
    table: "hairline-grid",
    emptyState: "typographic-minimal",
    skeleton: "block",
    divider: "hairline",
    fab: "corner",
    dropdown: "plain",
    pagination: "simple",
    signatureSurface: "qr-ticket",
  },
};

export const minimalist: StyleFamily = {
  ...feditesClassic,
  id: "minimalist",
  name: "Minimalist",
  surface: "hairline",
  density: "roomy",
  defaultVariants: {
    ...feditesClassic.defaultVariants,
    navBar: "text-only",
    button: "outlined",
    row: "stacked-meta",
    header: "minimal",
    emptyState: "typographic-invitation",
    skeleton: "line-shimmer",
  },
};

export const editorial: StyleFamily = {
  ...feditesClassic,
  id: "editorial",
  name: "Editorial",
  surface: "hairline",
  density: "regular",
  typePairing: {
    ...feditesClassic.typePairing,
    masthead: 'Georgia, "Times New Roman", serif',
  },
  defaultVariants: {
    ...feditesClassic.defaultVariants,
    header: "masthead",
    tabs: "underline-tabs",
    divider: "ruled-double",
    table: "ruled",
  },
};

export const families: readonly StyleFamily[] = [feditesClassic, minimalist, editorial];

export function familyById(id: string): StyleFamily {
  const found = families.find((f) => f.id === id);
  if (found) return found;
  throw new Error(`Unknown style family: ${id}`);
}

/** Validate a family's declared default variants against the registry. */
export function validateFamilyVariants(family: StyleFamily): string[] {
  const errors: string[] = [];
  for (const element of Object.keys(elementVariantRegistry)) {
    const variant = family.defaultVariants[element];
    if (variant === undefined) {
      errors.push(`${family.id}: missing default variant for ${element}`);
      continue;
    }
    if (!isKnownVariant(element, variant)) {
      errors.push(`${family.id}: ${element}="${variant}" is not a registered variant`);
    }
  }
  return errors;
}

/** Every element must ship with multiple styles — registry enforces >= 2 variants each. */
export function registryCompleteness(): string[] {
  const errors: string[] = [];
  for (const [element, variants] of Object.entries(elementVariantRegistry)) {
    if (!isKnownElement(element)) continue;
    if (variants.length < 2) {
      errors.push(`${element} has fewer than 2 variants (configuration.md §5)`);
    }
  }
  return errors;
}

export function overrideErrors(family: StyleFamily, overrides: ElementOverrides): string[] {
  const errors: string[] = [];
  for (const [element, variant] of Object.entries(overrides)) {
    if (!isKnownElement(element)) {
      errors.push(`unknown element "${element}"`);
      continue;
    }
    if (!isKnownVariant(element, variant)) {
      errors.push(`element "${element}" has no variant "${variant}"`);
    }
    if (family.defaultVariants[element] === variant) {
      // Redundant override is allowed but flagged at Studio validation time.
      errors.push(`element "${element}" override equals family default`);
    }
  }
  return errors;
}
