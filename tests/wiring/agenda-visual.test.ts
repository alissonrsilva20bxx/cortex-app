import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização), mesmo padrão de
 * `tests/wiring/inicio-visual.test.ts` (T2): confirma, a partir do
 * código fonte, que `/dev-preview/app` realmente importa e renderiza o
 * `JobsTab` real (não uma cópia/mock), e que os arquivos de Agenda
 * tocados por este ticket (T3/#30) carregam o marcador da composição
 * nova sem perder a funcionalidade real preservada.
 *
 * Não usa Vitest+RTL: este projeto não tem `@testing-library/react` nem
 * um plugin de JSX no `vitest.config.ts`. Ler o arquivo como texto evita
 * isso e ainda pega o bug relatado (import antigo, wrapper escondendo o
 * componente novo, versão duplicada).
 */

const ROOT = join(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("/dev-preview/app renders the T3 Agenda component", () => {
  const page = read("app/dev-preview/app/page.tsx");

  it("imports JobsTab from the real component path, not a duplicate/mock", () => {
    expect(page).toMatch(
      /import\s*{[^}]*\bJobsTab\b[^}]*}\s*from\s*"@\/components\/jobs\/JobsTab"/
    );
  });

  it("actually renders <JobsTab in the jobs tab JSX", () => {
    expect(page).toContain("<JobsTab");
  });

  it("does not import a second/alternate copy of JobsTab from elsewhere", () => {
    const importLines = page.split("\n").filter((l) => /^\s*import\b/.test(l));
    const matches = importLines.filter((l) => /\bJobsTab\b/.test(l));
    expect(matches).toHaveLength(1);
  });
});

describe("JobsTab.tsx carries the T3 weekly-calendar composition", () => {
  const src = read("components/jobs/JobsTab.tsx");

  it("has the weekly calendar grid and day-selection state, not the old flat list", () => {
    expect(src).toContain("grid-cols-7");
    expect(src).toContain("selectedDate");
    expect(src).toContain("weekStart");
  });

  it("has the agenda-ratchet animation, isolated (no .launch-preview scope)", () => {
    expect(src).toContain("agenda-ratchet-day");
    expect(src).toContain("agenda-ratchet-panel");
    // The lab's literal, over-scoped selector — not just any mention of
    // ".launch-preview" (a code comment explains the decision not to use
    // it, which would otherwise false-positive a plain substring check).
    expect(src).not.toContain(".launch-preview .agenda-ratchet");
  });

  it("does not duplicate a prefers-reduced-motion media query (relies on the existing global one)", () => {
    // A prose mention in a comment (explaining reliance on the global
    // rule) is fine; an actual duplicated @media block is not.
    expect(src).not.toMatch(/@media\s*\(\s*prefers-reduced-motion/);
  });

  it("preserves the real status filter, chart, and notes functionality", () => {
    expect(src).toContain("STATUS_META");
    expect(src).toContain("MiniBarChart");
    expect(src).toContain("DonutChart");
    expect(src).toContain("chartType");
    expect(src).toContain("NotasSection");
  });

  it("does not introduce a service-title or duration field the real Job type doesn't have", () => {
    expect(src).not.toMatch(/tituloServico|servicoTitulo|duracao|duration/i);
  });
});

describe("JobCard.tsx keeps its real onClick contract and real fields only", () => {
  const src = read("components/jobs/JobCard.tsx");

  it("keeps the onClick(job) contract JobsTab depends on", () => {
    expect(src).toContain("onClick: (job: Job) => void");
  });

  it("only displays real Job fields (client name, hora, modalidade/local, valor, status)", () => {
    expect(src).toContain("job.clienteNome");
    expect(src).toContain("job.hora");
    expect(src).toContain("job.valor");
    expect(src).toContain("StatusBadge");
  });
});

describe("JobForm.tsx close button meets the 44px touch-target minimum", () => {
  it('has an explicit 44px minHeight/minWidth on the close button', () => {
    const src = read("components/jobs/JobForm.tsx");
    expect(src).toContain('minWidth: "44px"');
    expect(src).toContain('minHeight: "44px"');
  });
});
