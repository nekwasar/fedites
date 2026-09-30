import { describe, it, expect } from "vitest";
import {
  defaultConfig,
  themePresets,
  runLawGates,
  resolveConfig,
  registryCompleteness,
  validateFamilyVariants,
  families,
  contrastRatio,
  compatMatrix,
  fixedNavItems,
  visibleItems,
} from "./index.js";

describe("default config", () => {
  it("passes all Platform Law gates", () => {
    const gates = runLawGates(defaultConfig);
    expect(gates.errors).toEqual([]);
    expect(gates.ok).toBe(true);
  });

  it("defaults to wine red + white and the Classic family", () => {
    expect(defaultConfig.colorThemeId).toBe("wine-red-white");
    expect(defaultConfig.familyId).toBe("fedites-classic");
  });
});

describe("color themes (configuration.md §2)", () => {
  it("ships the 10 curated presets", () => {
    expect(themePresets).toHaveLength(10);
  });

  it("every preset defines all slots in both modes", () => {
    const required = 24;
    for (const t of themePresets) {
      expect(Object.keys(t.light).length, t.id).toBe(required);
      expect(Object.keys(t.dark).length, t.id).toBe(required);
    }
  });

  it("accent-contrast passes AA on accent in both modes (law gate)", () => {
    for (const t of themePresets) {
      const lAccent = t.light.accent ?? "";
      const lAccentC = t.light["accent-contrast"] ?? "";
      const dAccent = t.dark.accent ?? "";
      const dAccentC = t.dark["accent-contrast"] ?? "";
      const lBase = t.light.base ?? "";
      const lBaseC = t.light["base-contrast"] ?? "";
      const dBase = t.dark.base ?? "";
      const dBaseC = t.dark["base-contrast"] ?? "";
      expect(contrastRatio(lAccentC, lAccent), `${t.id} light`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dAccentC, dAccent), `${t.id} dark`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lBaseC, lBase), `${t.id} base light`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dBaseC, dBase), `${t.id} base dark`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("style families (configuration.md §3)", () => {
  it("MVP ships exactly Classic, Minimalist, Editorial", () => {
    expect(families.map((f) => f.id)).toEqual(["fedites-classic", "minimalist", "editorial"]);
  });

  it("Classic pins radius to 0 (A5) and uses hairline surfaces with no elevation (A1/A4)", () => {
    const classic = families[0]!;
    expect(classic.radius.sm).toBe("0px");
    expect(classic.radius.md).toBe("0px");
    expect(classic.radius.lg).toBe("0px");
    expect(classic.surface).toBe("hairline");
    expect(classic.elevation).toBe("none");
    expect(classic.blurAllowed).toBe(false);
  });

  it("every family defines a default variant for every element", () => {
    expect(registryCompleteness()).toEqual([]);
    for (const f of families) {
      expect(validateFamilyVariants(f), f.id).toEqual([]);
    }
  });
});

describe("nav (configuration.md §4)", () => {
  it("fixed item set is the five tabs; manage is role-gated", () => {
    expect(fixedNavItems).toEqual(["groups", "feed", "chat", "events", "menu"]);
    const all = visibleItems(defaultConfig.nav, true);
    const some = visibleItems(defaultConfig.nav, false);
    expect(all.map((i) => i.item)).toContain("manage");
    expect(some.map((i) => i.item)).not.toContain("manage");
  });

  it("compatibility matrix keeps mobile and desktop patterns separate", () => {
    expect(compatMatrix.mobile).not.toContain("side-rail");
    expect(compatMatrix.desktop).not.toContain("tab-bar");
  });
});

describe("resolution precedence (configuration.md §1)", () => {
  it("element overrides win over family defaults", () => {
    const config = { ...defaultConfig, elementOverrides: { button: "outlined" } };
    const view = resolveConfig(config, { device: "mobile" });
    expect(view.variants.button).toBe("outlined");
    expect(view.variants.row).toBe("hairline");
  });

  it("family switch changes variants and type pairing without touching color", () => {
    const config = { ...defaultConfig, familyId: "editorial" as const };
    const view = resolveConfig(config, { device: "desktop" });
    expect(view.variants.divider).toBe("ruled-double");
    expect(view.family.typePairing.masthead).toContain("serif");
    expect(view.theme.accent).toBe("#7B1E2B");
  });

  it("nav pattern swap via config (0.4 demo gate)", () => {
    const config = {
      ...defaultConfig,
      nav: { ...defaultConfig.nav, mobile: "floating-dock" as const, desktop: "top+side" as const },
    };
    const view = resolveConfig(config, { device: "mobile" });
    expect(view.nav.mobile).toBe("floating-dock");
    expect(view.nav.desktop).toBe("top+side");
  });
});

describe("law gates reject bad configs", () => {
  it("rejects emoji in system copy (D1)", () => {
    const config = structuredClone(defaultConfig);
    config.instance.copy["tab.chat.job"] = "Chats with friends \u{1F600}";
    const gates = runLawGates(config);
    expect(gates.ok).toBe(false);
    expect(gates.errors.join()).toContain("D1");
  });

  it("rejects unregistered element overrides", () => {
    const config = { ...defaultConfig, elementOverrides: { button: "glassmorphic" } };
    const gates = runLawGates(config);
    expect(gates.ok).toBe(false);
  });

  it("rejects a custom palette that fails AA contrast", () => {
    const config = structuredClone(defaultConfig);
    config.instance.colorOverrides = {
      accent: "#EEEEEE",
      "accent-contrast": "#FFFFFF",
    };
    const gates = runLawGates(config);
    expect(gates.ok).toBe(false);
    expect(gates.errors.join()).toContain("WCAG AA");
  });

  it("rejects missing nav labels for fixed items (I2)", () => {
    const config = structuredClone(defaultConfig);
    delete (config.nav.labels as Record<string, string | undefined>)["feed"];
    const gates = runLawGates(config);
    expect(gates.ok).toBe(false);
    expect(gates.errors.join()).toContain("feed");
  });
});
