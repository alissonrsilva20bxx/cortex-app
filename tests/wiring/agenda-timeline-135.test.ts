import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão da ticket #135 (mapa #122) — migração da Agenda pra
 * composição/timeline de `/dev-preview/ios`. Mesmo padrão de inspeção de
 * código-fonte já usado no projeto (sem DOM/RTL — ver nota em
 * `agenda-visual.test.ts`).
 *
 * Cobre os contratos explícitos desta ticket que os testes herdados de
 * T3 (`agenda-visual.test.ts`/`agenda-gap-visual.test.ts`) não cobriam:
 * 1. a nota "Próximo atendimento às HHhMM" nunca afirma disponibilidade
 *    (revisão pós-fechamento: a versão original — "Horário disponível" —
 *    fazia uma alegação não comprovável, já que `Job` não tem duração/
 *    hora de término real; ver nota completa em `buildTimelineItems`);
 * 2. "abrir atendimento" (JobDetailSheet) é um passo distinto de "editar"
 *    (JobForm real, intocado) — não colapsa os dois numa coisa só;
 * 3. indicação do dia atual (hoje) é distinta da seleção;
 * 4. Resumo/Anotações viraram sheets (decisão de #30 superseded), com o
 *    mesmo dado real de antes, não recalculado/mockado dentro do sheet;
 * 5. (revisão pós-fechamento) falha de carregamento é distinta de agenda
 *    vazia — dado existente é preservado em revalidação, "Tentar
 *    novamente" redispara o fetch real.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const jobsTabSrc = read("components/jobs/JobsTab.tsx");
const jobDetailSrc = read("components/jobs/JobDetailSheet.tsx");
const resumoSheetSrc = read("components/jobs/AgendaResumoSheet.tsx");

describe('Nota "Próximo atendimento às HHhMM" nunca afirma disponibilidade (revisão pós-fechamento)', () => {
  it('a palavra "disponível"/"disponibilidade" não aparece em nenhum lugar de JobsTab.tsx', () => {
    // Varredura ampla e deliberadamente grosseira (não só no bloco da
    // nota): a exigência da revisão é que essa alegação não comprovável
    // não apareça em lugar nenhum, não só que uma ocorrência específica
    // tenha sido trocada.
    expect(jobsTabSrc).not.toMatch(/dispon[íi]vel|disponibilidade/i);
  });

  it('mostra a nota neutra "Próximo atendimento às {hora}" no lugar', () => {
    expect(jobsTabSrc).toContain("Próximo atendimento às {item.nextLabel}");
  });

  it("o bloco da nota não tem onClick nem qualquer handler interativo — continua só uma leitura visual, nunca uma função", () => {
    const noteBlockMatch = jobsTabSrc.match(
      /key=\{`next-note-\$\{i\}`\}[\s\S]*?Próximo atendimento[\s\S]*?<\/div>/
    );
    expect(noteBlockMatch).not.toBeNull();
    expect(noteBlockMatch![0]).not.toMatch(/onClick|onPress|<button/i);
  });

  it("a hora mostrada vem só do próximo atendimento real (nextLabel = formatHora(next.hora)), nunca uma janela [de, até] fabricada", () => {
    expect(jobsTabSrc).toContain("nextLabel: formatHora(next.hora)");
    // O tipo do item não carrega mais um par [fromLabel, toLabel] — só
    // consegue expressar "a hora do próximo", nunca um intervalo/janela.
    expect(jobsTabSrc).toContain('{ kind: "next-note"; nextLabel: string }');
    expect(jobsTabSrc).not.toMatch(/fromLabel/);
  });

  it("o limiar de exibição é só de legibilidade, documentado como não sendo regra de agendamento/duração", () => {
    expect(jobsTabSrc).toContain("NEXT_JOB_NOTE_THRESHOLD_MIN");
    expect(jobsTabSrc).toMatch(
      /NÃO uma regra[\s\S]{0,60}duração[\s\S]{0,20}atendimento/
    );
  });

  it("a justificativa documenta explicitamente por que início-a-início não prova disponibilidade real", () => {
    expect(jobsTabSrc).toMatch(/não prova\*\*[\s\S]{0,120}vago/);
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

describe("Estado de erro (revisão pós-fechamento) — distinto de agenda vazia, preserva dado existente", () => {
  it("o efeito de fetch lê `error` da resposta real (não só `data`)", () => {
    expect(jobsTabSrc).toContain(".then(({ data, error }) => {");
  });

  it("em erro, NUNCA chama setJobs — o array de jobs não é zerado/substituído (preserva dado existente em revalidação)", () => {
    const errorBranch = jobsTabSrc.match(/if \(error\) \{[\s\S]*?\} else \{/);
    expect(errorBranch).not.toBeNull();
    expect(errorBranch![0]).not.toMatch(/setJobs\(/);
    expect(errorBranch![0]).toContain("setLoadError(true)");
  });

  it("só o branch de sucesso grava jobs/hasLoadedOnce e limpa o erro — erro nunca vira lista vazia silenciosa", () => {
    const successBranch = jobsTabSrc.match(
      /\} else \{[\s\S]*?setLoadError\(false\);\s*\r?\n\s*\}/
    );
    expect(successBranch).not.toBeNull();
    expect(successBranch![0]).toContain(
      "setJobs(data ? data.map(dbRowToJob) : [])"
    );
    expect(successBranch![0]).toContain("setHasLoadedOnce(true)");
  });

  it('"blockingError" (1ª carga falha, sem dado nenhum) é distinto de dia vazio de verdade — painel de erro próprio, nunca "Nenhum compromisso"', () => {
    expect(jobsTabSrc).toContain(
      "const blockingError = loadError && !hasLoadedOnce;"
    );
    expect(jobsTabSrc).toContain("Não foi possível carregar sua agenda");
    // O ramo `blockingError ? (...)` vem antes do texto de erro no
    // arquivo (garante que é esse ramo, não outro lugar, que o
    // renderiza) — checado por posição em vez de uma janela de
    // caracteres fixa (frágil: o bloco real tem ~800 caracteres de JSX/
    // comentário entre as duas pontas).
    const ternaryIdx = jobsTabSrc.indexOf("{blockingError ? (");
    const messageIdx = jobsTabSrc.indexOf(
      "Não foi possível carregar sua agenda"
    );
    expect(ternaryIdx).toBeGreaterThan(-1);
    expect(messageIdx).toBeGreaterThan(ternaryIdx);

    // O painel de erro em si (o ramo `blockingError ? (...)`) não contém
    // o texto de dia vazio — são estados mutuamente exclusivos.
    const blockingBlock = jobsTabSrc.match(
      /\{blockingError \? \([\s\S]*?\) : \(/
    );
    expect(blockingBlock).not.toBeNull();
    expect(blockingBlock![0]).not.toContain("Nenhum compromisso neste dia");
  });

  it('erro de revalidação (dado já carregado) mostra aviso não-bloqueante "Mostrando dados já carregados" — timeline/filtros/total continuam no ar', () => {
    expect(jobsTabSrc).toContain("{loadError && hasLoadedOnce && (");
    expect(jobsTabSrc).toContain(
      "Não foi possível atualizar. Mostrando dados já carregados."
    );
  });

  it('"Tentar novamente" existe nos dois estados de erro e chama retryLoadJobs (redispara o fetch real)', () => {
    const retryOccurrences = jobsTabSrc.match(/onClick=\{retryLoadJobs\}/g);
    expect(retryOccurrences).not.toBeNull();
    expect(retryOccurrences!.length).toBeGreaterThanOrEqual(2);
    expect(jobsTabSrc).toContain("Tentar novamente");
  });

  it("retryLoadJobs só incrementa um nonce local (retryNonce) — não inventa uma segunda função de fetch duplicada", () => {
    expect(jobsTabSrc).toMatch(
      /function retryLoadJobs\(\) \{\s*\r?\n\s*setRetryNonce\(\(n\) => n \+ 1\);\s*\r?\n\s*\}/
    );
    expect(jobsTabSrc).toContain("[refreshTrigger, retryNonce]");
  });

  it("durante uma revalidação em segundo plano (retry com dado já carregado), a UI não volta pro spinner nem some com a timeline", () => {
    expect(jobsTabSrc).toContain(
      "const initialLoading = loading && !hasLoadedOnce;"
    );
    // O spinner e o painel de "1ª carga" só reagem a `initialLoading`,
    // nunca ao `loading` cru — é essa distinção que preserva o dado
    // existente visível durante o retry.
    expect(jobsTabSrc).toContain("{initialLoading ? (");
    expect(jobsTabSrc).not.toMatch(
      /\{loading \? \(\s*\r?\n\s*<div className="flex justify-center pt-8"/
    );
  });

  it("filtros e timeline continuam funcionando normalmente fora dos dois estados de erro (não foram quebrados pela mudança)", () => {
    expect(jobsTabSrc).toContain("{FILTERS.map(({ id, label }) => {");
    expect(jobsTabSrc).toContain("timelineItems.map((item, i) =>");
    expect(jobsTabSrc).toContain("onClick={() => setFilter(id)}");
  });
});
