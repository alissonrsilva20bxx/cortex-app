import { describe, expect, it } from "vitest";

import {
  computeKeyboardInset,
  computeScrollAdjustment,
  resolveScrollBehavior,
  shouldAutoScrollOnNewMessage,
  shouldLoadMoreMessages,
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

describe("shouldLoadMoreMessages", () => {
  it("loads more when near the top, more exists, and nothing is already loading", () => {
    expect(
      shouldLoadMoreMessages({
        scrollTopPx: 20,
        hasMore: true,
        loadingMore: false,
      })
    ).toBe(true);
  });

  it("does not load more when scrolled well below the top", () => {
    expect(
      shouldLoadMoreMessages({
        scrollTopPx: 500,
        hasMore: true,
        loadingMore: false,
      })
    ).toBe(false);
  });

  it("does not load more when there is nothing left to load", () => {
    expect(
      shouldLoadMoreMessages({
        scrollTopPx: 0,
        hasMore: false,
        loadingMore: false,
      })
    ).toBe(false);
  });

  it("does not re-trigger while a load is already in flight", () => {
    expect(
      shouldLoadMoreMessages({
        scrollTopPx: 0,
        hasMore: true,
        loadingMore: true,
      })
    ).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(
      shouldLoadMoreMessages({
        scrollTopPx: 150,
        hasMore: true,
        loadingMore: false,
        thresholdPx: 200,
      })
    ).toBe(true);
    expect(
      shouldLoadMoreMessages({
        scrollTopPx: 150,
        hasMore: true,
        loadingMore: false,
        thresholdPx: 100,
      })
    ).toBe(false);
  });

  it("treats being exactly at the threshold as near enough", () => {
    expect(
      shouldLoadMoreMessages({
        scrollTopPx: 80,
        hasMore: true,
        loadingMore: false,
      })
    ).toBe(true);
  });
});

describe("computeScrollAdjustment", () => {
  it("keeps the same content visible by shifting scrollTop by the height the new content added", () => {
    expect(
      computeScrollAdjustment({
        previousScrollHeight: 2000,
        newScrollHeight: 2600,
        previousScrollTop: 40,
      })
    ).toBe(640);
  });

  it("is a no-op when the content didn't actually grow", () => {
    expect(
      computeScrollAdjustment({
        previousScrollHeight: 2000,
        newScrollHeight: 2000,
        previousScrollTop: 40,
      })
    ).toBe(40);
  });
});
