import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão da ticket #135 (mapa #122) — migração da Agenda pra
 * composição/timeline de `/dev-preview/ios`. Mesmo padrão de inspeção de
 * código-fonte já usado no projeto (sem DOM/RTL — ver nota em
 * `agenda-visual.test.ts`).
 *
 * Cobre os quatro contratos explícitos desta ticket que os testes
 * herdados de T3 (`agenda-visual.test.ts`/`agenda-gap-visual.test.ts`)
 * não cobriam:
 * 1. o indicador "Horário disponível" é só visual — nunca clicável, nunca
 *    reivindica disponibilidade real (é derivado só dos atendimentos
 *    reais do dia, sem duração inventada);
 * 2. "abrir atendimento" (JobDetailSheet) é um passo distinto de "editar"
 *    (JobForm real, intocado) — não colapsa os dois numa coisa só;
 * 3. indicação do dia atual (hoje) é distinta da seleção;
 * 4. Resumo/Anotações viraram sheets (decisão de #30 superseded), com o
 *    mesmo dado real de antes, não recalculado/mockado dentro do sheet.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const jobsTabSrc = read("components/jobs/JobsTab.tsx");
const jobDetailSrc = read("components/jobs/JobDetailSheet.tsx");
const resumoSheetSrc = read("components/jobs/AgendaResumoSheet.tsx");

describe('"Horário disponível" — indicador de lacuna é só visual, nunca uma função', () => {
  it('o texto "Horário disponível" existe na timeline', () => {
    expect(jobsTabSrc).toContain("Horário disponível");
  });

  it("o bloco do indicador de lacuna não tem onClick nem qualquer handler interativo", () => {
    const gapBlockMatch = jobsTabSrc.match(
      /key=\{`gap-\$\{i\}`\}[\s\S]*?Horário disponível[\s\S]*?<\/div>\s*<\/div>\s*\)/
    );
    expect(gapBlockMatch).not.toBeNull();
    expect(gapBlockMatch![0]).not.toMatch(/onClick|onPress|<button/i);
  });

  it("o intervalo mostrado vem só de horas reais de atendimentos consecutivos (fromLabel/toLabel), nunca de um horário comercial fixo", () => {
    expect(jobsTabSrc).toContain("fromLabel: formatHora(job.hora)");
    expect(jobsTabSrc).toContain("toLabel: formatHora(next.hora)");
  });

  it("o limiar de exibição é só de legibilidade, documentado como não sendo regra de agendamento/duração", () => {
    expect(jobsTabSrc).toContain("GAP_INDICATOR_THRESHOLD_MIN");
    expect(jobsTabSrc).toMatch(
      /NÃO uma regra[\s\S]{0,60}duração de atendimento/
    );
  });
});

describe('"Abrir atendimento" (JobDetailSheet) é um passo distinto de "editar" (JobForm real)', () => {
  it("JobsTab abre o detalhe (setDetailJob) ao tocar o card da timeline, não o JobForm direto", () => {
    expect(jobsTabSrc).toContain(
      "<JobCard job={item.job} onClick={setDetailJob} />"
    );
  });

  it("JobDetailSheet usa o BottomSheet compartilhado, não uma casca própria reinventada", () => {
    expect(jobDetailSrc).toMatch(
      /import\s*\{\s*BottomSheet\s*\}\s*from\s*"@\/components\/ui\/BottomSheet"/
    );
    expect(jobDetailSrc).toContain("<BottomSheet");
  });

  it('o rodapé do JobDetailSheet tem "Editar atendimento", que chama onEdit(job) — não edita nada localmente', () => {
    expect(jobDetailSrc).toMatch(
      /onClick=\{\(\) => onEdit\(job\)\}[\s\S]{0,400}Editar atendimento/
    );
  });

  it("JobsTab liga onEdit ao mesmo onEditJob real que já existia (abre o JobForm real, intocado)", () => {
    expect(jobsTabSrc).toMatch(
      /<JobDetailSheet[\s\S]*?onEdit=\{\(job\) => \{\s*\r?\n\s*setDetailJob\(null\);\s*\r?\n\s*onEditJob\(job\);/
    );
  });

  it("JobDetailSheet mostra os campos reais do contrato de paridade (Status, Valor, Modalidade, Local, Observações)", () => {
    for (const field of [
      "Status",
      "Valor",
      "Modalidade",
      "Local",
      "Observações",
    ]) {
      expect(jobDetailSrc).toContain(field);
    }
    expect(jobDetailSrc).toContain("<StatusBadge status={job.status} />");
    expect(jobDetailSrc).toContain("formatBRL(job.valor, 2)");
  });
});

describe("Indicação do dia atual (hoje) é distinta da seleção", () => {
  it("calcula isToday comparando com a data real do sistema, não com selectedDate", () => {
    expect(jobsTabSrc).toContain("const today = toISODate(new Date());");
    expect(jobsTabSrc).toContain("const isToday = iso === today;");
  });

  it("hoje-sem-estar-selecionado ganha um anel próprio, distinto do fundo sólido de selecionado", () => {
    expect(jobsTabSrc).toContain(
      'isToday && !selected ? "1px solid var(--accent)" : "none"'
    );
  });
});

describe("Resumo e Anotações viraram sheets (composição aprovada) preservando o dado real", () => {
  it("JobsTab não tem mais nenhum card colapsável de gráfico (chartOpen foi removido)", () => {
    expect(jobsTabSrc).not.toContain("chartOpen");
  });

  it("botão Resumo abre AgendaResumoSheet com o período/dado real calculado em JobsTab, não fabricado no sheet", () => {
    expect(jobsTabSrc).toMatch(
      /<AgendaResumoSheet[\s\S]*?periodData=\{periodData\}[\s\S]*?donutSegments=\{donutSegments\}/
    );
  });

  it("botão Anotações abre um BottomSheet com o NotasSection real (mesmo autosave de antes)", () => {
    expect(jobsTabSrc).toMatch(
      /<BottomSheet[\s\S]*?title="Anotações"[\s\S]*?<NotasSection userId=\{userId\} \/>/
    );
  });

  it("Resumo aceita Semana/Mês/Ano por extenso, mesma segmentação real de antes (buildPeriodData intocado)", () => {
    expect(resumoSheetSrc).toContain('{ id: "sem", label: "Semana" }');
    expect(resumoSheetSrc).toContain('{ id: "mes", label: "Mês" }');
    expect(resumoSheetSrc).toContain('{ id: "ano", label: "Ano" }');
  });
});

describe("Total do dia usa dado real, respeitando o filtro visível", () => {
  it("dayTotal soma valor real dos atendimentos do dia selecionado (selectedDayJobs), nunca um número fixo", () => {
    expect(jobsTabSrc).toContain(
      "const dayTotal = selectedDayJobs.reduce((s, j) => s + j.valor, 0);"
    );
  });

  it('rótulo muda entre "Total de hoje" e "Total do dia" conforme o dia selecionado seja hoje', () => {
    expect(jobsTabSrc).toContain(
      '{isViewingToday ? "Total de hoje" : "Total do dia"}'
    );
  });
});
