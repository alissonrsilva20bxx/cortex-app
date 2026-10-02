import { describe, expect, it } from "vitest";
import {
  shouldCompleteSwipeBack,
  shouldEngageSwipeBack,
} from "@/lib/swipeBack";

describe("shouldEngageSwipeBack — só engata arraste horizontal pra direita", () => {
  it("espera passar da folga antes de decidir", () => {
    expect(shouldEngageSwipeBack(4, 2)).toBe(false);
  });

  it("engata num arraste claramente horizontal pra direita", () => {
    expect(shouldEngageSwipeBack(14, 3)).toBe(true);
  });

  it("não engata quando o dedo vai pra esquerda", () => {
    expect(shouldEngageSwipeBack(-14, 0)).toBe(false);
  });

  it("não engata quando o movimento é mais vertical (é rolagem)", () => {
    expect(shouldEngageSwipeBack(10, 20)).toBe(false);
  });
});

describe("shouldCompleteSwipeBack — decide ao soltar o dedo", () => {
  const w = 390;

  it("completa depois de 40% da largura, mesmo devagar", () => {
    expect(shouldCompleteSwipeBack(200, w, 0)).toBe(true);
  });

  it("cancela antes de 40% da largura se foi devagar", () => {
    expect(shouldCompleteSwipeBack(100, w, 0.1)).toBe(false);
  });

  it("completa um flick rápido mesmo curto", () => {
    expect(shouldCompleteSwipeBack(60, w, 0.8)).toBe(true);
  });

  it("cancela quando o dedo voltou pra esquerda rápido, mesmo longe", () => {
    expect(shouldCompleteSwipeBack(250, w, -0.6)).toBe(false);
  });

  it("nunca completa sem deslocamento pra direita", () => {
    expect(shouldCompleteSwipeBack(0, w, 1)).toBe(false);
  });
});
