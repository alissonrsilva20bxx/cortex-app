import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  EstadoJornada,
  Periodo,
  TipoPeriodo,
} from "../../lib/jornada/estado";
import { TIPOS_PERIODO } from "../../lib/jornada/estado";
import {
  acoesFeitas,
  chaveDeGuardou,
  chaveDoRitmo,
  contador,
  doEstado,
  ehPeriodoAnterior,
  periodoVazio,
} from "../../components/jornada/resumos/leitura";
import {
  ACOES_DO_RESUMO,
  RESUMO_ABA,
  RESUMO_TITULO,
  RESUMO_VAZIO,
  resumoAcao,
  resumoAnterior,
  resumoDiasFortes,
  resumoGlow,
  resumoGuardou,
  resumoRitmo,
} from "../../lib/jornada/textos";

/**
 * Resumos da Jornada (J14, #164). Teste de fiação: lê o fonte e afirma que
 * os resumos só leem do hook, que nenhum texto visível ou moeda mora fora
 * de `textos.ts`, que só entram contadores que `jornada_periodos` guarda, e
 * que período vazio não quebra.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

const DIR = "components/jornada/resumos";
const FONTES = readdirSync(join(ROOT, DIR)).map((f) => `${DIR}/${f}`);
const semComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Contadores que a J09 realmente grava em `jornada_periodos`. */
const CHAVES_REAIS = new Set([
  "glow",
  "dias_fortes",
  "firme",
  "guardou",
  "semanas_firmes",
  "semanas_guardou",
  ...ACOES_DO_RESUMO,
]);

function periodo(contadores: Record<string, number>): Periodo {
  return { inicio: "2026-10-05", contadores };
}

/** Monta um estado na forma que o servidor manda (J10): corrente + ultimoFechado. */
function estadoCom(
  tipo: TipoPeriodo,
  atual: Periodo,
  fechado: Periodo | null = null
): EstadoJornada {
  const vazio = periodo({});
  return {
    periodos: {
      corrente: { semana: vazio, mes: vazio, ano: vazio, [tipo]: atual },
      ultimoFechado: fechado ? { [tipo]: fechado } : {},
    },
  } as unknown as EstadoJornada;
}

describe("J14 — os resumos só leem do hook", () => {
  it("nenhum arquivo importa Supabase, cliente ou cache", () => {
    for (const f of FONTES) {
      const src = semComentarios(read(f));
      expect(src, f).not.toMatch(
        /@\/lib\/supabase|from "\.\.\/\.\.\/lib\/supabase"/
      );
      expect(src, f).not.toMatch(/lib\/jornada\/(cliente|cache)/);
    }
  });

  it("o container monta o hook real da J11", () => {
    const src = read(`${DIR}/JornadaResumos.tsx`);
    expect(src).toMatch(
      /^import \{ useJornada \} from "@\/components\/jornada\/useJornada";$/m
    );
    expect(src).toMatch(/useJornada\(userId\)/);
  });

  it("nenhum resumo decide Glow, estágio, limite ou selo", () => {
    for (const f of FONTES) {
      const src = semComentarios(read(f));
      expect(src, f).not.toMatch(
        /\b(3000|1200|1500|glowTotal|estagio|selos)\b/
      );
    }
  });
});

describe("J14 — texto e moeda só em textos.ts", () => {
  it("nenhum símbolo de moeda nos resumos", () => {
    for (const f of FONTES) {
      expect(semComentarios(read(f)), f).not.toMatch(/€|EUR|R\$/);
    }
  });

  it("nenhuma string longa de interface escrita no componente", () => {
    for (const f of FONTES) {
      // Fora as linhas de import/export: o caminho de um módulo não é texto
      // de interface, e ele atravessaria a busca por literais.
      const src = semComentarios(read(f))
        .split("\n")
        .filter((l) => !/^\s*(import|export)\b.*from\s/.test(l))
        .join("\n");
      const literais = src.match(/"[^"\n]{12,}"/g) ?? [];
      const suspeitos = literais.filter((s) => {
        const dentro = s.slice(1, -1);
        if (dentro.startsWith("var(--")) return false; // token de cor
        if (/^(@\/|\.{1,2}\/)/.test(dentro)) return false; // caminho de módulo
        // vão entre dois atributos JSX na mesma linha (' aria-x='), não é literal
        if (/^\s/.test(dentro) || /=$/.test(dentro)) return false;
        // classe utilitária: só minúsculas, dígitos e pontuação de classe
        return !/^[a-z0-9_ :[\]()/.%-]+$/.test(dentro);
      });
      expect(suspeitos, `${f}: ${suspeitos.join(" | ")}`).toHaveLength(0);
    }
  });

  it("os textos do resumo existem e não são vazios", () => {
    for (const tipo of TIPOS_PERIODO) {
      expect(RESUMO_TITULO[tipo].length, tipo).toBeGreaterThan(0);
      expect(RESUMO_ABA[tipo].length, tipo).toBeGreaterThan(0);
      expect(RESUMO_VAZIO[tipo].length, tipo).toBeGreaterThan(0);
    }
  });
});

describe("J14 — só contadores que jornada_periodos guarda", () => {
  it("as chaves lidas são todas reais", () => {
    for (const tipo of TIPOS_PERIODO) {
      expect(CHAVES_REAIS.has(chaveDoRitmo(tipo)), tipo).toBe(true);
      expect(CHAVES_REAIS.has(chaveDeGuardou(tipo)), tipo).toBe(true);
    }
    for (const acao of ACOES_DO_RESUMO) {
      expect(CHAVES_REAIS.has(acao), acao).toBe(true);
    }
  });

  it("atendimento fica fora do resumo (decisão 1: volume de trabalho não é conquista)", () => {
    expect(ACOES_DO_RESUMO).not.toContain("atendimento");
  });

  it("nenhuma chave com cara de diário é lida", () => {
    for (const f of FONTES) {
      const src = semComentarios(read(f));
      expect(src, f).not.toMatch(
        /\bdias\b\s*:|"dia"|historico|por_dia|diario/i
      );
    }
  });

  it("a semana usa firme/guardou; mês e ano usam as contagens de semanas", () => {
    expect(chaveDoRitmo("semana")).toBe("firme");
    expect(chaveDoRitmo("mes")).toBe("semanas_firmes");
    expect(chaveDeGuardou("semana")).toBe("guardou");
    expect(chaveDeGuardou("ano")).toBe("semanas_guardou");
  });
});

describe("J14 — período vazio não quebra e não cobra", () => {
  it("período nulo é vazio e lê 0 em tudo", () => {
    for (const tipo of TIPOS_PERIODO) {
      expect(periodoVazio(null, tipo), tipo).toBe(true);
    }
    expect(contador(null, "glow")).toBe(0);
    expect(acoesFeitas(null)).toEqual([]);
  });

  it("período com contadores zerados também é vazio", () => {
    expect(periodoVazio(periodo({ glow: 0, despesa: 0 }), "semana")).toBe(true);
  });

  it("um único contador já tira do vazio", () => {
    expect(periodoVazio(periodo({ despesa: 1 }), "semana")).toBe(false);
    expect(periodoVazio(periodo({ glow: 5 }), "mes")).toBe(false);
  });

  it("o estado na forma do servidor: corrente sempre existe, fechado é opcional", () => {
    const e = estadoCom("semana", periodo({ glow: 45, dias_fortes: 2 }));
    expect(doEstado(e, "semana").atual.contadores.glow).toBe(45);
    expect(doEstado(e, "semana").fechado).toBeNull();
    // os outros tipos existem e estão vazios -- nunca indefinidos
    expect(doEstado(e, "mes").atual.contadores).toEqual({});
    expect(periodoVazio(doEstado(e, "ano").atual, "ano")).toBe(true);
  });

  it("o último fechado chega quando é mesmo o mês anterior", () => {
    const e = estadoCom(
      "mes",
      { inicio: "2026-10-01", contadores: { glow: 10 } },
      { inicio: "2026-09-01", contadores: { glow: 80 } }
    );
    expect(doEstado(e, "mes").fechado?.contadores.glow).toBe(80);
  });

  it("um fechado antigo não vira comparação", () => {
    const e = estadoCom(
      "mes",
      { inicio: "2026-10-01", contadores: { glow: 10 } },
      { inicio: "2026-03-01", contadores: { glow: 80 } }
    );
    expect(doEstado(e, "mes").fechado).toBeNull();
  });
});

describe("J14 — os textos contam sem cobrar", () => {
  it("Glow do período, por tipo", () => {
    expect(resumoGlow(45, "semana")).toContain("45");
    expect(resumoGlow(45, "mes")).toContain("neste mês");
  });

  it("singular e plural", () => {
    expect(resumoDiasFortes(1)).toBe("1 dia forte");
    expect(resumoDiasFortes(3)).toContain("dias fortes");
    expect(resumoAcao("despesa", 1)).toBe("1 despesa lançada");
    expect(resumoAcao("despesa", 4)).toBe("4 despesas lançadas");
  });

  it("ritmo e dinheiro guardado mudam de forma entre semana e mês", () => {
    expect(resumoRitmo(1, "semana")).toBe("Semana firme");
    expect(resumoRitmo(2, "mes")).toContain("2 semanas firmes");
    expect(resumoGuardou(1, "semana")).toContain("guardou");
    expect(resumoGuardou(3, "ano")).toContain("3 semanas");
  });

  it("zero não vira linha nenhuma (nada de 0 de 3)", () => {
    expect(resumoRitmo(0, "semana")).toBeNull();
    expect(resumoGuardou(0, "mes")).toBeNull();
    expect(resumoAcao("despesa", 0)).toBeNull();
  });

  it("a comparação com o período anterior é só informativa", () => {
    expect(resumoAnterior(80, "semana")).toContain("Na semana passada");
    expect(resumoAnterior(80, "semana")).toContain("80");
  });
});

describe("J14 — a tela abre o resumo, e as abas trocam", () => {
  const tela = read("components/jornada/JornadaScreen.tsx");
  const container = read(`${DIR}/JornadaResumos.tsx`);

  it("a JornadaScreen importa e monta o resumo", () => {
    expect(tela).toMatch(
      /^import \{ JornadaResumos \} from "\.\/resumos\/JornadaResumos";$/m
    );
    expect(tela).toMatch(/<JornadaResumos\s+userId=\{userId\}\s*\/>/);
  });

  it("cada aba troca para o próprio período, não para um fixo", () => {
    expect(container).toMatch(/onClick=\{\(\) => setAba\(tipo\)\}/);
    expect(container).not.toMatch(/setAba\("(semana|mes|ano)"\)/);
  });

  it("o container percorre os três tipos, sem lista própria", () => {
    expect(container).toMatch(/TIPOS_PERIODO\.map/);
  });
});

describe("J14 — o componente trata o vazio, não só a leitura", () => {
  const comp = read(`${DIR}/ResumoPeriodo.tsx`);

  it("ResumoPeriodo decide pelo periodoVazio e mostra RESUMO_VAZIO", () => {
    expect(comp).toMatch(/periodoVazio\(atual, tipo\)/);
    expect(comp).toMatch(/RESUMO_VAZIO\[tipo\]/);
    // o ramo do vazio existe de verdade: nada de Glow quando está vazio
    expect(comp).toMatch(/\{vazio \? \(/);
  });

  it("o Glow do período só aparece fora do vazio", () => {
    const depoisDoVazio = comp.slice(comp.indexOf("{vazio ? ("));
    const ramoCheio = depoisDoVazio.slice(depoisDoVazio.indexOf(") : ("));
    expect(ramoCheio).toMatch(/resumoGlow\(/);
  });
});

describe("J14 — a comparação não cobra e não mente", () => {
  it("só compara com o período imediatamente anterior", () => {
    const semana = periodo({ glow: 10 });
    const anterior = { inicio: "2026-09-28", contadores: { glow: 80 } };
    const antiga = { inicio: "2026-08-24", contadores: { glow: 80 } };
    const corrente = { inicio: "2026-10-05", contadores: { glow: 10 } };
    expect(ehPeriodoAnterior(corrente, anterior, "semana")).toBe(true);
    expect(ehPeriodoAnterior(corrente, antiga, "semana")).toBe(false);
    expect(ehPeriodoAnterior(corrente, null, "semana")).toBe(false);
    expect(semana.inicio).toBe("2026-10-05");
  });

  it("mês e ano conferem o calendário, não sete dias", () => {
    const mes = { inicio: "2026-10-01", contadores: { glow: 10 } };
    expect(
      ehPeriodoAnterior(mes, { inicio: "2026-09-01", contadores: {} }, "mes")
    ).toBe(true);
    expect(
      ehPeriodoAnterior(mes, { inicio: "2026-07-01", contadores: {} }, "mes")
    ).toBe(false);
    const ano = { inicio: "2026-01-01", contadores: { glow: 10 } };
    expect(
      ehPeriodoAnterior(ano, { inicio: "2025-01-01", contadores: {} }, "ano")
    ).toBe(true);
    expect(
      ehPeriodoAnterior(ano, { inicio: "2023-01-01", contadores: {} }, "ano")
    ).toBe(false);
  });

  it("a virada de ano não quebra a semana nem o mês", () => {
    expect(
      ehPeriodoAnterior(
        { inicio: "2027-01-04", contadores: { glow: 1 } },
        { inicio: "2026-12-28", contadores: {} },
        "semana"
      )
    ).toBe(true);
    expect(
      ehPeriodoAnterior(
        { inicio: "2027-01-01", contadores: { glow: 1 } },
        { inicio: "2026-12-01", contadores: {} },
        "mes"
      )
    ).toBe(true);
  });

  it("período corrente vazio não ganha comparação (seria cobrança)", () => {
    const e = estadoCom("semana", periodo({}), {
      inicio: "2026-09-28",
      contadores: { glow: 80 },
    });
    expect(doEstado(e, "semana").fechado).toBeNull();
  });

  it("a linha de comparação não tem seta, sinal nem julgamento", () => {
    const texto = resumoAnterior(80, "semana");
    expect(texto).not.toMatch(/[▲▼↑↓+−-]|mais|menos|melhor|pior|caiu|subiu/i);
  });
});

describe("J14 — discrição: o resumo não vaza da tela da Jornada", () => {
  it("nada fora de components/jornada importa os resumos", () => {
    const raizes = ["app", "components", "lib"];
    const pendentes = raizes.map((r) => join(ROOT, r));
    const culpados: string[] = [];
    while (pendentes.length > 0) {
      const dir = pendentes.pop() as string;
      for (const nome of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, nome.name);
        if (nome.isDirectory()) {
          if (nome.name !== "node_modules") pendentes.push(caminho);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(nome.name)) continue;
        const rel = caminho.slice(ROOT.length + 1).replace(/\\/g, "/");
        if (rel.startsWith("components/jornada/")) continue;
        if (/from "[^"]*resumos\//.test(readFileSync(caminho, "utf-8"))) {
          culpados.push(rel);
        }
      }
    }
    expect(culpados).toEqual([]);
  });
});
