import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCROLL_COMPACT_CONFIG,
  INITIAL_SCROLL_COMPACT_STATE,
  nextScrollCompactState,
  type ScrollCompactState,
} from "../../lib/scrollCompact";

function scrollTo(state: ScrollCompactState, ...scrollTops: number[]) {
  return scrollTops.reduce(
    (acc, top) => nextScrollCompactState(acc, top),
    state
  );
}

describe("nextScrollCompactState", () => {
  it("starts expanded", () => {
    expect(INITIAL_SCROLL_COMPACT_STATE.compact).toBe(false);
  });

  it("ignores the first reading (no baseline yet) instead of reacting to it as a jump", () => {
    const state = nextScrollCompactState(INITIAL_SCROLL_COMPACT_STATE, 500);
    expect(state.compact).toBe(false);
    expect(state.lastScrollTop).toBe(500);
  });

  it("compacts once scrolled down past the compact zone", () => {
    const state = scrollTo(INITIAL_SCROLL_COMPACT_STATE, 0, 60, 120);
    expect(state.compact).toBe(true);
  });

  it("does not compact from small downward movements that never clear minDelta", () => {
    const state = scrollTo(INITIAL_SCROLL_COMPACT_STATE, 0, 12, 15, 18, 20);
    expect(state.compact).toBe(false);
  });

  it("does not oscillate on tiny back-and-forth jitter", () => {
    const state = scrollTo(
      INITIAL_SCROLL_COMPACT_STATE,
      0,
      60,
      100, // compact by now
      98,
      101,
      99,
      102
    );
    expect(state.compact).toBe(true);
  });

  it("expands again once scrolling up, even by a small amount", () => {
    const compacted = scrollTo(INITIAL_SCROLL_COMPACT_STATE, 0, 60, 120);
    expect(compacted.compact).toBe(true);

    const expanded = nextScrollCompactState(compacted, 112);
    expect(expanded.compact).toBe(false);
  });

  it("snaps back to expanded once near the top, regardless of direction", () => {
    const compacted = scrollTo(INITIAL_SCROLL_COMPACT_STATE, 0, 60, 120);
    expect(compacted.compact).toBe(true);

    const nearTop = nextScrollCompactState(compacted, 4);
    expect(nearTop.compact).toBe(false);
  });

  it("clamps negative scrollTop from iOS elastic bounce to zero", () => {
    const state = scrollTo(INITIAL_SCROLL_COMPACT_STATE, 0, 60, 120);
    const bounced = nextScrollCompactState(state, -30);
    expect(bounced.compact).toBe(false);
    expect(bounced.lastScrollTop).toBe(0);
  });

  it("honors a custom config", () => {
    const config = { expandZone: 0, compactZone: 10, minDelta: 1 };
    const state = scrollTo(
      { compact: false, lastScrollTop: null },
      0,
      15
    );
    expect(nextScrollCompactState(state, 15, config)).toEqual({
      compact: state.compact,
      lastScrollTop: 15,
    });
    const compacted = nextScrollCompactState(
      nextScrollCompactState({ compact: false, lastScrollTop: null }, 0, config),
      20,
      config
    );
    expect(compacted.compact).toBe(true);
  });

  it("default config matches the documented thresholds", () => {
    expect(DEFAULT_SCROLL_COMPACT_CONFIG).toEqual({
      expandZone: 8,
      compactZone: 40,
      minDelta: 6,
    });
  });
});
