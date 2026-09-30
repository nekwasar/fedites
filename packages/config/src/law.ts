/**
 * Platform Law gates (rules.md §O, configuration.md §3/§9).
 * The Studio and the API refuse to publish any config that fails these.
 * Law is never configurable; it binds every family, variant, and theme.
 */
import {
  instanceConfigSchema,
  elementVariantRegistry,
  isKnownElement,
  isKnownVariant,
  compatMatrix,
  fixedNavItems,
  type NavPatternId,
  type InstanceConfig,
} from "./schema.js";
import { validateFamilyVariants, overrideErrors, familyById } from "./families.js";

/* WCAG AA contrast ratio floor for text pairs. */
const AA_RATIO = 4.5;

export interface LawGateResult {
  ok: boolean;
  errors: string[];
}

/** Parse a #rrggbb color to [r,g,b]. */
function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return [0, 0, 0];
  const int = parseInt(m[1] as string, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function gateContrast(config: InstanceConfig): string[] {
  const errors: string[] = [];
  // Contrast of text-on-base pairs. Custom palettes are validated here;
  // curated presets ship pre-validated (configuration.md §2).
  if (config.instance.colorOverrides) {
    const o = config.instance.colorOverrides;
    const pairs: Array<[string, string, string]> = [];
    if (o.accent && o["accent-contrast"]) pairs.push(["accent-contrast", o["accent-contrast"], o.accent]);
    if (o.base && o["base-contrast"]) pairs.push(["base-contrast", o["base-contrast"], o.base]);
    for (const [label, fg, bg] of pairs) {
      if (contrastRatio(fg, bg) < AA_RATIO) {
        errors.push(`${label} on its background fails WCAG AA (${contrastRatio(fg, bg).toFixed(2)} < ${AA_RATIO})`);
      }
    }
  }
  return errors;
}

function gateNav(config: InstanceConfig): string[] {
  const errors: string[] = [];
  // Fixed item set: groups, feed, chat, events, menu (+ manage for role-holders) — I2.
  // Nav labels must exist for every fixed item.
  for (const item of fixedNavItems) {
    if (config.nav.labels[item] === undefined) {
      errors.push(`nav label missing for fixed item "${item}"`);
    }
  }
  // Compatibility matrix (configuration.md §4).
  const mobileOk = compatMatrix.mobile.includes(config.nav.mobile as NavPatternId);
  const desktopOk = compatMatrix.desktop.includes(config.nav.desktop as NavPatternId);
  if (!mobileOk) errors.push(`mobile nav pattern "${config.nav.mobile}" not in compatibility matrix`);
  if (!desktopOk) errors.push(`desktop nav pattern "${config.nav.desktop}" not in compatibility matrix`);
  return errors;
}

function gateVariants(config: InstanceConfig): string[] {
  const errors: string[] = [];
  for (const [element, variant] of Object.entries(config.elementOverrides)) {
    if (!isKnownElement(element) || !isKnownVariant(element, variant)) {
      errors.push(`element override ${element}="${variant}" is not registered`);
    } else if (!elementVariantRegistry[element]!.includes(variant)) {
      errors.push(`element override ${element}="${variant}" not in registry`);
    }
  }
  return errors;
}

function gateTerminology(config: InstanceConfig): string[] {
  const errors: string[] = [];
  // Terminology glossary must provide labels for the six group types it enables.
  for (const gt of config.instance.groupTypes) {
    if (gt.enabled && gt.label.trim().length === 0) {
      errors.push(`enabled group type "${gt.type}" has an empty label`);
    }
  }
  return errors;
}

function gateNoEmojis(config: InstanceConfig): string[] {
  // D1: system strings (copy tables, nav labels, terminology) must contain no emojis.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  const errors: string[] = [];
  const strings: Array<[string, string]> = [
    ...Object.entries(config.nav.labels).map(([k, v]) => [`nav.labels.${k}`, v] as [string, string]),
    ...Object.entries(config.instance.terminology).map(([k, v]) => [`terminology.${k}`, v] as [string, string]),
    ...Object.entries(config.instance.copy).map(([k, v]) => [`copy.${k}`, v] as [string, string]),
  ];
  for (const [key, value] of strings) {
    if (emoji.test(value)) errors.push(`${key} contains an emoji (D1)`);
  }
  return errors;
}

/** Run every law gate against a config document. */
export function runLawGates(rawConfig: unknown): LawGateResult {
  const errors: string[] = [];
  const parsed = instanceConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `schema: ${i.path.join(".")}: ${i.message}`) };
  }
  const config = parsed.data;

  // Family-level variant completeness (every element has a default variant).
  const family = validateFamilyVariantsSafe(config.familyId);
  errors.push(...family);
  errors.push(...overrideErrorsSafe(config.familyId, config.elementOverrides));
  errors.push(...gateContrast(config));
  errors.push(...gateNav(config));
  errors.push(...gateVariants(config));
  errors.push(...gateTerminology(config));
  errors.push(...gateNoEmojis(config));

  return { ok: errors.length === 0, errors };
}

function validateFamilyVariantsSafe(familyId: string): string[] {
  try {
    return validateFamilyVariants(familyById(familyId));
  } catch (e) {
    return [String(e)];
  }
}

function overrideErrorsSafe(familyId: string, overrides: Record<string, string>): string[] {
  try {
    return overrideErrors(familyById(familyId), overrides).filter((e) => !e.includes("equals family default"));
  } catch (e) {
    return [String(e)];
  }
}
