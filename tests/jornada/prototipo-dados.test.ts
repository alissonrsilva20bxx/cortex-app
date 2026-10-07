import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ehEstadoJornada } from "../../lib/jornada/estado";
import {
  estadoJornadaAno,
  estadoJornadaContaNova,
  estadoJornadaExemplo,
} from "../../lib/mockJornada";

/**
 * Ordem do operador (0036): o servidor manda tudo o que o protótipo aprovado
 * (docs/jornada/referencias/prototipo-sua-jornada.html) mostra, com as REGRAS
 * do protótipo. Este teste lê o protótipo e a migration 0036 e trava:
 *
 *  1. as regras que vêm do protótipo (trincas, prêmios, pilares);
 *  2. o que o estado manda (cada campo novo, da fonte de verdade);
 *  3. a marca da semana: só a semana corrente, só forte/descanso;
 *  4. o laboratório produz os números da foto "Agora".
 */

const ROOT = join(__dirname, "..", "..");
const ler = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const PROTO = ler("docs/jornada/referencias/prototipo-sua-jornada.html");
const JS = PROTO.slice(PROTO.indexOf("<script>"));
const SQL = ler("supabase/migrations/0036_jornada_prototipo.sql");

/** O corpo de uma função da 0036. */
function corpo(nome: string): string {
  const i = SQL.indexOf(`create or replace function ${nome}(`);
  expect(i, nome).toBeGreaterThan(-1);
  return SQL.slice(i, SQL.indexOf("\n$$;", i));
}

// ---------------------------------------------------------------------------
// 1. Regras do protótipo
// ---------------------------------------------------------------------------

describe("0036 — as regras são as do protótipo", () => {
  it("as 3 trincas do protótipo (CH_SETS), por mês % 3", () => {
    const chave: Record<string, string> = {
      plan: "planejar",
      saveWk: "semanas_guardou",
      rest: "descanso",
      vault: "comprovante_cofre",
      expense: "despesa",
      strong: "dias_fortes",
      helped: "dica_ajudou",
    };
    const bloco = JS.slice(
      JS.indexOf("var CH_SETS = ["),
      JS.indexOf("];", JS.indexOf("var CH_SETS = ["))
    );
    const doProto = [
      ...bloco.matchAll(
        /\[\['(\w+)', (\d+)[^\]]*\], \['(\w+)', (\d+)[^\]]*\], \['(\w+)', (\d+)[^\]]*\]\]/g
      ),
    ].flatMap((m, t) => [
      `${t}/1/${chave[m[1]]}/${m[2]}`,
      `${t}/2/${chave[m[3]]}/${m[4]}`,
      `${t}/3/${chave[m[5]]}/${m[6]}`,
    ]);
    expect(doProto).toHaveLength(9);
    const doSql = [
      ...corpo("private.jornada_missoes").matchAll(
        /\((\d+), (\d+), '([a-z_]+)', (\d+)\)/g
      ),
    ].map((m) => `${m[1]}/${m[2]}/${m[3]}/${m[4]}`);
    expect(doSql).toEqual(doProto);
    // O protótipo escolhe a trinca por getMonth() % 3 (janeiro = 0).
    expect(JS).toContain("return CH_SETS[S.date.getMonth() % 3];");
    expect(corpo("private.jornada_missoes")).toContain(
      "where m.trinca = (p_mes - 1) % 3"
    );
  });

  it("prêmios de uma vez = GOAL_PTS, MILE_PTS e CH_PTS do protótipo", () => {
    const n = (nome: string) =>
      Number(JS.match(new RegExp(`${nome} = (\\d+)`))![1]);
    const premio = corpo("private.jornada_premio");
    expect(premio).toContain(`when 'meta' then ${n("GOAL_PTS")}`);
    expect(premio).toContain(`when 'marco' then ${n("MILE_PTS")}`);
    expect(premio).toContain(`when 'capitulo' then ${n("CH_PTS")}`);
  });

  it("a % do pilar é a do protótipo: Glow/160 (Conectar: 4% por dica de 5 Glow = /125), até 100%", () => {
    expect(JS).toContain(
      "S.pil[A.pil] = Math.min(1, S.pil[A.pil] + A.pts / 160)"
    );
    expect(JS).toContain("S.pil.connect = Math.min(1, S.pil.connect + .04)");
    const pct = corpo("private.jornada_pilar_pct");
    expect(pct).toContain("least(100, round(");
    expect(pct).toContain("case p_pilar when 'conectar' then 125 else 160 end");
  });
});

// ---------------------------------------------------------------------------
// 2. O que o estado manda
// ---------------------------------------------------------------------------

describe("0036 — o estado manda o que o protótipo mostra", () => {
  const estado = corpo("private.jornada_estado_de");

  it.each([
    ["semana", "'semana', jsonb_build_object('dias'"],
    ["glowPorAcao", "'glowPorAcao', ("],
    ["premios", "'premios', jsonb_build_object("],
    ["selosProgresso", "'selosProgresso', ("],
    ["dinheiro", "'dinheiro', jsonb_build_object("],
    ["pilares", "'pilares', jsonb_build_object("],
    ["comeco", "'comeco', jsonb_build_object('passos'"],
  ])("%s", (_nome, trecho) => {
    expect(estado).toContain(trecho);
  });

  it("a tabela de Glow sai da regra (jornada_regra), não de número escrito", () => {
    expect(estado).toMatch(
      /cross join lateral private\.jornada_regra\(a\.acao\) r/
    );
    expect(estado).toContain(
      "'glow', r.glow, 'limite', r.limite, 'pilar', r.pilar"
    );
  });

  it("o próximo corte de cada selo sai de jornada_selos_def e o contador de jornada_total", () => {
    expect(estado).toContain(
      "'contador', private.jornada_total(p_user, d.fonte)"
    );
    expect(estado).toContain(
      "when 0 then d.n1 when 1 then d.n2 when 2 then d.n3 else null end"
    );
    expect(estado).toContain("from private.jornada_selos_def() d");
  });

  it("o dinheiro sai da Wishlist dela: meta mais antiga em aberto, total, concluídas", () => {
    expect(estado).toMatch(
      /w\.valor_alvo > 0 and w\.valor_atual < w\.valor_alvo\s+order by w\.criado_em, w\.id\s+limit 1/
    );
    expect(estado).toContain(
      "select sum(w.valor_atual) from public.rede_wishlist_items w"
    );
    expect(estado).toContain(
      "w.valor_alvo > 0 and w.valor_atual >= w.valor_alvo"
    );
  });

  it("as preferências da folha de Ajustes do protótipo", () => {
    for (const k of [
      "estagioNoPerfil",
      "selosNoPerfil",
      "comemoracoesCalmas",
      "jornadaComeco",
    ])
      expect(estado).toContain(`'${k}'`);
    expect(SQL).toContain(
      "add column if not exists comemoracoes_calmas boolean not null default false"
    );
  });

  it("a comemoração de meta leva nome, valor e a próxima", () => {
    const motor = corpo("private.jornada_aplicar");
    expect(motor).toContain(
      "'item_id', v_item.id, 'nome', v_item.nome, 'valor', v_item.valor_alvo,"
    );
    expect(motor).toContain("'proxima', (");
  });
});

// ---------------------------------------------------------------------------
// 3. A marca da semana: só a corrente, só a marca
// ---------------------------------------------------------------------------

describe("0036 — o ritmo da semana guarda só a marca da semana corrente", () => {
  it("a tabela tem só usuária, dia e marca (forte | descanso)", () => {
    const tabela = SQL.slice(
      SQL.indexOf("create table if not exists public.jornada_semana_dias ("),
      SQL.indexOf(
        ");",
        SQL.indexOf("create table if not exists public.jornada_semana_dias (")
      )
    );
    const colunas = [...tabela.matchAll(/^\s{2}([a-z_]+) /gm)].map((m) => m[1]);
    expect(colunas).toEqual(["user_id", "dia", "marca", "primary"]);
    expect(tabela).toContain("check (marca in ('forte', 'descanso'))");
  });

  it("a semana virou, as marcas da anterior saem", () => {
    expect(corpo("private.jornada_aplicar")).toMatch(
      /delete from public\.jornada_semana_dias d\s+where d\.user_id = p_user and d\.dia < v_semana;/
    );
  });

  it("dia forte marca forte (por cima do descanso); descanso não apaga um dia forte", () => {
    const motor = corpo("private.jornada_aplicar");
    expect(motor).toMatch(
      /values \(p_user, p_hoje, 'forte'\)\s+on conflict \(user_id, dia\) do update set marca = 'forte';/
    );
    expect(motor).toMatch(
      /values \(p_user, p_hoje, 'descanso'\)\s+on conflict \(user_id, dia\) do nothing;/
    );
  });

  it("RLS ligada, a dona só lê; ninguém escreve direto", () => {
    expect(SQL).toContain(
      "alter table public.jornada_semana_dias enable row level security;"
    );
    expect(SQL).toContain(
      "revoke all on table public.jornada_semana_dias from anon, authenticated, service_role;"
    );
    expect(SQL).toContain(
      "grant select on table public.jornada_semana_dias to authenticated;"
    );
    expect(SQL).toContain("using (auth.uid() = user_id);");
  });
});

// ---------------------------------------------------------------------------
// 4. O laboratório = a foto "Agora"
// ---------------------------------------------------------------------------

describe('0036 — o laboratório produz a foto "Agora" do protótipo', () => {
  const fresh = JS.slice(
    JS.indexOf("function fresh()"),
    JS.indexOf("S = fresh();")
  );
  const e = estadoJornadaExemplo(new Date(2026, 9, 2, 10, 0));

  it("os três estados são válidos pro cliente", () => {
    expect(ehEstadoJornada(e)).toBe(true);
    expect(ehEstadoJornada(estadoJornadaContaNova())).toBe(true);
    expect(ehEstadoJornada(estadoJornadaAno(new Date(2027, 11, 3)))).toBe(true);
  });

  it("a semana: ['strong', 'rest', 'strong', null, …]", () => {
    expect(fresh).toContain(
      "week:['strong', 'rest', 'strong', null, null, null, null]"
    );
    expect(e.semana?.dias).toEqual([
      "forte",
      "descanso",
      "forte",
      null,
      null,
      null,
      null,
    ]);
  });

  it("os pilares: 72%, 38%, 55%, 46%", () => {
    expect(fresh).toContain(
      "pil:{ organize:.72, prosper:.38, protect:.55, connect:.46 }"
    );
    expect(e.pilares).toEqual({
      organizar: 72,
      prosperar: 38,
      proteger: 55,
      conectar: 46,
    });
  });

  it("o dinheiro: Fundo Viagem, 120 de 300, 120 guardados, 0 metas", () => {
    expect(JS).toContain("var GOALS = [['Fundo Viagem', 300]");
    expect(fresh).toContain(
      "goalIdx:0, goalHave:120, goalsDone:0, miles:{}, saved:120"
    );
    expect(e.dinheiro).toEqual({
      meta: { nome: "Fundo Viagem", alvo: 300, atual: 120 },
      totalGuardado: 120,
      metasConcluidas: 0,
    });
  });

  it("Jornada de Começo: os 2 primeiros passos feitos, desligada", () => {
    expect(fresh).toContain("starterDone:[1, 1, 0, 0, 0, 0, 0]");
    expect(e.comeco?.passos).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(e.preferencias.jornadaComeco).toBe(false);
  });

  it("o Glow de cada ação e os prêmios = os do protótipo (ACTIONS, *_PTS, TIER_PTS)", () => {
    expect(JS).toContain("var TIER_PTS = [20, 30, 50];");
    expect(e.premios).toEqual({
      capitulo: 40,
      meta: 100,
      marco: 50,
      seloNivel: [20, 30, 50],
    });
    for (const [chave, acao] of [
      ["expense", "despesa"],
      ["plan", "planejar"],
      ["save", "guardar_meta"],
      ["vault", "comprovante_cofre"],
      ["rest", "descanso"],
    ] as const) {
      const m = JS.match(
        new RegExp(`${chave}:\\{[^}]*pts:(\\d+)[^}]*cap:(\\d+)`)
      )!;
      expect(e.glowPorAcao?.[acao], acao).toMatchObject({
        glow: Number(m[1]),
        limite: Number(m[2]),
      });
    }
  });
});
