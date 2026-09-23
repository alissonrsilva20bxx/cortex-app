import { describe, expect, it } from "vitest";
import {
  rectsOverlap,
  collidesWithAny,
  type Rect,
} from "../../lib/rectCollision";

const fab: Rect = { top: 700, left: 322, right: 370, bottom: 748 };

describe("rectsOverlap", () => {
  it("detecta sobreposição real (o caso reportado: 'Ver todos' embaixo do FAB)", () => {
    const verTodos: Rect = { top: 703, left: 300, right: 358, bottom: 723 };
    expect(rectsOverlap(fab, verTodos)).toBe(true);
  });

  it("não detecta sobreposição quando os retângulos não se tocam", () => {
    const longeDaqui: Rect = { top: 100, left: 20, right: 200, bottom: 130 };
    expect(rectsOverlap(fab, longeDaqui)).toBe(false);
  });

  it("bordas exatamente coladas (right === left) não contam como sobreposição", () => {
    const colado: Rect = { top: 700, left: 370, right: 420, bottom: 748 };
    expect(rectsOverlap(fab, colado)).toBe(false);
  });

  it("sobreposição parcial (só uma borda cruza) ainda conta", () => {
    const parcial: Rect = { top: 740, left: 322, right: 370, bottom: 800 };
    expect(rectsOverlap(fab, parcial)).toBe(true);
  });
});

describe("collidesWithAny", () => {
  it("true se colidir com QUALQUER um da lista, não só o primeiro", () => {
    const longeDaqui: Rect = { top: 100, left: 20, right: 200, bottom: 130 };
    const verTodos: Rect = { top: 703, left: 300, right: 358, bottom: 723 };
    expect(collidesWithAny(fab, [longeDaqui, verTodos])).toBe(true);
  });

  it("false se a lista estiver vazia ou nenhum colidir", () => {
    expect(collidesWithAny(fab, [])).toBe(false);
    const longeDaqui: Rect = { top: 100, left: 20, right: 200, bottom: 130 };
    expect(collidesWithAny(fab, [longeDaqui])).toBe(false);
  });
});
