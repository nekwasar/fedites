/**
 * Zod schemas — the single source of truth for instance configuration
 * (configuration.md §1-§6, spec.md §15). API types are inferred from here (M6).
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Color Theme layer (configuration.md §2) — NEVER part of a family    */
/* ------------------------------------------------------------------ */

export const colorSlotName = z.enum([
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
]);
export type ColorSlotName = z.infer<typeof colorSlotName>;

/** Hex colors plus rgba() (used by the scrim slot). */
export const colorValue = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]){6}$|^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/,
    "hex #rrggbb or rgba(r,g,b,a)",
  );

const fullColorRecord = z.record(colorSlotName, colorValue) as unknown as z.ZodType<Record<ColorSlotName, string>>;

export const colorThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Curated preset or custom; custom must pass law gates before publish. */
  preset: z.boolean(),
  light: fullColorRecord,
  dark: fullColorRecord,
});
export type ColorTheme = z.infer<typeof colorThemeSchema>;

/* ------------------------------------------------------------------ */
/* Style Families (configuration.md §3) — structure & style, no color  */
/* ------------------------------------------------------------------ */

export const familyId = z.enum(["fedites-classic", "minimalist", "editorial"]);
export type FamilyId = z.infer<typeof familyId>;

export const surfaceTreatment = z.enum(["hairline", "tonal", "glass"]);

export const pressStyle = z.enum(["darken", "ripple", "scale"]);

export const familySchema = z.object({
  id: familyId,
  name: z.string(),
  version: z.number().int().positive(),
  /** A5: radius is a token the family may raise; Classic pins 0. */
  radius: z.object({ sm: z.string().regex(/^\d+(px|%)$/), md: z.string().regex(/^\d+(px|%)$/), lg: z.string().regex(/^\d+(px|%)$/), full: z.string().regex(/^\d+(px|%)$/) }),
  surface: surfaceTreatment,
  elevation: z.enum(["none", "subtle", "layered"]),
  blurAllowed: z.boolean(),
  density: z.enum(["compact", "regular", "roomy"]),
  iconSet: z.enum(["line", "filled", "duotone"]),
  typePairing: z.object({ ui: z.string(), mono: z.string(), masthead: z.string() }),
  /** F1: each family implements its own press state. */
  press: pressStyle,
  /** Default variant per element (configuration.md §5). */
  defaultVariants: z.record(z.string(), z.string()),
});
export type StyleFamily = z.infer<typeof familySchema>;

/* ------------------------------------------------------------------ */
/* Element Variant Registry (configuration.md §5)                      */
/* ------------------------------------------------------------------ */

export const elementVariantRegistry: Record<string, readonly string[]> = {
  navBar: ["classic", "floating", "labeled-icons", "text-only"],
  button: ["filled", "outlined", "underline-link", "tonal"],
  input: ["underline", "boxed", "inline"],
  row: ["hairline", "zebra", "stacked-meta"],
  header: ["masthead", "minimal", "data-bar"],
  modal: ["full-sheet", "centered-modal", "anchored-panel", "drawer"],
  toast: ["banner", "snackbar", "inline-callout"],
  tabs: ["underline-tabs", "pill-segments", "boxed-tabs"],
  badge: ["solid", "outline", "dot"],
  icons: ["line", "filled", "duotone"],
  avatar: ["sharp", "rounded", "circled"],
  table: ["hairline-grid", "zebra", "ruled"],
  emptyState: ["typographic-minimal", "typographic-invitation"],
  skeleton: ["block", "line-shimmer"],
  divider: ["hairline", "ruled-double"],
  fab: ["corner", "docked-inline"],
  dropdown: ["plain", "bordered"],
  pagination: ["simple", "numbered"],
  signatureSurface: ["qr-ticket", "alumni-id", "countdown"],
};
export type ElementName = keyof typeof elementVariantRegistry;

export const elementOverridesSchema = z.record(z.string(), z.string());
export type ElementOverrides = Record<string, string>;

export function isKnownElement(name: string): name is ElementName {
  return name in elementVariantRegistry;
}

export function isKnownVariant(element: string, variant: string): boolean {
  const allowed = elementVariantRegistry[element];
  return allowed !== undefined && allowed.includes(variant);
}

/* ------------------------------------------------------------------ */
/* Navigation geometry (configuration.md §4)                           */
/* ------------------------------------------------------------------ */

export const navItem = z.enum(["groups", "feed", "chat", "events", "menu", "manage"]);
export type NavItem = z.infer<typeof navItem>;

/** I2: the fixed item set — items stay, geometry moves. */
export const fixedNavItems: readonly NavItem[] = ["groups", "feed", "chat", "events", "menu"];

export const navPatternId = z.enum([
  "tab-bar",
  "top-tabs",
  "hybrid",
  "drawer",
  "floating-dock",
  "side-rail",
  "top-nav",
  "top+side",
  "command-first",
]);
export type NavPatternId = z.infer<typeof navPatternId>;

export const device = z.enum(["mobile", "desktop"]);
export type Device = z.infer<typeof device>;

export const mobilePatterns = ["tab-bar", "top-tabs", "hybrid", "drawer", "floating-dock"] as const;
export const desktopPatterns = ["side-rail", "top-nav", "top+side", "command-first"] as const;

export const navConfigSchema = z.object({
  mobile: z.enum(mobilePatterns),
  desktop: z.enum(desktopPatterns),
  /** Overflow owner per pattern (e.g. tab-bar's More sheet). */
  labels: z.record(navItem, z.string()),
});
export type NavConfig = z.infer<typeof navConfigSchema>;

/** Validated compatibility matrix: pattern x device x item-count (configuration.md §4). */
export const compatMatrix: Record<Device, readonly NavPatternId[]> = {
  mobile: mobilePatterns,
  desktop: desktopPatterns,
};

/* ------------------------------------------------------------------ */
/* Structure & behavior (configuration.md §6)                          */
/* ------------------------------------------------------------------ */

export const groupType = z.enum([
  "set",
  "chapter",
  "interest",
  "guild",
  "house",
  "committee",
]);
export type GroupType = z.infer<typeof groupType>;

export const groupTypeConfigSchema = z.object({
  type: groupType,
  enabled: z.boolean(),
  label: z.string(),
  joining: z.enum(["auto-join", "auto-assign", "one-tap", "request", "proposal", "invite-only"]),
});
export type GroupTypeConfig = z.infer<typeof groupTypeConfigSchema>;

export const behaviorPolicySchema = z.object({
  vouching: z.object({ enabled: z.boolean(), setmatesRequired: z.number().int().min(1).max(10), adminOverride: z.boolean() }),
  probationCapabilities: z.object({ readEverything: z.boolean(), groupPosts: z.boolean(), dms: z.boolean(), money: z.boolean(), eventRsvp: z.boolean() }),
  votingEligibility: z.enum(["all-verified", "dues-paying"]),
  eventCreation: z.enum(["admins-and-group-admins", "admins"]),
  dues: z.object({ cycle: z.enum(["annual", "semiannual", "quarterly", "monthly"]), reminders: z.array(z.string()) }),
  emergencyBroadcast: z.enum(["any-admin-plus-second-approval", "super-admins-only"]),
  chatEditWindowMinutes: z.number().int().min(0).max(1440),
  chatDeleteOwnAnytime: z.boolean(),
  newsCommentsDefault: z.boolean(),
  donorWallDefaultNamed: z.boolean(),
  faceSearch: z.enum(["self-only", "off"]),
  locationPrecision: z.enum(["city", "precise-at-events"]),
  quietHoursDefault: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
});
export type BehaviorPolicy = z.infer<typeof behaviorPolicySchema>;

export const featureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const terminologySchema = z.record(z.string(), z.string());
export type Terminology = Record<string, string>;

export const copyTableSchema = z.record(z.string(), z.string());
export type CopyTable = Record<string, string>;

/* ------------------------------------------------------------------ */
/* The full instance config document (configuration.md §8)             */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Page architecture configs (MODULE spec: chat + careers)             */
/* ------------------------------------------------------------------ */

export const chatHeaderVariantEnum = z.enum(["standard", "messenger", "telegram"]);
export const chatItemVariantEnum = z.enum(["standard", "card", "dense"]);
export const fabPlacementEnum = z.enum(["bottom-right", "bottom-center"]);
export const chatFilterEnum = z.enum(["all", "unread", "groups", "favorites"]);

export const chatPageSchema = z.object({
  headerVariant: chatHeaderVariantEnum.default("standard"),
  itemVariant: chatItemVariantEnum.default("standard"),
  filterChips: z.object({
    enabled: z.boolean().default(true),
    options: z.array(chatFilterEnum).default(["all", "unread", "groups", "favorites"]),
  }).default({}),
  fab: z.object({
    placement: fabPlacementEnum.default("bottom-right"),
  }).default({}),
});
export type ChatPageConfig = z.infer<typeof chatPageSchema>;

export const careersHeaderVariantEnum = z.enum(["standard", "indeed", "linkedin"]);
export const jobCardVariantEnum = z.enum(["standard", "card", "compact"]);

export const careersPageSchema = z.object({
  headerVariant: careersHeaderVariantEnum.default("standard"),
  jobCardVariant: jobCardVariantEnum.default("standard"),
  filterChips: z.object({
    enabled: z.boolean().default(true),
    options: z.array(z.string()).default(["remote", "full-time", "internship", "graduate"]),
  }).default({}),
});
export type CareersPageConfig = z.infer<typeof careersPageSchema>;

export const instanceConfigSchema = z.object({
  /** Config document version — every publish bumps; rollback = republish older snapshot. */
  schemaVersion: z.number().int().positive(),
  publishedAt: z.string().datetime().nullable(),
  familyId: familyId,
  colorThemeId: z.string(),
  nav: navConfigSchema,
  elementOverrides: elementOverridesSchema,
  chatPage: chatPageSchema.default({}),
  careersPage: careersPageSchema.default({}),
  instance: z.object({
    /** Zero school-specific constants in code — everything flows from here. */
    displayName: z.string().min(1),
    shortName: z.string().min(1),
    /** Default currency for money (multi-currency entries may override). */
    currency: z.string().length(3).default("NGN"),
    terminology: terminologySchema,
    copy: copyTableSchema,
    flags: z.array(featureFlagSchema),
    groupTypes: z.array(groupTypeConfigSchema),
    behavior: behaviorPolicySchema,
    /** Custom palette overriding the preset theme's slots; validated by law gates. */
    colorOverrides: z.record(colorSlotName, colorValue).optional(),
  }),
});
export type InstanceConfig = z.infer<typeof instanceConfigSchema>;

/* ------------------------------------------------------------------ */
/* Session-boot payload (configuration.md §8: API returns config at    */
/* session boot; served via CDN cache)                                 */
/* ------------------------------------------------------------------ */

export const sessionBootSchema = z.object({
  instanceId: z.string().uuid(),
  config: instanceConfigSchema,
  resolved: z.object({
    theme: fullColorRecord,
    themeDark: fullColorRecord,
    family: familySchema,
    variants: z.record(z.string(), z.string()),
  }),
  member: z
    .object({
      id: z.string().uuid(),
      displayName: z.string(),
      roles: z.array(z.string()),
      verified: z.boolean(),
    })
    .nullable(),
});
export type SessionBoot = z.infer<typeof sessionBootSchema>;
