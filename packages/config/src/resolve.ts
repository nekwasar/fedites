/**
 * Precedence engine (configuration.md §1):
 *   5. Element overrides > 4. Instance overrides > 3. Color Theme > 2. Style Family > 1. Platform Law
 * Deterministic composition of a resolved session view; deltas persist, so
 * "Minimalist family + Heritage color theme + outlined buttons" composes cleanly.
 */
import {
  type InstanceConfig,
  type ColorTheme,
  type ColorSlotName,
  type StyleFamily,
  type NavConfig,
  type Device,
  type NavPatternId,
  compatMatrix,
  instanceConfigSchema,
  sessionBootSchema,
} from "./schema.js";
import { familyById } from "./families.js";
import { themeById } from "./themes.js";
import { runLawGates } from "./law.js";

export interface ResolvedView {
  family: StyleFamily;
  theme: Record<ColorSlotName, string>;
  themeDark: Record<ColorSlotName, string>;
  variants: Record<string, string>;
  nav: NavConfig;
}

const DESKTOP_MIN_WIDTH = 1024;

export function resolveDevice(width: number | null, uaMobile: boolean): Device {
  if (uaMobile) return "mobile";
  if (width !== null && width < DESKTOP_MIN_WIDTH) return "mobile";
  return "desktop";
}

/** Pattern requests are validated against the compatibility matrix. */
export function validPattern(deviceKind: Device, pattern: NavPatternId): boolean {
  return compatMatrix[deviceKind].includes(pattern);
}

export function resolveConfig(
  config: InstanceConfig,
  opts: { device: Device },
): ResolvedView {
  void opts;
  const family = familyById(config.familyId);
  const overrides: Partial<Record<ColorSlotName, string>> | undefined = config.instance.colorOverrides;
  const theme = applyThemeOverrides(themeById(config.colorThemeId), overrides);

  const variants: Record<string, string> = { ...family.defaultVariants };
  for (const [element, variant] of Object.entries(config.elementOverrides)) {
    variants[element] = variant;
  }

  return {
    family,
    theme: theme.light,
    themeDark: theme.dark,
    variants,
    nav: config.nav,
  };
}

function applyThemeOverrides(
  theme: ColorTheme,
  overrides: Partial<Record<ColorSlotName, string>> | undefined,
): ColorTheme {
  if (!overrides || Object.keys(overrides).length === 0) return theme;
  const light: Record<ColorSlotName, string> = { ...theme.light };
  const dark: Record<ColorSlotName, string> = { ...theme.dark };
  for (const [slot, value] of Object.entries(overrides) as Array<[ColorSlotName, string]>) {
    if (value === undefined) continue;
    light[slot] = value;
    dark[slot] = value;
  }
  return { ...theme, preset: false, light, dark };
}

/** Validate + resolve, refusing anything that fails a Platform Law gate (§O). */
export function buildSessionBoot(
  rawConfig: unknown,
  opts: { instanceId: string; device: Device; member: null | { id: string; displayName: string; roles: string[]; verified: boolean } },
): ReturnType<typeof sessionBootSchema.parse> {
  const config = instanceConfigSchema.parse(rawConfig);
  const gates = runLawGates(config);
  if (!gates.ok) {
    throw new Error(`config failed Platform Law gates: ${gates.errors.join("; ")}`);
  }
  const view = resolveConfig(config, { device: opts.device });
  return sessionBootSchema.parse({
    instanceId: opts.instanceId,
    config,
    resolved: {
      theme: view.theme,
      themeDark: view.themeDark,
      family: view.family,
      variants: view.variants,
    },
    member: opts.member,
  });
}
