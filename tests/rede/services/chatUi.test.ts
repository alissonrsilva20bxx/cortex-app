import { describe, expect, it } from "vitest";

import {
  computeKeyboardInset,
  resolveScrollBehavior,
  shouldAutoScrollOnNewMessage,
} from "../../../lib/rede/chatUi";

describe("shouldAutoScrollOnNewMessage", () => {
  it("always scrolls for a message sent by me, regardless of scroll position", () => {
    expect(
      shouldAutoScrollOnNewMessage({
        distanceFromBottomPx: 5000,
        isOwnMessage: true,
      })
    ).toBe(true);
  });

  it("scrolls for someone else's message when already near the bottom", () => {
    expect(
      shouldAutoScrollOnNewMessage({
        distanceFromBottomPx: 40,
        isOwnMessage: false,
      })
    ).toBe(true);
  });

  it("does not scroll for someone else's message when the reader is scrolled up", () => {
    expect(
      shouldAutoScrollOnNewMessage({
        distanceFromBottomPx: 800,
        isOwnMessage: false,
      })
    ).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(
      shouldAutoScrollOnNewMessage({
        distanceFromBottomPx: 150,
        isOwnMessage: false,
        thresholdPx: 200,
      })
    ).toBe(true);
    expect(
      shouldAutoScrollOnNewMessage({
        distanceFromBottomPx: 150,
        isOwnMessage: false,
        thresholdPx: 100,
      })
    ).toBe(false);
  });

  it("treats being exactly at the threshold as near enough", () => {
    expect(
      shouldAutoScrollOnNewMessage({
        distanceFromBottomPx: 120,
        isOwnMessage: false,
        thresholdPx: 120,
      })
    ).toBe(true);
  });
});

describe("computeKeyboardInset", () => {
  it("is zero when the visual viewport matches the window (no keyboard open)", () => {
    expect(
      computeKeyboardInset({
        windowInnerHeight: 844,
        visualViewportHeight: 844,
        visualViewportOffsetTop: 0,
      })
    ).toBe(0);
  });

  it("equals the height the on-screen keyboard covers", () => {
    expect(
      computeKeyboardInset({
        windowInnerHeight: 844,
        visualViewportHeight: 544,
        visualViewportOffsetTop: 0,
      })
    ).toBe(300);
  });

  it("accounts for a non-zero visualViewport offsetTop (e.g. page scrolled while keyboard open)", () => {
    expect(
      computeKeyboardInset({
        windowInnerHeight: 844,
        visualViewportHeight: 544,
        visualViewportOffsetTop: 20,
      })
    ).toBe(280);
  });

  it("never returns a negative inset", () => {
    expect(
      computeKeyboardInset({
        windowInnerHeight: 844,
        visualViewportHeight: 900,
        visualViewportOffsetTop: 0,
      })
    ).toBe(0);
  });

  it("defaults visualViewportOffsetTop to 0 when omitted", () => {
    expect(
      computeKeyboardInset({
        windowInnerHeight: 844,
        visualViewportHeight: 544,
      })
    ).toBe(300);
  });
});

describe("resolveScrollBehavior", () => {
  it("returns smooth when the reader has no motion preference", () => {
    expect(resolveScrollBehavior(false)).toBe("smooth");
  });

  it("returns auto (instant) when the reader prefers reduced motion", () => {
    expect(resolveScrollBehavior(true)).toBe("auto");
  });
});
