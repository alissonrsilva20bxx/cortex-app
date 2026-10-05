import { describe, expect, it } from "vitest";
import { rubberBandSheet, shouldDismissSheet } from "@/lib/sheetDrag";

describe("rubberBandSheet — pra baixo segue o dedo, pra cima resiste", () => {
  it("pra baixo é 1:1", () => {
    expect(rubberBandSheet(120)).toBe(120);
  });

  it("pra cima cede pouco e tem teto", () => {
    expect(rubberBandSheet(-16)).toBeCloseTo(-8);
    expect(rubberBandSheet(-10_000)).toBe(-24);
  });
});

describe("shouldDismissSheet — decide ao soltar o dedo", () => {
  const h = 400;

  it("fecha depois de 25% da altura, mesmo devagar", () => {
    expect(shouldDismissSheet(120, h, 0)).toBe(true);
  });

  it("volta pra aberto antes de 25% se foi devagar", () => {
    expect(shouldDismissSheet(80, h, 0.1)).toBe(false);
  });

  it("fecha num flick rápido pra baixo mesmo curto", () => {
    expect(shouldDismissSheet(30, h, 0.9)).toBe(true);
  });

  it("mantém aberto se o dedo voltou pra cima rápido", () => {
    expect(shouldDismissSheet(200, h, -0.5)).toBe(false);
  });

  it("nunca fecha sem deslocamento pra baixo", () => {
    expect(shouldDismissSheet(0, h, 2)).toBe(false);
  });
});
