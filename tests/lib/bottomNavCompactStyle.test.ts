import { describe, expect, it } from "vitest";
import {
  BOTTOM_NAV_ACTIVE_WIDTH,
  BOTTOM_NAV_COMPACT,
  BOTTOM_NAV_EXPANDED,
  BOTTOM_NAV_ITEM_WIDTH,
  BOTTOM_NAV_MIN_TOUCH_TARGET,
  BOTTOM_NAV_OFFSET,
  BOTTOM_NAV_PILL_WIDTH,
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

  // Pixel do mockup aprovado das 5 telas (`.b2`): o vidro e a sombra são
  // os mesmos aberta e recolhida (antes o fundo escurecia ao recolher).
  it("usa a sombra do vidro do mockup, igual aberta e recolhida", () => {
    expect(BOTTOM_NAV_EXPANDED.shadow).toBe("0 10px 30px var(--glass-shadow)");
    expect(BOTTOM_NAV_COMPACT.shadow).toBe(BOTTOM_NAV_EXPANDED.shadow);
  });

  it("tem as medidas do mockup: pílula 288×60, abas 46 e 54, recolhida 50, a 22px do fundo", () => {
    expect(BOTTOM_NAV_PILL_WIDTH).toBe(288);
    expect(BOTTOM_NAV_EXPANDED.pillHeight).toBe(60);
    expect(BOTTOM_NAV_ITEM_WIDTH).toBe(46);
    expect(BOTTOM_NAV_ACTIVE_WIDTH).toBe(54);
    expect(BOTTOM_NAV_COMPACT.pillHeight).toBe(50);
    expect(BOTTOM_NAV_COMPACT.translateY).toBe(0);
    expect(BOTTOM_NAV_OFFSET).toBe(22);
    expect(BOTTOM_NAV_ITEM_WIDTH).toBeGreaterThanOrEqual(
      BOTTOM_NAV_MIN_TOUCH_TARGET
    );
  });
});
