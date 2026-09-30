import { describe, it, expect } from "vitest";
import { spacing, typeSizes, motion } from "./index.js";

describe("tokens", () => {
  it("keeps all spacing on the 4/8px grid (A11)", () => {
    for (const value of Object.values(spacing)) {
      const px = Number(value.replace("px", ""));
      expect(px % 4, `${value} is off-grid`).toBe(0);
    }
  });

  it("locks the type scale to B4 sizes", () => {
    expect(Object.values(typeSizes).sort()).toEqual(
      ["11px", "13px", "15px", "17px", "22px", "32px", "48px"].sort(),
    );
  });

  it("keeps motion within the 100-250ms budget (F1/F2)", () => {
    for (const value of Object.values(motion)) {
      if (!value.endsWith("ms")) continue;
      const ms = Number(value.replace("ms", ""));
      expect(ms).toBeLessThanOrEqual(250);
      expect(ms).toBeGreaterThanOrEqual(100);
    }
  });
});
