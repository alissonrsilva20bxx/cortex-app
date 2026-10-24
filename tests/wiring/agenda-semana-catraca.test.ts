import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LIMITE_DO_GIRO_MS,
  paginaAoAssentar,
  semanasDoGiro,
  tocarSeta,
  type GiroDaSeta,
  rotuloDaSemana,
  semanasDesdeHoje,
} from "../../components/jobs/agendaSemana";

/**
 * Agenda: a faixa dos dias desliza com o dedo pra semana seguinte e as
 * anteriores, em catraca (uma semana inteira por gesto), com o indicador
 * de qual semana e a volta para hoje -- sem mudar a tela parada na semana
 * corrente (pixel da Agenda aprovada).
 *
 * A lógica pura roda de verdade aqui; a fiação do JobsTab é conferida por
 * texto (o vitest deste projeto não tem JSX). O gesto no navegador é
 * conferido por tests/visual/pixel/agenda-catraca.mjs.
 */

const ROOT = join(__dirname, "..", "..");
const jobsTab = readFileSync(
  join(ROOT, "components/jobs/JobsTab.tsx"),
  "utf-8"
).replace(/\r\n/g, "\n");

describe("paginaAoAssentar: só troca a semana numa borda de página", () => {
  const passo = 355; // 350px de faixa + 5px de vão

  it("assentou na página do meio: nada a fazer", () => {
    expect(paginaAoAssentar(355, passo)).toBe(0);
    expect(paginaAoAssentar(356, passo)).toBe(0);
  });

  it("assentou na anterior ou na seguinte", () => {
    expect(paginaAoAssentar(0, passo)).toBe(-1);
    expect(paginaAoAssentar(710, passo)).toBe(1);
    expect(paginaAoAssentar(709, passo)).toBe(1);
  });

  it("no meio de um arrasto (fora de uma borda) não troca", () => {
    expect(paginaAoAssentar(500, passo)).toBeNull();
    expect(paginaAoAssentar(358, passo)).toBeNull();
    expect(paginaAoAssentar(100, passo)).toBeNull();
  });

  it("aba escondida (largura 0) não troca", () => {
    expect(paginaAoAssentar(0, 0)).toBeNull();
  });

  it("nunca pula duas semanas", () => {
    expect(paginaAoAssentar(1065, passo)).toBe(1);
    expect(paginaAoAssentar(-355, passo)).toBe(-1);
  });
});

describe("semanasDesdeHoje e o indicador", () => {
  const hoje = new Date(2026, 8, 23, 10); // quarta, 23/09/2026

  it("conta semanas inteiras a partir da semana de hoje", () => {
    expect(semanasDesdeHoje(new Date(2026, 8, 20), hoje)).toBe(0);
    expect(semanasDesdeHoje(new Date(2026, 8, 27), hoje)).toBe(1);
    expect(semanasDesdeHoje(new Date(2026, 8, 13), hoje)).toBe(-1);
    expect(semanasDesdeHoje(new Date(2026, 9, 4), hoje)).toBe(2);
  });

  it("atravessa a virada do horário de verão sem errar a conta", () => {
    // Em Lisboa o relógio adianta 1h em 29/03/2026: de domingo 22/03 a
    // domingo 05/04 são 2 semanas menos 1 hora. Fuso fixado aqui pra o
    // teste valer em qualquer máquina (o Node relê o TZ na hora).
    const tz = process.env.TZ;
    process.env.TZ = "Europe/Lisbon";
    try {
      expect(
        semanasDesdeHoje(new Date(2026, 3, 5), new Date(2026, 2, 25, 10))
      ).toBe(2);
      expect(
        semanasDesdeHoje(new Date(2026, 2, 22), new Date(2026, 3, 8, 10))
      ).toBe(-2);
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });

  it("textos do indicador", () => {
    expect(rotuloDaSemana(0)).toBe("Esta semana");
    expect(rotuloDaSemana(1)).toBe("Próxima semana");
    expect(rotuloDaSemana(-1)).toBe("Semana passada");
    expect(rotuloDaSemana(3)).toBe("Daqui a 3 semanas");
    expect(rotuloDaSemana(-2)).toBe("Há 2 semanas");
  });
});

describe("JobsTab: a faixa é um rolador com catraca por semana", () => {
  it("3 páginas (anterior, visível, seguinte) a partir da semana visível", () => {
    expect(jobsTab).toMatch(
      /const paginas = \[-1, 0, 1\]\.map\(\(offset\) => \{\s*const inicio = addDays\(weekStart, offset \* 7\);/
    );
    expect(jobsTab).toMatch(
      /weekStrip: offset === 0 \? weekStrip : buildWeekStrip\(inicio, filtered\),/
    );
  });

  it("scroll-snap por semana inteira, uma semana por gesto", () => {
    expect(jobsTab).toContain('scrollSnapType: "x mandatory",');
    expect(jobsTab).toMatch(
      /flex: "0 0 100%",\s*gap: "5px",[\s\S]{0,120}scrollSnapAlign: "start",\s*scrollSnapStop: "always",/
    );
    expect(jobsTab).toContain('overscrollBehaviorX: "contain",');
  });

  it("deslizar na faixa nunca troca a aba", () => {
    expect(jobsTab).toMatch(
      /ref=\{faixaRef\}[\s\S]{0,200}data-no-tab-swipe=""/
    );
  });

  it("parada, mostra a página do meio, também quando a aba aparece ou o aparelho gira", () => {
    expect(jobsTab).toMatch(
      /const centralizarFaixa = useCallback\(\(\) => \{\s*const el = faixaRef\.current;\s*if \(el\) el\.scrollLeft = passoDaFaixa\(el\);\s*\}, \[\]\);/
    );
    expect(jobsTab).toMatch(
      /useLayoutEffect\(\(\) => \{\s*centralizarFaixa\(\);\s*\}, \[weekStart, centralizarFaixa\]\);/
    );
    // O efeito do ResizeObserver e do scrollend depende da função estável.
    expect(jobsTab).toMatch(
      /el\.removeEventListener\("scroll", rolar\);\s*\};\s*\}, \[centralizarFaixa\]\);/
    );
    expect(jobsTab).toContain(
      "const observador = new ResizeObserver(centralizarFaixa);"
    );
  });

  it("a semana troca quando a rolagem assenta numa página vizinha", () => {
    expect(jobsTab).toMatch(
      /paginaAoAssentar\(el\.scrollLeft, passoDaFaixa\(el\)\)[\s\S]{0,40}: null;\s*if \(pagina === -1 \|\| pagina === 1\) goToWeek\(pagina\);/
    );
    expect(jobsTab).toContain('el.addEventListener("scrollend", assentar);');
    expect(jobsTab).toContain(
      'el.addEventListener("scroll", rolar, { passive: true });'
    );
  });

  it("só a semana do meio é lida e recebe foco", () => {
    expect(jobsTab).toContain("aria-hidden={offset !== 0}");
    expect(jobsTab).toContain("tabIndex={offset === 0 ? undefined : -1}");
  });

  it("as setas do painel giram a mesma catraca (com o snap)", () => {
    expect(jobsTab).toContain("onClick={() => passarSemana(-1)}");
    expect(jobsTab).toContain("onClick={() => passarSemana(1)}");
    expect(jobsTab).toMatch(
      /left: passoDaFaixa\(el\) \* \(1 \+ delta\),\s*behavior: reduzir \? "auto" : "smooth",/
    );
  });

  it("indicador e 'Voltar para hoje' só fora da semana corrente", () => {
    expect(jobsTab).toMatch(
      /\{semanaAtual !== 0 && \([\s\S]{0,400}\{rotuloDaSemana\(semanaAtual\)\} · \{formatWeekRangeLabel\(weekStart\)\}/
    );
    expect(jobsTab).toMatch(
      /onClick=\{voltarParaHoje\}[\s\S]{0,300}Voltar para hoje/
    );
    expect(jobsTab).toMatch(
      /setWeekStart\(startOfWeek\(hoje\)\);\s*setSelectedDate\(toISODate\(hoje\)\);/
    );
  });

  it("o vão entre semanas é o mesmo dos dias e entra no passo da página", () => {
    expect(jobsTab).toContain("const VAO_ENTRE_SEMANAS = 5;");
    expect(jobsTab).toContain("el.clientWidth + VAO_ENTRE_SEMANAS");
    expect(jobsTab).toContain("gap: `${VAO_ENTRE_SEMANAS}px`,");
  });
});

describe("setas da Agenda: toques rápidos não travam a faixa", () => {
  /** Simula N toques com a rolagem ainda em curso e conta quantas rolagens
   * foram iniciadas e quantas semanas valem no fim. */
  function tocar(deltas: Array<-1 | 1>) {
    let giro: GiroDaSeta | null = null;
    let rolagens = 0;
    for (const d of deltas) {
      const r = tocarSeta(giro, d);
      giro = r.giro;
      if (r.rolar) rolagens++;
    }
    return { rolagens, semanas: semanasDoGiro(giro) };
  }
  it("1 toque: 1 rolagem e 1 semana", () => {
    expect(tocar([1])).toEqual({ rolagens: 1, semanas: 1 });
  });
  it("5 toques rápidos em '>': uma só rolagem, 5 semanas no fim (nenhum toque se perde)", () => {
    expect(tocar([1, 1, 1, 1, 1])).toEqual({ rolagens: 1, semanas: 5 });
  });
  it("toques de ida e volta somam o saldo; saldo 0 não anda", () => {
    expect(tocar([1, 1, -1])).toEqual({ rolagens: 1, semanas: 1 });
    expect(tocar([1, -1])).toEqual({ rolagens: 1, semanas: 0 });
  });
  it("sem giro em andamento: 0 semanas", () => {
    expect(semanasDoGiro(null)).toBe(0);
  });
  it("depois que o giro assenta, o próximo toque começa outra rolagem", () => {
    expect(tocarSeta(null, -1)).toEqual({
      giro: { semanas: -1 },
      rolar: true,
    });
  });
  it("a fiação: a seta soma ao giro, o fim anda o saldo e SEMPRE recentra, com limite de tempo", () => {
    expect(LIMITE_DO_GIRO_MS).toBeGreaterThan(300);
    expect(jobsTab).toContain("tocarSeta(giroRef.current, delta)");
    expect(jobsTab).toMatch(
      /if \(!rolar\) return;[\s\S]{0,260}el\.scrollTo\(/
    );
    expect(jobsTab).toMatch(
      /semanasDoGiro\(giroRef\.current\);[\s\S]{0,200}if \(semanas !== 0\) goToWeek\(semanas\);\s*centralizarFaixa\(\);/
    );
    expect(jobsTab).toContain("LIMITE_DO_GIRO_MS");
  });
});
