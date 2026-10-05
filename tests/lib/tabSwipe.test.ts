import { describe, expect, it } from "vitest";

import {
  TAB_SWIPE_ORDER,
  TAB_SWIPE_SLOP,
  neighborTab,
  shouldCompleteTabSwipe,
  shouldEngageTabSwipe,
} from "../../lib/tabSwipe";

describe("neighborTab", () => {
  it("segue a ordem da BottomNav", () => {
    expect(TAB_SWIPE_ORDER).toEqual([
      "home",
      "jobs",
      "financeiro",
      "cofre",
      "rede",
    ]);
  });

  it("dedo pra esquerda = próxima aba; pra direita = anterior", () => {
    expect(neighborTab("home", -50)).toBe("jobs");
    expect(neighborTab("jobs", -50)).toBe("financeiro");
    expect(neighborTab("financeiro", -50)).toBe("cofre");
    expect(neighborTab("cofre", -50)).toBe("rede");
    expect(neighborTab("rede", 50)).toBe("cofre");
    expect(neighborTab("jobs", 50)).toBe("home");
  });

  it("nas pontas não há vizinha", () => {
    expect(neighborTab("home", 50)).toBeNull();
    expect(neighborTab("rede", -50)).toBeNull();
  });

  it("Ajustes fica fora do gesto; dx 0 não decide nada", () => {
    expect(neighborTab("ajustes", -50)).toBeNull();
    expect(neighborTab("ajustes", 50)).toBeNull();
    expect(neighborTab("jobs", 0)).toBeNull();
  });
});

describe("shouldEngageTabSwipe", () => {
  it("não engata antes do slop", () => {
    expect(shouldEngageTabSwipe(TAB_SWIPE_SLOP - 1, 0)).toBe(false);
  });

  it("engata em arraste claramente horizontal", () => {
    expect(shouldEngageTabSwipe(-30, 5)).toBe(true);
    expect(shouldEngageTabSwipe(30, -10)).toBe(true);
  });

  it("rolagem vertical ou diagonal não vira troca de aba", () => {
    expect(shouldEngageTabSwipe(5, 40)).toBe(false);
    expect(shouldEngageTabSwipe(20, 20)).toBe(false);
  });
});

describe("shouldCompleteTabSwipe", () => {
  const W = 390;

  it("devagar: só troca depois de 28% da largura", () => {
    expect(shouldCompleteTabSwipe(-100, W, 0)).toBe(false);
    expect(shouldCompleteTabSwipe(-120, W, 0)).toBe(true);
  });

  it("flick rápido na mesma direção troca mesmo curto", () => {
    expect(shouldCompleteTabSwipe(-40, W, -0.6)).toBe(true);
  });

  it("flick curtíssimo (<= 30px) não troca", () => {
    expect(shouldCompleteTabSwipe(-25, W, -0.8)).toBe(false);
  });

  it("flick no sentido contrário cancela mesmo depois de longe", () => {
    expect(shouldCompleteTabSwipe(-200, W, 0.5)).toBe(false);
  });

  it("dx 0 nunca troca", () => {
    expect(shouldCompleteTabSwipe(0, W, -1)).toBe(false);
  });
});
