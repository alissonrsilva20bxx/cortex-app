import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "Concluir" no detalhe do atendimento (teste do dono no
 * iPhone, 17/10/2026): o Financeiro só conta atendimento concluído, e o
 * único jeito de concluir era o campo Status escondido no fim do
 * formulário. Teste de fiação (lê o código como texto), no mesmo padrão
 * de agenda-timeline-135.test.ts: o projeto não renderiza JSX no Vitest.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const detalhe = read("components/jobs/JobDetailSheet.tsx");
const hook = read("components/jobs/useMudarStatus.ts");
const agenda = read("components/jobs/JobsTab.tsx");

describe("JobDetailSheet: botões do fluxo de status", () => {
  it("usa as regras do fluxo (Confirmar antes do horário; Concluir e Não aconteceu a partir dele)", () => {
    expect(detalhe).toContain(
      "const confirmar = job ? podeConfirmar(job, agora) : false;"
    );
    expect(detalhe).toContain(
      "const concluir = job ? podeConcluir(job, agora) : false;"
    );
  });

  it("cada botão só aparece quando a regra deixa, acima do Editar", () => {
    const confirmar = detalhe.indexOf("{confirmar && (");
    const concluir = detalhe.indexOf("{concluir && (");
    const editar = detalhe.lastIndexOf("BOTOES_STATUS.editar");
    expect(confirmar).toBeGreaterThan(0);
    expect(concluir).toBeGreaterThan(confirmar);
    expect(editar).toBeGreaterThan(concluir);
  });

  it("cada botão pede o status certo", () => {
    expect(detalhe).toMatch(
      /onClick=\{\(\) => void aplicar\(job, "confirmado"\)\}/
    );
    expect(detalhe).toMatch(
      /onClick=\{\(\) => void aplicar\(job, "concluído"\)\}/
    );
    expect(detalhe).toMatch(
      /onClick=\{\(\) => void aplicar\(job, "cancelado"\)\}/
    );
  });

  it("grava o status no atendimento, pelo id", () => {
    expect(hook).toMatch(
      /\.from\("jobs"\)\s*\.update\(\{ status, atualizado_em: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\("id", id\)/
    );
  });

  it("com erro, avisa e não fecha; deu certo, fecha e avisa quem chamou", () => {
    expect(detalhe).toMatch(/if \(await mudar\(alvo, novo\)\) onClose\(\);/);
    expect(hook).toContain("setErro(ERRO_STATUS[novo]);");
    expect(hook).toContain("aoMudar?.();");
  });

  it("dois toques não gravam duas vezes", () => {
    expect(hook).toMatch(/if \(salvando\) return false;/);
    expect(detalhe).toMatch(/disabled=\{salvando\}/);
  });
});

describe("Concluir recarrega a Agenda, o Financeiro e a Início", () => {
  it("JobsTab passa o onStatusMudou para a página (ou recarrega só a Agenda)", () => {
    expect(agenda).toMatch(
      /onStatusMudou=\{\(\) => \{[\s\S]{0,200}if \(onJobSaved\) onJobSaved\(\);\s*else retryLoadJobs\(\);/
    );
  });

  for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"]) {
    const src = read(pagina);

    it(`${pagina}: salvar ou concluir sobe os dois contadores`, () => {
      expect(src).toMatch(
        /function recarregarAposAtendimento\(\) \{\s*setJobsRefreshKey\(\(k\) => k \+ 1\);\s*setFinanceiroRefreshKey\(\(k\) => k \+ 1\);\s*\}/
      );
    });

    it(`${pagina}: o JobForm e o detalhe usam o mesmo recarregamento`, () => {
      expect(src).toMatch(/onJobSaved=\{recarregarAposAtendimento\}/);
      const form = src.slice(src.lastIndexOf("<JobForm"));
      expect(form).toMatch(
        /onSaved=\{\(\) => \{\s*recarregarAposAtendimento\(\);/
      );
    });

    it(`${pagina}: o Financeiro recarrega pelo financeiroRefreshKey`, () => {
      expect(src).toMatch(
        /<FinanceiroTab[\s\S]{0,80}refreshTrigger=\{financeiroRefreshKey\}/
      );
    });
  }
});

describe("Dia contado da Jornada: ao concluir, não ao criar", () => {
  const form = read("components/jobs/JobForm.tsx");
  const hook = read("components/jobs/useMudarStatus.ts");

  it("o formulário não registra mais ao criar; registra só na virada para concluído", () => {
    expect(form).not.toMatch(/if \(!job\) void registrar\("atendimento"\)/);
    expect(form).toMatch(
      /if \(contaComoDiaAtivo\(job\?\.status \?\? null, form\.status\)\) \{\s*void registrar\("atendimento"\);/
    );
  });

  it("o detalhe e o Aconteceu? registram pelo mesmo hook, com a Jornada da usuária", () => {
    expect(hook).toContain("useJornada(userId)");
    expect(hook).toMatch(/registrar: \(acao\) => void registrar\(acao\)/);
    for (const f of [
      "components/jobs/JobDetailSheet.tsx",
      "components/jobs/AgendaAconteceu.tsx",
      "components/home/AconteceuCard.tsx",
    ]) {
      expect(read(f), f).toMatch(/useMudarStatus\(\s*userId,/);
    }
  });
});

describe("Jornada: planejar e descanso têm botão", () => {
  it("o JobForm registra planejar ao criar atendimento para um dia depois de hoje", () => {
    const form = read("components/jobs/JobForm.tsx");
    expect(form).toMatch(
      /if \(contaComoPlanejar\(job !== null, form\.data\)\) \{\s*void registrar\("planejar"\);/
    );
  });

  it("a Agenda tem o botão 'Descanso', que registra descanso", () => {
    expect(read("components/jobs/JobsTab.tsx")).toContain(
      "const descanso = useDescanso(userId, jobs);"
    );
    const hook = read("components/jobs/useDescanso.ts");
    expect(hook).toMatch(/descansar: \(\) => void registrar\("descanso"\)/);
    expect(read("components/jobs/AgendaAcoes.tsx")).toContain(
      "onClick: feito || comAtendimento ? undefined : descanso.onDescansar"
    );
  });
});
