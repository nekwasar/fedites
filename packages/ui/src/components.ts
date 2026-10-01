/**
 * Fedites UI library — the variant registry as real React components
 * (configuration.md §5: every element has multiple style variants; the
 * resolved variant comes from the session-boot config: family defaults +
 * element overrides, precedence engine). Screens compose these; no hand-
 * rolled styling anywhere (M1/M2).
 *
 * Style families drive density/surface/press via CSS variables; Color Theme
 * drives every color. Components reference tokens only.
 */
import React, { createContext, useContext } from "react";
import { iconSvg, type IconName } from "./index.js";

export interface UiConfig {
  /** Resolved variants per element (session boot `resolved.variants`). */
  variants: Record<string, string>;
  density: "compact" | "regular" | "roomy";
  surface: "hairline" | "tonal" | "glass";
  press: "darken" | "ripple" | "scale";
}

const DEFAULT_UI: UiConfig = {
  variants: {},
  density: "compact",
  surface: "hairline",
  press: "darken",
};

export const UiContext = createContext<UiConfig>(DEFAULT_UI);
export const UiProvider = UiContext.Provider;
export function useUi(): UiConfig {
  return useContext(UiContext);
}

/** Variant of an element, from resolved config or a per-use override. */
export function useVariant(element: string, fallback: string, override?: string): string {
  const ui = useUi();
  return override ?? ui.variants[element] ?? fallback;
}

export { iconSvg, type IconName } from "./index.js";
export { applyTheme, applyFamily } from "./theme.js";

/* ------------------------------ Icons ------------------------------ */

export function Icon({ name, size = 24 }: { name: IconName; size?: number }): React.ReactElement {
  return React.createElement("span", {
    dangerouslySetInnerHTML: { __html: iconSvg(name, size) },
    style: { display: "inline-flex", lineHeight: 0 },
  });
}

/* ----------------------------- Buttons ----------------------------- */

export function Button({ element = "button", variant, kind, small, full, type = "button", disabled, onClick, children }: {
  element?: string;
  variant?: string;
  kind?: "filled" | "outlined" | "underline-link" | "tonal";
  small?: boolean;
  full?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const resolved = useVariant(element, "filled", variant ?? (kind !== undefined ? kind : undefined));
  const cls = ["btn", `btn--${resolved}`, small ? "btn--small" : "", "press"].join(" ");
  return React.createElement("button", {
    type, disabled, className: cls, onClick,
    style: full === true ? { width: "100%" } : undefined,
  }, children);
}

/* ------------------------------ Rows ------------------------------- */

export function Row({ element = "row", variant, active, onClick, as = "div", children }: {
  element?: string;
  variant?: "hairline" | "zebra" | "stacked-meta";
  active?: boolean;
  onClick?: () => void;
  as?: "div" | "button";
  children: React.ReactNode;
}): React.ReactElement {
  const resolved = useVariant(element, "hairline", variant);
  const cls = ["row", resolved === "zebra" ? "row--zebra" : "", resolved === "stacked-meta" ? "row--stacked" : "", onClick !== undefined ? "press" : "", active === true ? "is-active" : ""].filter(Boolean).join(" ");
  const Tag = as === "button" ? "button" : "div";
  return React.createElement(Tag, {
    className: cls, onClick,
    ...(as === "button" ? { type: "button", style: { cursor: "pointer" } } : {}),
  }, children);
}

/* ---------------------------- Headers ------------------------------ */

export function Header({ element = "header", variant, brand, sub, children, style }: {
  element?: string;
  variant?: "masthead" | "minimal" | "data-bar";
  brand?: string;
  sub?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}): React.ReactElement {
  const resolved = useVariant(element, "masthead", variant);
  const cls = resolved === "masthead" ? "masthead" : resolved === "minimal" ? "header--minimal" : "header--data-bar";
  return React.createElement("header", { className: cls, style }, React.createElement(React.Fragment, null,
    brand !== undefined && React.createElement("span", { className: "crest-block", "aria-hidden": "true" }, brand.slice(0, 1)),
    React.createElement("span", { style: { display: "flex", flexDirection: "column" } },
      React.createElement("span", null, brand),
      sub !== undefined && React.createElement("span", { className: "masthead-sub" }, sub),
    ),
    children !== undefined ? React.createElement("span", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" } }, children) : null,
  ));
}

/* ------------------------------ Tabs ------------------------------- */

export interface TabDef { key: string; label: string }

export function Tabs({ element = "tabs", variant, tabs, value, onChange, grow }: {
  element?: string;
  variant?: "underline-tabs" | "pill-segments" | "boxed-tabs";
  tabs: readonly TabDef[];
  value: string;
  onChange: (key: string) => void;
  grow?: boolean;
}): React.ReactElement {
  const resolved = useVariant(element, "underline-tabs", variant);
  const cls = ["tabs", resolved === "pill-segments" ? "tabs--pill" : "", resolved === "boxed-tabs" ? "tabs--boxed" : ""].filter(Boolean).join(" ");
  return React.createElement("div", { className: cls, role: "tablist" }, tabs.map((t) =>
    React.createElement("button", {
      key: t.key,
      className: "tabs__tab press",
      role: "tab",
      "aria-current": resolved !== "pill-segments" ? (value === t.key ? "true" : undefined) : undefined,
      "aria-pressed": resolved === "pill-segments" ? value === t.key : undefined,
      onClick: () => onChange(t.key),
      style: grow === true ? { flex: 1 } : undefined,
    }, t.label),
  ));
}

/* ----------------------------- Badges ------------------------------ */

export function Badge({ element = "badge", variant, children }: {
  element?: string;
  variant?: "solid" | "outline" | "dot";
  children: React.ReactNode;
}): React.ReactElement {
  const resolved = useVariant(element, "solid", variant);
  return React.createElement("span", { className: `badge badge--${resolved}` }, children);
}

/* ------------------------------ Fields ----------------------------- */

export interface FieldProps {
  element?: string;
  variant?: "underline" | "boxed" | "inline";
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "email" | "text";
  multiline?: boolean;
  hidden?: boolean;
}

export function Field({ element = "input", variant, label, value, onChange, type = "text", placeholder, inputMode, multiline, hidden }: FieldProps): React.ReactElement | null {
  const resolved = useVariant(element, "underline", variant);
  const cls = ["field", resolved === "boxed" ? "field--boxed" : "", resolved === "inline" ? "field--inline" : ""].filter(Boolean).join(" ");
  if (hidden === true) return null;
  const input = multiline === true
    ? React.createElement("textarea", { className: "field__input", value, placeholder, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value), "aria-label": label })
    : React.createElement("input", {
        className: "field__input", value, placeholder, type, inputMode,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        "aria-label": label,
      });
  return React.createElement("label", { className: cls },
    React.createElement("span", { className: "field__label" }, label),
    input,
  );
}

/* --------------------------- Sheets/Modals -------------------------- */

export function Sheet({ open, onClose, title, variant, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "full-sheet" | "centered-modal" | "anchored-panel" | "drawer";
  children: React.ReactNode;
}): React.ReactElement | null {
  const ui = useUi();
  const resolved = variant ?? ui.variants.modal ?? "full-sheet";
  if (!open) return null;
  const center = resolved === "centered-modal";
  const anchored = resolved === "anchored-panel";
  return React.createElement("div", {
    className: `overlay ${center ? "overlay--center" : "overlay--full"}`,
    role: "dialog", "aria-modal": "true", "aria-label": title,
    onClick: onClose,
  }, React.createElement("div", {
    className: `sheet ${anchored ? "sheet--anchored" : ""}`,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  },
    React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-3)" } },
      React.createElement("span", { style: { font: "var(--weight-bold) var(--type-title) var(--font-ui)" } }, title),
      React.createElement("button", { type: "button", className: "btn btn--underline-link press", onClick: onClose }, "Close"),
    ),
    children,
  ));
}

/* ------------------------------ Toasts ----------------------------- */

export function Toast({ variant, children }: {
  variant?: "banner" | "snackbar" | "inline-callout";
  children: React.ReactNode;
}): React.ReactElement {
  const resolved = useVariant("toast", "banner", variant);
  return React.createElement("div", { className: `toast toast--${resolved}`, role: "status" }, children);
}

/* --------------------------- Empty states -------------------------- */

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }): React.ReactElement {
  const resolved = useVariant("emptyState", "typographic-minimal");
  const invite = resolved === "typographic-invitation";
  return React.createElement("div", { className: "empty" },
    React.createElement("h2", null, title),
    React.createElement("p", null, body),
    invite && action === undefined ? React.createElement("p", { className: "micro" }, "What would you like to start?") : null,
    action !== undefined ? React.createElement("div", null, action) : null,
  );
}

/* ----------------------------- Skeletons --------------------------- */

export function Skeleton({ variant, height }: { variant?: "block" | "line-shimmer"; height?: string }): React.ReactElement {
  const resolved = useVariant("skeleton", "block", variant);
  return React.createElement("div", {
    className: `skeleton ${resolved === "line-shimmer" ? "skeleton--line-shimmer" : ""}`,
    style: height !== undefined ? { height } : undefined,
  });
}

/* ----------------------------- Dividers ---------------------------- */

export function Divider({ variant }: { variant?: "hairline" | "ruled-double" }): React.ReactElement {
  const resolved = useVariant("divider", "hairline", variant);
  return React.createElement("hr", { className: `divider ${resolved === "ruled-double" ? "divider--double" : ""}` });
}

/* ------------------------------- FAB ------------------------------- */

export function Fab({ variant, label, onClick }: { variant?: "corner" | "docked-inline"; label: string; onClick: () => void }): React.ReactElement {
  const resolved = useVariant("fab", "corner", variant);
  return React.createElement("button", {
    type: "button", className: `fab ${resolved === "docked-inline" ? "fab--docked" : ""} press`,
    "aria-label": label, onClick,
  }, "+");
}

/* ------------------------------ Avatar ----------------------------- */

export function Avatar({ name, variant, lg }: { name: string; variant?: "sharp" | "rounded" | "circled"; lg?: boolean }): React.ReactElement {
  const resolved = useVariant("avatar", "sharp", variant);
  return React.createElement("span", {
    className: `avatar ${resolved === "rounded" ? "avatar--rounded" : ""} ${resolved === "circled" ? "avatar--circled" : ""} ${lg === true ? "avatar--lg" : ""}`,
    "aria-hidden": "true",
  }, name.slice(0, 1));
}

/* ------------------------------ Tables ----------------------------- */

export function Table({ variant, columns, rows }: {
  variant?: "hairline-grid" | "zebra" | "ruled";
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<React.ReactNode>>;
}): React.ReactElement {
  const resolved = useVariant("table", "hairline-grid", variant);
  return React.createElement("table", { className: `table table--${resolved}` },
    React.createElement("thead", null, React.createElement("tr", null, columns.map((c) => React.createElement("th", { key: c }, c)))),
    React.createElement("tbody", null, rows.map((r, i) => React.createElement("tr", { key: i }, r.map((cell, j) => React.createElement("td", { key: j }, cell))))),
  );
}

/* --------------------------- Section head -------------------------- */

export function SectionHead({ label, action }: { label: string; action?: React.ReactNode }): React.ReactElement {
  return React.createElement("div", { className: "rule-head" },
    React.createElement("span", { className: "micro", style: { flex: 1 } }, label),
    action !== undefined ? action : null,
  );
}

export function Section({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }): React.ReactElement {
  return React.createElement("section", { style: { padding: "0 var(--density-pad-x) var(--space-6)" } },
    React.createElement(SectionHead, { label, action }),
    children,
  );
}
