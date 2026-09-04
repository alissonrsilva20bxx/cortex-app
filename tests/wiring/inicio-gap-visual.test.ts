import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T11 (issue #38) — itens P0/P1 da Seção 2 (Início) do checklist de
 * paridade funcional sem cobertura automatizada até então.
 * `tests/wiring/inicio-visual.test.ts` (T2) cobre a composição visual;
 * este arquivo cobre o CONTRATO funcional (onClick real, cálculo real,
 * modelo binário, persistência), que é o que o checklist realmente pede.
 *
 * IDs: §2-P0-1 .. §2-P0-4, §2-P1-1 .. §2-P1-3.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("§2-P0-1 — HeroCard clicável (navega a Financeiro) e calculado de jobs/metas reais", () => {
  const src = read("components/home/HeroCard.tsx");

  it("usa monthProjection(jobs, metas) de lib/finance.ts, não valor fixo", () => {
    expect(src).toMatch(
      /import\s*\{[^}]*monthProjection[^}]*\}\s*from\s*"@\/lib\/finance"/
    );
    expect(src).toMatch(/monthProjection\(jobs, metas\)/);
  });

  it("o card inteiro é clicável via onClick={onGoToFinanceiro}", () => {
    expect(src).toMatch(/onClick=\{onGoToFinanceiro\}/);
  });

  it("app/page.tsx passa onGoToFinanceiro real (navega para a aba financeiro)", () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(
      /<HeroCard[\s\S]*?onGoToFinanceiro=\{\(\) => handleTabChange\("financeiro"\)\}/
    );
  });
});

describe("§2-P0-2 — NextJobCard expande/recolhe ao tocar, nunca navega nem abre formulário", () => {
  const src = read("components/home/NextJobCard.tsx");

  it("onClick alterna o estado local `expanded`, não abre formulário nem navega", () => {
    expect(src).toMatch(
      /onClick=\{job \? \(\) => setExpanded\(\(v\) => !v\) : undefined\}/
    );
  });

  it("não importa nem referencia JobForm/onEditJob/router (não é um atalho de navegação disfarçado)", () => {
    expect(src).not.toMatch(/JobForm/);
    expect(src).not.toMatch(/onEditJob/);
    expect(src).not.toMatch(/router\.push/);
  });
});

describe("§2-P0-3 — ObjetivosCard é binário (concluido/não-concluido), grava via update real", () => {
  const src = read("components/home/ObjetivosCard.tsx");

  it("toggle chama onToggle(id, !concluido) — nunca um valor percentual inventado", () => {
    expect(src).toMatch(
      /onClick=\{\(\) => onToggle\(obj\.id, !obj\.concluido\)\}/
    );
    // Nenhum objetivo individual é renderizado com uma barra/valor percentual
    // (a menção a "percentual" no comentário de topo documenta a decisão de
    // NÃO fazer isso — não é código de UI).
    expect(src).not.toMatch(/obj\.(percent|progresso|pct)/i);
  });

  it('app/page.tsx grava o toggle via supabase.from("objetivos").update, não estado local isolado', () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(
      /async function handleToggleObjetivo\(id: string, concluido: boolean\) \{\s*\r?\n\s*await supabase\.from\("objetivos"\)\.update\(\{ concluido \}\)\.eq\("id", id\);/
    );
    expect(page).toMatch(
      /<ObjetivosCard[\s\S]*?onToggle=\{handleToggleObjetivo\}/
    );
  });
});

describe("§2-P0-4 — CTA de novo atendimento sempre abre o JobForm real completo", () => {
  it("FAB da Início (aba home) dispara o mesmo JobForm real usado na Agenda, não um placeholder", () => {
    const page = read("app/page.tsx");
    // handleFabAction trata "home" e "jobs" de forma idêntica (mesmo JobForm real)
    expect(page).toMatch(
      /if \(activeTab === "jobs" \|\| activeTab === "home"\) \{\s*\r?\n\s*setEditingJob\(null\);\s*\r?\n\s*setJobFormOpen\(true\);/
    );
    expect(page).toMatch(/<JobForm\s/);
  });
});

describe("§2-P1-1 — Início não introduz ícones de notificação/perfil (vivem na Rede hoje)", () => {
  it("GreetingHeader (usado na Início) não ganhou um sino de notificação novo, nem um avatar clicável de atalho", () => {
    const src = read("components/home/GreetingHeader.tsx");
    // O avatar da própria usuária já existe legitimamente aqui (mostra a
    // foto/inicial dela na saudação); o que o item proíbe é um sino de
    // notificação novo, ou um avatar que navegue/abra algo ao ser clicado.
    expect(src).not.toMatch(/Bell|notificac/i);
    expect(src).not.toMatch(/onClick=\{/);
  });
});

describe("§2-P1-2 — homeCards controla NextJobCard/ObjetivosCard em tempo real e após reload", () => {
  const page = read("app/page.tsx");

  it("NextJobCard só renderiza quando homeCards.nextJob está ligado", () => {
    expect(page).toMatch(
      /\{homeCards\.nextJob && <NextJobCard jobs=\{jobs\} \/>\}/
    );
  });

  it("ObjetivosCard só renderiza quando homeCards.objetivos está ligado", () => {
    expect(page).toMatch(/\{\(homeCards\.objetivos \?\? true\) && \(/);
  });

  it("homeCards é lido do localStorage no mount (sobrevive a reload)", () => {
    expect(page).toMatch(/localStorage\.getItem\("jobapp-home-cards"\)/);
  });

  it("AjustesTab propaga mudanças de homeCards de volta pro estado raiz (tempo real)", () => {
    expect(page).toMatch(
      /<AjustesTab[\s\S]*?onHomeCardsChange=\{setHomeCards\}/
    );
  });
});

describe("§2-P1-3 — Início aparece direto depois do PIN", () => {
  it("não usa o loader de marca JobApp enquanto os dados terminam de carregar", () => {
    const page = read("app/page.tsx");
    expect(page).not.toMatch(/<LoadingScreen/);
  });

  it("NextJobCard resolve seu próprio estado vazio (sem atendimento agendado)", () => {
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toMatch(/Nenhum atendimento agendado ainda/);
  });

  it("ObjetivosCard resolve seu próprio estado vazio (zero objetivos)", () => {
    const src = read("components/home/ObjetivosCard.tsx");
    expect(src).toMatch(/if \(objetivos\.length === 0\)/);
  });
});
