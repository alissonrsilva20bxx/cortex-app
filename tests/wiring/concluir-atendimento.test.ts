import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "Marcar como concluído" no detalhe do atendimento (teste do dono no
 * iPhone, 17/10/2026): o Financeiro só conta atendimento concluído, e o
 * único jeito de concluir era o campo Status escondido no fim do
 * formulário. Teste de fiação (lê o código como texto), no mesmo padrão
 * de agenda-timeline-135.test.ts: o projeto não renderiza JSX no Vitest.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const detalhe = read("components/jobs/JobDetailSheet.tsx");
const agenda = read("components/jobs/JobsTab.tsx");

describe("JobDetailSheet: Marcar como concluído", () => {
  it("só agendado ou confirmado pode ser concluído", () => {
    expect(detalhe).toMatch(
      /export function podeConcluir\(job: Job\): boolean \{\s*return job\.status === "agendado" \|\| job\.status === "confirmado";/
    );
    expect(detalhe).toMatch(
      /const concluir = job \? podeConcluir\(job\) : false;/
    );
  });

  it("o botão aparece só quando pode concluir, acima do Editar", () => {
    const botao = detalhe.indexOf("Marcar como concluído");
    const editar = detalhe.lastIndexOf("Editar atendimento");
    expect(botao).toBeGreaterThan(0);
    expect(editar).toBeGreaterThan(botao);
    expect(detalhe).toMatch(
      /\{concluir && \(\s*<button[\s\S]{0,200}onClick=\{\(\) => void marcarConcluido\(job\)\}/
    );
  });

  it("grava o status concluído no atendimento, pelo id", () => {
    expect(detalhe).toMatch(
      /\.from\("jobs"\)\s*\.update\(\{ status: "concluído", atualizado_em: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\("id", alvo\.id\)/
    );
  });

  it("com erro, avisa e não fecha; deu certo, fecha e avisa quem chamou", () => {
    const fn = detalhe.slice(
      detalhe.indexOf("async function marcarConcluido"),
      detalhe.indexOf("const concluir =")
    );
    expect(fn).toMatch(/if \(error\) \{[\s\S]*?setErro\([\s\S]*?return;\s*\}/);
    expect(fn.indexOf("onClose();")).toBeGreaterThan(fn.indexOf("if (error)"));
    expect(fn).toContain("onConcluido?.();");
  });

  it("dois toques não gravam duas vezes", () => {
    expect(detalhe).toMatch(/if \(salvando\) return;/);
    expect(detalhe).toMatch(/disabled=\{salvando\}/);
  });
});

describe("Concluir recarrega a Agenda, o Financeiro e a Início", () => {
  it("JobsTab passa o onConcluido para a página (ou recarrega só a Agenda)", () => {
    expect(agenda).toMatch(
      /onConcluido=\{\(\) => \{[\s\S]{0,200}if \(onJobSaved\) onJobSaved\(\);\s*else retryLoadJobs\(\);/
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
      expect(form).toMatch(/onSaved=\{\(\) => \{\s*recarregarAposAtendimento\(\);/);
    });

    it(`${pagina}: o Financeiro recarrega pelo financeiroRefreshKey`, () => {
      expect(src).toMatch(
        /<FinanceiroTab[\s\S]{0,80}refreshTrigger=\{financeiroRefreshKey\}/
      );
    });
  }
});
