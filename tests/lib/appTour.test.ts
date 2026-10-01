import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TOUR_STEPS, tourDoneKey, tourPlacement } from "../../lib/appTour";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("TOUR_STEPS", () => {
  it("percorre Início → Agenda → Financeiro → Cofre → Rede (feed e perfil) → Ajustes", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "home-hero",
      "fab",
      "go-agenda",
      "agenda",
      "go-financeiro",
      "financeiro",
      "cofre",
      "go-rede",
      "rede-feed",
      "rede-perfil",
      "ajustes",
      "fim",
    ]);
  });

  it("ids únicos", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("passo de navegação leva pra aba que o passo seguinte espera", () => {
    TOUR_STEPS.forEach((s, i) => {
      if (!s.goTo) return;
      expect(TOUR_STEPS[i + 1].tab).toBe(s.goTo);
      // e destaca o botão dessa aba na BottomNav
      expect(s.target).toBe(`nav-${s.goTo}`);
    });
  });

  it("nunca abre o Cofre (pediria o PIN no meio do tour)", () => {
    for (const s of TOUR_STEPS) {
      expect(s.tab).not.toBe("cofre");
      expect(s.goTo).not.toBe("cofre");
    }
  });

  it("começa e termina no Início", () => {
    expect(TOUR_STEPS[0].tab).toBe("home");
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].tab).toBe("home");
  });

  it("chave de concluído é por conta", () => {
    expect(tourDoneKey("u1")).toBe("jobapp-tour-done:u1");
  });
});

describe("tourPlacement", () => {
  it("sem alvo = cartão central", () => {
    expect(tourPlacement(null, 800)).toBe("center");
  });

  it("alvo embaixo (BottomNav/FAB) = cartão em cima", () => {
    expect(tourPlacement({ top: 740, height: 44 }, 800)).toBe("above");
  });

  it("alvo em cima (card-herói, avatar) = cartão embaixo", () => {
    expect(tourPlacement({ top: 80, height: 200 }, 800)).toBe("below");
  });
});

describe("wiring: todo alvo do tour existe no código", () => {
  const fontes = [
    "app/page.tsx",
    "components/BottomNav.tsx",
    "components/FAB.tsx",
    "components/home/GreetingHeader.tsx",
    "components/rede/RedeHeader.tsx",
  ]
    .map(read)
    .join("\n");

  it.each(TOUR_STEPS.filter((s) => s.target && !s.target.startsWith("nav-")))(
    "data-tour=$target",
    ({ target }) => {
      expect(fontes).toContain(`data-tour="${target}"`);
    }
  );

  it("BottomNav marca cada aba como nav-<id>", () => {
    expect(read("components/BottomNav.tsx")).toContain(
      "data-tour={`nav-${id}`}"
    );
  });

  it("app abre o tour depois do onboarding e desliga o swipe enquanto ele está aberto", () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(/if \(!tourDone\) setTourOpen\(true\);/);
    expect(page).toContain("!tourOpen &&");
    expect(page).toContain("<AppTour");
    expect(page).toContain("onOpenTour={");
  });
});
