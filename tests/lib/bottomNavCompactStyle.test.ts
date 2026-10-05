import { describe, expect, it } from "vitest";
import {
  BOTTOM_NAV_ACTIVE_WIDTH,
  BOTTOM_NAV_COMPACT,
  BOTTOM_NAV_EXPANDED,
  BOTTOM_NAV_MIN_TOUCH_TARGET,
  getBottomNavCompactStyle,
} from "../../lib/bottomNavCompactStyle";

describe("getBottomNavCompactStyle — pílula 2 'Recolhe pra aba atual'", () => {
  it("returns the expanded baseline when not compact", () => {
    expect(getBottomNavCompactStyle(false)).toEqual(BOTTOM_NAV_EXPANDED);
  });

  it("returns the collapsed shape when compact", () => {
    expect(getBottomNavCompactStyle(true)).toEqual(BOTTOM_NAV_COMPACT);
  });

  it("collapses the pill into the current-tab bubble only when compact", () => {
    expect(BOTTOM_NAV_EXPANDED.collapsed).toBe(false);
    expect(BOTTOM_NAV_COMPACT.collapsed).toBe(true);
  });

  it("shrinks the pill and the '+' together, never below the minimum touch target", () => {
    expect(BOTTOM_NAV_COMPACT.pillHeight).toBeLessThan(
      BOTTOM_NAV_EXPANDED.pillHeight
    );
    expect(BOTTOM_NAV_COMPACT.fabSize).toBeLessThan(
      BOTTOM_NAV_EXPANDED.fabSize
    );
    expect(BOTTOM_NAV_COMPACT.pillHeight).toBeGreaterThanOrEqual(
      BOTTOM_NAV_MIN_TOUCH_TARGET
    );
    expect(BOTTOM_NAV_COMPACT.fabSize).toBeGreaterThanOrEqual(
      BOTTOM_NAV_MIN_TOUCH_TARGET
    );
  });

  it("keeps the '+' on the same row as the pill (same height open and collapsed)", () => {
    expect(BOTTOM_NAV_EXPANDED.fabSize).toBe(BOTTOM_NAV_EXPANDED.pillHeight);
    expect(BOTTOM_NAV_COMPACT.fabSize).toBe(BOTTOM_NAV_COMPACT.pillHeight);
  });

  it("only nudges vertically by a small settle, never a hide-style slide", () => {
    // O bug anterior usava translateY(42%) — lia como "esconder a barra",
    // não "compactar".
    expect(BOTTOM_NAV_COMPACT.translateY).toBeGreaterThanOrEqual(0);
    expect(BOTTOM_NAV_COMPACT.translateY).toBeLessThan(10);
  });

  it("keeps the minimum touch target at 44px (fb6b6c9) and the active tab above it", () => {
    expect(BOTTOM_NAV_MIN_TOUCH_TARGET).toBe(44);
    expect(BOTTOM_NAV_ACTIVE_WIDTH).toBeGreaterThanOrEqual(
      BOTTOM_NAV_MIN_TOUCH_TARGET
    );
  });

  it("deepens (not fades to invisible) the background when compact", () => {
    expect(BOTTOM_NAV_COMPACT.backgroundOpacity).toBeGreaterThan(
      BOTTOM_NAV_EXPANDED.backgroundOpacity
    );
    expect(BOTTOM_NAV_COMPACT.backgroundOpacity).toBeLessThanOrEqual(1);
  });
});
