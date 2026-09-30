/**
 * Curated Color Theme presets (configuration.md §2).
 * Wine Red + White is the Fedites default preset.
 * Slots: accent, accent-contrast, base, base-contrast, neutral-50..900,
 * success/warning/danger/info (+contrast), hairline, scrim + dark mirrors.
 */
import type { ColorTheme, ColorSlotName } from "./schema.js";

type Palette = Record<ColorSlotName, string>;

const neutral = (
  n50: string, n100: string, n200: string, n300: string, n400: string,
  n500: string, n600: string, n700: string, n800: string, n900: string,
): Pick<Palette, `neutral-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900}`> => ({
  "neutral-50": n50, "neutral-100": n100, "neutral-200": n200, "neutral-300": n300,
  "neutral-400": n400, "neutral-500": n500, "neutral-600": n600, "neutral-700": n700,
  "neutral-800": n800, "neutral-900": n900,
});

export function deriveTheme(
  id: string,
  name: string,
  light: Palette,
  dark: Palette,
): ColorTheme {
  return { id, name, preset: true, light, dark };
}

/* ---------------- presets ---------------- */

const wineRedWhite = deriveTheme("wine-red-white", "Wine Red + White",
  {
    accent: "#7B1E2B", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#1C1315",
    ...neutral("#FAF7F7", "#F2ECEC", "#E5DCDC", "#CFC1C1", "#B09E9E", "#8E7A7A", "#6D5A5A", "#4E3F3F", "#332727", "#1C1315"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#1F4E79", "info-contrast": "#FFFFFF",
    hairline: "#E5DCDC", scrim: "rgba(28,19,21,0.55)",
  } as Palette,
  {
    accent: "#D26978", "accent-contrast": "#161012", base: "#161012", "base-contrast": "#F5EDED",
    ...neutral("#1F1618", "#271C1E", "#342629", "#463437", "#5C474A", "#766063", "#937E81", "#B29EA1", "#D0C0C2", "#EDE4E5"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#342629", scrim: "rgba(8,5,6,0.65)",
  } as Palette);

const navyGold = deriveTheme("navy-gold", "Navy + Gold",
  {
    accent: "#0F2A4A", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#101B2B",
    ...neutral("#F7F9FB", "#EDF1F5", "#DCE3EA", "#C2CCD6", "#9FADBB", "#7C8C9C", "#5D6E7F", "#42525F", "#2B3743", "#101B2B"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#0F2A4A", "info-contrast": "#FFFFFF",
    hairline: "#DCE3EA", scrim: "rgba(16,27,43,0.55)",
  } as Palette,
  {
    accent: "#D4A937", "accent-contrast": "#101B2B", base: "#101B2B", "base-contrast": "#EEF2F6",
    ...neutral("#161F2C", "#1D2836", "#263444", "#34455A", "#485C74", "#63788F", "#8295A9", "#A2B2C2", "#C2CFDA", "#E6ECF2"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#263444", scrim: "rgba(5,9,14,0.65)",
  } as Palette);

const forestGreenCream = deriveTheme("forest-green-cream", "Forest Green + Cream",
  {
    accent: "#1F4D2E", "accent-contrast": "#FFFFFF", base: "#FBF7EC", "base-contrast": "#152418",
    ...neutral("#F8F4E9", "#F0EADC", "#E2D9C4", "#CCBF9F", "#AEA077", "#8B7F5B", "#6A6144", "#4B4530", "#312D20", "#152418"),
    success: "#1F4D2E", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#1F4E79", "info-contrast": "#FFFFFF",
    hairline: "#E2D9C4", scrim: "rgba(21,36,24,0.55)",
  } as Palette,
  {
    accent: "#7FBF8E", "accent-contrast": "#0E1A11", base: "#0E1A11", "base-contrast": "#EFF2E6",
    ...neutral("#151F17", "#1B281D", "#253527", "#334836", "#475F49", "#5F7A60", "#7C977C", "#9AB29A", "#BACBB9", "#E8EDE2"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#253527", scrim: "rgba(4,8,5,0.65)",
  } as Palette);

const maroonSky = deriveTheme("maroon-sky", "Maroon + Sky",
  {
    accent: "#6B1F2A", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#1C1214",
    ...neutral("#FAF6F6", "#F2EAEA", "#E4D8D8", "#CEBEBE", "#B09C9C", "#8D7878", "#6B5858", "#4C3E3E", "#312727", "#1C1214"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#2C6E8F", "info-contrast": "#FFFFFF",
    hairline: "#E4D8D8", scrim: "rgba(28,18,20,0.55)",
  } as Palette,
  {
    accent: "#D26978", "accent-contrast": "#150F10", base: "#150F10", "base-contrast": "#F4ECEC",
    ...neutral("#1D1516", "#251B1C", "#322527", "#443435", "#5B4849", "#746061", "#8F7B7C", "#AC9A9B", "#C9BCBD", "#E8E1E1"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#6FA9C9", "info-contrast": "#0C1B24",
    hairline: "#322527", scrim: "rgba(7,4,5,0.65)",
  } as Palette);

const royalBlueWhite = deriveTheme("royal-blue-white", "Royal Blue + White",
  {
    accent: "#1B3E8F", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#101A33",
    ...neutral("#F7F8FC", "#EDF0F8", "#DCE2F0", "#C3CDE3", "#A2B1CE", "#7E90B3", "#5F7192", "#44556F", "#2C3A4E", "#101A33"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#1B3E8F", "info-contrast": "#FFFFFF",
    hairline: "#DCE2F0", scrim: "rgba(16,26,51,0.55)",
  } as Palette,
  {
    accent: "#8FA9E8", "accent-contrast": "#0E1425", base: "#0E1425", "base-contrast": "#ECEFF8",
    ...neutral("#151B2B", "#1C2436", "#263148", "#35425E", "#4A5977", "#667693", "#8491AB", "#A3ADC2", "#C3C9D8", "#E9ECF5"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#263148", scrim: "rgba(4,7,13,0.65)",
  } as Palette);

const purpleSilver = deriveTheme("purple-silver", "Purple + Silver",
  {
    accent: "#4A2D73", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#191224",
    ...neutral("#F8F7FA", "#EFEDF4", "#E0DBEA", "#C9C2D8", "#ABA1C0", "#8A7EA1", "#6A5E80", "#4C4260", "#302A3E", "#191224"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#1F4E79", "info-contrast": "#FFFFFF",
    hairline: "#E0DBEA", scrim: "rgba(25,18,36,0.55)",
  } as Palette,
  {
    accent: "#B39BE0", "accent-contrast": "#150F21", base: "#150F21", "base-contrast": "#F0EDF7",
    ...neutral("#1B1524", "#231C2E", "#2F263C", "#403451", "#56476A", "#716186", "#8E7FA2", "#ACA0BD", "#CBC3D9", "#EEEAF6"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#2F263C", scrim: "rgba(6,4,9,0.65)",
  } as Palette);

const blackOrange = deriveTheme("black-orange", "Black + Orange",
  {
    accent: "#B34700", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#1A120C",
    ...neutral("#FAF8F6", "#F2EEE9", "#E5DED5", "#D0C5B6", "#B3A591", "#90826E", "#6E6353", "#4E463B", "#312C25", "#1A120C"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#1F4E79", "info-contrast": "#FFFFFF",
    hairline: "#E5DED5", scrim: "rgba(26,18,12,0.55)",
  } as Palette,
  {
    accent: "#E8763B", "accent-contrast": "#170F09", base: "#170F09", "base-contrast": "#F5EFEB",
    ...neutral("#1E1610", "#261C15", "#34261C", "#473527", "#5F4936", "#7A604A", "#987C63", "#B6987E", "#D3B89E", "#F1E7DF"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#34261C", scrim: "rgba(7,4,2,0.65)",
  } as Palette);

const tealCoral = deriveTheme("teal-coral", "Teal + Coral",
  {
    accent: "#0F5B5B", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#0F1B1B",
    ...neutral("#F6FAFA", "#EBF3F3", "#D8E8E8", "#BBD5D5", "#95BCBC", "#6F9E9E", "#517D7D", "#395E5E", "#243F3F", "#0F1B1B"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A83232", "danger-contrast": "#FFFFFF", info: "#1F4E79", "info-contrast": "#FFFFFF",
    hairline: "#D8E8E8", scrim: "rgba(15,27,27,0.55)",
  } as Palette,
  {
    accent: "#5FBFBF", "accent-contrast": "#081313", base: "#081313", "base-contrast": "#EAF3F3",
    ...neutral("#101C1C", "#162525", "#1E3232", "#2A4343", "#3A5858", "#4E7272", "#688C8C", "#86A7A7", "#A6C2C2", "#E2EEEE"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#1E3232", scrim: "rgba(2,6,6,0.65)",
  } as Palette);

const heritageBrownParchment = deriveTheme("heritage-brown-parchment", "Heritage Brown + Parchment",
  {
    accent: "#5B3A1E", "accent-contrast": "#FFFFFF", base: "#F9F4E8", "base-contrast": "#211609",
    ...neutral("#F7F1E3", "#EFE7D3", "#E1D4B8", "#CBBB96", "#AE9B70", "#8C7D57", "#6B603F", "#4B442C", "#302B1C", "#211609"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#A32020", "danger-contrast": "#FFFFFF", info: "#1F4E79", "info-contrast": "#FFFFFF",
    hairline: "#E1D4B8", scrim: "rgba(33,22,9,0.55)",
  } as Palette,
  {
    accent: "#C89B66", "accent-contrast": "#1A1207", base: "#1A1207", "base-contrast": "#F3ECDD",
    ...neutral("#201710", "#281D14", "#36281B", "#493725", "#614A31", "#7C6142", "#997C57", "#B6976F", "#D2B58D", "#EFE4D0"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#36281B", scrim: "rgba(6,4,2,0.65)",
  } as Palette);

const slateCrimson = deriveTheme("slate-crimson", "Slate + Crimson",
  {
    accent: "#7C1D33", "accent-contrast": "#FFFFFF", base: "#FFFFFF", "base-contrast": "#141A21",
    ...neutral("#F6F8FA", "#ECF0F3", "#DBE2E8", "#C1CCD4", "#A0AFBA", "#7E8F9C", "#5F707D", "#44545F", "#2B3841", "#141A21"),
    success: "#1E6B3A", "success-contrast": "#FFFFFF", warning: "#8A6A00", "warning-contrast": "#FFFFFF",
    danger: "#7C1D33", "danger-contrast": "#FFFFFF", info: "#1F4E79", "info-contrast": "#FFFFFF",
    hairline: "#DBE2E8", scrim: "rgba(20,26,33,0.55)",
  } as Palette,
  {
    accent: "#D9627E", "accent-contrast": "#170E11", base: "#12171D", "base-contrast": "#EDF0F3",
    ...neutral("#171C22", "#1E242B", "#293039", "#384150", "#4D5A68", "#697685", "#87929F", "#A5AEB8", "#C4CAD1", "#EBEEF1"),
    success: "#63C58A", "success-contrast": "#10241A", warning: "#D9B44A", "warning-contrast": "#241D08",
    danger: "#E06666", "danger-contrast": "#2A1010", info: "#7FA8D9", "info-contrast": "#0F1B2A",
    hairline: "#293039", scrim: "rgba(4,6,8,0.65)",
  } as Palette);

export const themePresets: readonly ColorTheme[] = [
  wineRedWhite,
  navyGold,
  forestGreenCream,
  maroonSky,
  royalBlueWhite,
  purpleSilver,
  blackOrange,
  tealCoral,
  heritageBrownParchment,
  slateCrimson,
];

export const defaultThemeId = "wine-red-white";

export function themeById(id: string): ColorTheme {
  const found = themePresets.find((t) => t.id === id);
  if (found) return found;
  throw new Error(`Unknown color theme: ${id}`);
}
