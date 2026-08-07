import { describe, expect, it } from "vitest";
import {
  BOTTOM_NAV_COMPACT,
  BOTTOM_NAV_EXPANDED,
  BOTTOM_NAV_MIN_TOUCH_TARGET,
  getBottomNavCompactStyle,
} from "../../lib/bottomNavCompactStyle";

describe("getBottomNavCompactStyle", () => {
  it("returns the approved expanded baseline when not compact", () => {
    expect(getBottomNavCompactStyle(false)).toEqual(BOTTOM_NAV_EXPANDED);
  });

  it("returns the approved compact shape (mirrors the visual lab) when compact", () => {
    expect(getBottomNavCompactStyle(true)).toEqual(BOTTOM_NAV_COMPACT);
  });

  it("shrinks the pill inward (narrower footprint) instead of only moving it", () => {
    expect(BOTTOM_NAV_COMPACT.edgeInset).toBeGreaterThan(
      BOTTOM_NAV_EXPANDED.edgeInset
    );
  });

  it("shrinks internal padding when compact", () => {
    expect(BOTTOM_NAV_COMPACT.padding).toBeLessThan(
      BOTTOM_NAV_EXPANDED.padding
    );
  });

  it("only nudges vertically by a small settle, never a hide-style slide", () => {
    // O bug anterior usava translateY(42%) — lia como "esconder a barra",
    // não "compactar". O efeito aprovado no laboratório é um acomodo de
    // poucos px (data-compact do jobapp-bottom-nav em globals.css).
    expect(BOTTOM_NAV_COMPACT.translateY).toBeGreaterThanOrEqual(0);
    expect(BOTTOM_NAV_COMPACT.translateY).toBeLessThan(10);
  });

  it("narrows the active tab's pill while keeping it above the minimum touch target", () => {
    expect(BOTTOM_NAV_COMPACT.activeWidth).toBeLessThan(
      BOTTOM_NAV_EXPANDED.activeWidth
    );
    expect(BOTTOM_NAV_COMPACT.activeWidth).toBeGreaterThanOrEqual(
      BOTTOM_NAV_MIN_TOUCH_TARGET
    );
  });

  it("keeps the minimum touch target at 44px (fb6b6c9) — inactive buttons and height never shrink below it", () => {
    expect(BOTTOM_NAV_MIN_TOUCH_TARGET).toBe(44);
  });

  it("deepens (not fades to invisible) the background when compact", () => {
    expect(BOTTOM_NAV_COMPACT.backgroundOpacity).toBeGreaterThan(
      BOTTOM_NAV_EXPANDED.backgroundOpacity
    );
    expect(BOTTOM_NAV_COMPACT.backgroundOpacity).toBeLessThanOrEqual(1);
  });
});
