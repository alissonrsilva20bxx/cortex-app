import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TOUR_STEPS,
  stepsDoTour,
  tourDoneKey,
  tourPlacement,
} from "../../lib/appTour";

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

describe("stepsDoTour (sem convite da Rede)", () => {
  // 2026-10-01: "quando chega no social que é feed, buga, pq o cliente
  // ainda não usou o convite para entrar".
  const bloqueado = stepsDoTour("bloqueado");

  it("liberado e pendente seguem a lista padrão", () => {
    expect(stepsDoTour("liberado")).toBe(TOUR_STEPS);
    expect(stepsDoTour("pendente")).toBe(TOUR_STEPS);
  });

  it("troca feed/perfil pela vitrine e pelo campo de convite, mesma contagem", () => {
    expect(bloqueado).toHaveLength(TOUR_STEPS.length);
    const ids = bloqueado.map((s) => s.id);
    expect(ids).not.toContain("rede-feed");
    expect(ids).not.toContain("rede-perfil");
    expect(ids.indexOf("rede-vitrine")).toBe(ids.indexOf("go-rede") + 1);
    expect(bloqueado.find((s) => s.id === "rede-convite")?.target).toBe(
      "rede-convite"
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nada fala de feed/perfil próprio enquanto não há convite", () => {
    for (const s of bloqueado.filter((s) => s.tab === "rede")) {
      expect(s.body).not.toMatch(
        /sua foto|seu perfil|Publicações das suas amigas/
      );
    }
  });

  it("navegação continua coerente", () => {
    bloqueado.forEach((s, i) => {
      if (!s.goTo) return;
      expect(bloqueado[i + 1].tab).toBe(s.goTo);
      expect(s.target).toBe(`nav-${s.goTo}`);
    });
  });
});

describe("wiring: tour e foto do Início seguem a Rede", () => {
  const tour = read("components/onboarding/AppTour.tsx");
  const gate = read("components/rede/RedeGatedTab.tsx");
  const rede = read("components/rede/RedeTab.tsx");

  it("AppTour usa os passos conforme o acesso e o contador acompanha", () => {
    expect(tour).toContain("const steps = stepsDoTour(redeAcesso);");
    expect(tour).toContain("{i + 1} de {steps.length}");
    expect(tour).not.toContain("TOUR_STEPS");
    expect(tour).toContain("!esperando && !aguardandoRede &&");
  });

  it("RedeGatedTab avisa o acesso (vitrine = bloqueado)", () => {
    expect(gate).toMatch(/estado === "semAcesso"\s*\? "bloqueado"/);
    expect(gate).toContain("onFotoPerfilChange={onFotoPerfilChange}");
  });

  it("RedeTab sobe só a foto salva (nunca a prévia blob:)", () => {
    expect(rede).toContain(
      "const fotoPerfilSalva = perfil ? (perfil.avatar_url ?? null) : undefined;"
    );
    expect(rede).toMatch(
      /onFotoPerfilChangeRef\.current\?\.\(fotoPerfilSalva\)/
    );
  });

  it.each(["app/page.tsx", "app/dev-preview/app/page.tsx"])(
    "%s liga acesso + foto",
    (p) => {
      const page = read(p);
      expect(page).toContain("onAcessoChange={setRedeAcesso}");
      expect(page).toContain("onFotoPerfilChange={setFotoRede}");
      expect(page).toContain("redeAcesso={redeAcesso}");
      expect(page).toContain("fotoUrl={fotoRede}");
    }
  );
});

describe("wiring: todo alvo do tour existe no código", () => {
  const fontes = [
    "app/page.tsx",
    "components/BottomNav.tsx",
    "components/FAB.tsx",
    "components/home/GreetingHeader.tsx",
    "components/rede/RedeHeader.tsx",
    "components/rede/RedeTeaserGate.tsx",
  ]
    .map(read)
    .join("\n");

  const todosOsPassos = [...TOUR_STEPS, ...stepsDoTour("bloqueado")];
  it.each(
    todosOsPassos.filter((s) => s.target && !s.target.startsWith("nav-"))
  )("data-tour=$target", ({ target }) => {
    expect(fontes).toContain(`data-tour="${target}"`);
  });

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
