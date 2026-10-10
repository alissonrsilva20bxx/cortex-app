/**
 * Dados de laboratório da "Sua Jornada" — SÓ pro `/dev-preview/app`, que
 * não tem servidor (mesmo papel de `lib/mockAppData.ts` e `lib/mockRede.ts`).
 * O app de verdade nunca importa isto.
 *
 * Fica FORA de `lib/jornada/` de propósito: lá, o teste de contrato
 * (`tests/jornada/contrato.test.ts`) proíbe qualquer número de Glow, e estes
 * são números de exemplo, não regra. Nenhum texto visível aqui: só chaves.
 *
 * Dois estados:
 *  - `estadoJornadaExemplo`: uma usuária com algumas semanas de Jornada
 *    (Em movimento, alguns selos, um mês fechado e um em branco na coleção);
 *  - `estadoJornadaContaNova`: tudo zero — Glow, selos, coleção, marcos.
 *
 * O transporte de laboratório devolve o estado como está: ele NÃO é o motor
 * (isso é a J10). Registrar uma ação no laboratório não muda Glow nem gera
 * comemoração; gravar preferências funciona (fica em memória).
 */

import type {
  Capitulo,
  Comemoracao,
  ProgressoDoSelo,
  SeloId,
  EstadoJornada,
  MesDaColecao,
  Missao,
  Periodos,
  TipoMissao,
  TransporteJornada,
} from "@/lib/jornada/estado";

/** As 3 trincas de missões (0036, as do protótipo, CH_SETS), por mês % 3:
 * igual a private.jornada_missoes. */
const TRINCAS: [TipoMissao, number][][] = [
  [
    ["planejar_dias", 8],
    ["guardar_semanas", 3],
    ["tirar_descansos", 2],
  ],
  [
    ["comprovantes_cofre", 4],
    ["lancar_despesas", 10],
    ["dias_fortes", 12],
  ],
  [
    ["guardar_semanas", 4],
    ["planejar_dias", 6],
    ["dica_ajudou", 3],
  ],
];

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Segunda-feira da semana de `d` (spec §2: a semana começa na segunda). */
function segunda(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

/** O mês `n` meses antes de `agora` (n = 0 é o mês atual). */
function mesAntes(agora: Date, n: number): MesDaColecao {
  const d = new Date(agora.getFullYear(), agora.getMonth() - n, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

function capitulo(
  agora: Date,
  progresso: number[],
  trinca: [TipoMissao, number][] = TRINCAS[agora.getMonth() % 3]
): Capitulo {
  const mes = agora.getMonth() + 1;
  const missoes: Missao[] = trinca.map(([tipo, alvo], i) => ({
    tipo,
    alvo,
    progresso: Math.min(progresso[i] ?? 0, alvo),
  }));
  return {
    ano: agora.getFullYear(),
    mes,
    missoes,
    fechado: missoes.every((m) => m.progresso >= m.alvo),
  };
}

function periodos(
  agora: Date,
  semana: Record<string, number> | null,
  semanaFechada: Record<string, number> | null,
  mes: Record<string, number> | null = null,
  ano: Record<string, number> | null = null
): Periodos {
  const primeiroDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  // A semana pode começar no mês anterior (sexta 02/10 do protótipo: semana
  // de 28/09, com mais Glow que outubro). Quando ela começa dentro do mês,
  // o mês contém a semana: nenhum contador do mês fica menor.
  if (mes && semana && segunda(agora) >= primeiroDoMes)
    for (const [k, v] of Object.entries(semana))
      mes = { ...mes, [k]: Math.max(mes[k] ?? 0, v) };
  const primeiroDoAno = new Date(agora.getFullYear(), 0, 1);
  const semanaPassada = segunda(agora);
  semanaPassada.setDate(semanaPassada.getDate() - 7);
  return {
    corrente: {
      semana: { inicio: iso(segunda(agora)), contadores: semana ?? {} },
      // Cada período com os próprios números (#200): o mês contém a semana
      // e o ano contém o mês.
      mes: { inicio: iso(primeiroDoMes), contadores: mes ?? {} },
      ano: { inicio: iso(primeiroDoAno), contadores: ano ?? {} },
    },
    ultimoFechado: semanaFechada
      ? { semana: { inicio: iso(semanaPassada), contadores: semanaFechada } }
      : {},
  };
}

/** As preferências da foto "Agora": tudo opt-in desligado, som ligado. */
/** A usuária do protótipo ("Oi, Bella"): o nome do laboratório da Jornada
 * em `?jornada=agora` e `?jornada=ano` (as outras telas seguem com a
 * usuária dos mockups delas). */
export const NOME_DO_PROTOTIPO = "Bella";

const PREFERENCIAS_DO_PROTOTIPO = {
  somLigado: true,
  modoDiscreto: false,
  mostrarNoPerfil: false,
  estagioNoPerfil: false,
  selosNoPerfil: false,
  comemoracoesCalmas: false,
  jornadaComeco: false,
};

/** O que o servidor manda igual pra toda usuária (a regra, 0035/0036). */
const DO_SERVIDOR: Pick<EstadoJornada, "glowPorAcao" | "premios"> = {
  glowPorAcao: {
    planejar: { glow: 5, limite: 1, pilar: "organizar" },
    despesa: { glow: 5, limite: 3, pilar: "organizar" },
    receita: { glow: 5, limite: 3, pilar: "organizar" },
    guardar_meta: { glow: 15, limite: 1, pilar: "prosperar" },
    comprovante_cofre: { glow: 10, limite: 3, pilar: "proteger" },
    descanso: { glow: 10, limite: 1, pilar: "proteger" },
    dica_ajudou: { glow: 5, limite: 5, pilar: "conectar" },
    dica_protegeu: { glow: 5, limite: 5, pilar: "conectar" },
  },
  premios: { capitulo: 40, meta: 100, marco: 50, seloNivel: [20, 30, 50] },
};

/** Os cortes de cada selo (0035 `jornada_selos_def`): o laboratório monta o
 * "próximo nível" igual o servidor. */
const CORTES: Record<SeloId, number[]> = {
  primeiros_passos: [1],
  planejadora: [1, 10, 50],
  mao_amiga: [1, 25, 100],
  semana_firme: [1, 4, 12],
  rumo_a_meta: [1, 10, 50],
  tudo_guardado: [1, 20, 100],
  descansar_conta: [1, 8, 24],
  guardia: [5, 25, 100],
  em_casa: [1],
  mes_a_mes: [1, 3, 6],
  um_ano: [1],
};

function progressoDosSelos(
  contadores: Partial<Record<SeloId, number>>
): Record<SeloId, ProgressoDoSelo> {
  const out = {} as Record<SeloId, ProgressoDoSelo>;
  for (const selo of Object.keys(CORTES) as SeloId[]) {
    const contador = contadores[selo] ?? 0;
    const nivel = CORTES[selo].filter((c) => contador >= c).length;
    out[selo] = { contador, proximo: CORTES[selo][nivel] ?? null };
  }
  return out;
}

/**
 * A usuária de exemplo = a foto "Agora" do protótipo aprovado
 * (docs/jornada/referencias/prototipo-sua-jornada.html, `fresh()`): 305
 * Glow, Em movimento, o capítulo do mês com 2/8, 1/3 e 0/2, coleção vazia,
 * nenhum marco, os selos que o contador dela dá (Primeiros passos,
 * Planejadora e Mão amiga), 14 "me ajudou" e 4 "me protegeu". Semana com 2
 * dias fortes e 85 Glow; mês com 2 dias fortes e 40 Glow.
 */
export function estadoJornadaExemplo(agora: Date = new Date()): EstadoJornada {
  return {
    glowTotal: 305,
    // O Glow de cada pilar que dá, pela regra do servidor (0036), as
    // porcentagens da foto: 72%, 38%, 55% e 46%. A foto do protótipo não
    // fecha a soma com o total (305); o servidor de verdade também não
    // fecha quando há prêmio de capítulo (Glow sem pilar).
    glowPorPilar: { organizar: 115, prosperar: 61, proteger: 88, conectar: 57 },
    estagio: 1,
    glowInicioEstagio: 100,
    glowProximoEstagio: 400,
    selos: {
      primeiros_passos: 1,
      planejadora: 1,
      mao_amiga: 1,
    },
    capitulo: capitulo(agora, [2, 1, 0], TRINCAS[agora.getMonth() % 3]),
    colecao: [],
    marcos: [],
    ajudou: 14,
    protegeu: 4,
    preferencias: { ...PREFERENCIAS_DO_PROTOTIPO },
    hoje: iso(agora),
    // Nada feito hoje ainda: S.done = {} no protótipo.
    feitasHoje: {},
    destravados: [],
    ...DO_SERVIDOR,
    // week:['strong', 'rest', 'strong', null, null, null, null]
    semana: { dias: ["forte", "descanso", "forte", null, null, null, null] },
    selosProgresso: progressoDosSelos({
      primeiros_passos: 1,
      planejadora: 3,
      mao_amiga: 14,
      guardia: 4,
    }),
    dinheiro: {
      meta: { nome: "Fundo Viagem", alvo: 300, atual: 120 },
      totalGuardado: 120,
      metasConcluidas: 0,
    },
    pilares: { organizar: 72, prosperar: 38, proteger: 55, conectar: 46 },
    // starterDone:[1, 1, 0, 0, 0, 0, 0]
    comeco: { passos: [true, true, false, false, false, false, false] },
    periodos: periodos(
      agora,
      { dias_fortes: 2, despesa: 2, planejar: 1, glow: 85 },
      { dias_fortes: 3, despesa: 6, firme: 1, glow: 80 },
      // Mês: bate com o capítulo (2 dias planejados, 1 semana guardando).
      {
        dias_fortes: 2,
        despesa: 2,
        planejar: 2,
        semanas_guardou: 1,
        glow: 40,
      },
      // Ano: tudo desde o começo dela (o Glow do ano = o total).
      {
        dias_fortes: 9,
        despesa: 12,
        receita: 4,
        planejar: 3,
        descanso: 2,
        dica_ajudou: 14,
        dica_protegeu: 4,
        semanas_guardou: 1,
        glow: 305,
      }
    ),
  };
}

/**
 * A foto "Mês 14" do protótipo (`SNAPS.m14`): o que o resumo do ANO mostra.
 * 03/12/2027, 5.220 Glow (Icônica II), 11 enfeites e 3 meses em branco
 * (dezembro/26, março/27, agosto/27), 103 "me ajudou", 27 "me protegeu".
 * Abre com `/dev-preview/app?jornada=ano`.
 */
export function estadoJornadaAno(agora: Date = new Date()): EstadoJornada {
  const brancos = new Set(["2026-12", "2027-3", "2027-8"]);
  const colecao: MesDaColecao[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(2026, 9 + i, 1);
    const chave = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!brancos.has(chave))
      colecao.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return {
    ...estadoJornadaExemplo(agora),
    glowTotal: 5220,
    glowPorPilar: {
      organizar: 1900,
      prosperar: 1500,
      proteger: 1100,
      conectar: 720,
    },
    estagio: 5,
    glowInicioEstagio: 4500,
    glowProximoEstagio: 6000,
    selos: {
      primeiros_passos: 1,
      planejadora: 3,
      mao_amiga: 3,
      semana_firme: 3,
      rumo_a_meta: 3,
      tudo_guardado: 3,
      descansar_conta: 3,
      guardia: 2,
      em_casa: 1,
      mes_a_mes: 3,
      um_ano: 1,
    },
    selosProgresso: progressoDosSelos({
      primeiros_passos: 1,
      planejadora: 118,
      mao_amiga: 103,
      semana_firme: 31,
      rumo_a_meta: 104,
      tudo_guardado: 121,
      descansar_conta: 30,
      guardia: 27,
      em_casa: 1,
      mes_a_mes: 14,
      um_ano: 1,
    }),
    // WK = ['strong', 'rest', 'strong', 'strong', null, null, null]
    semana: { dias: ["forte", "descanso", "forte", "forte", null, null, null] },
    dinheiro: {
      meta: { nome: "Entrada do apartamento", alvo: 5000, atual: 900 },
      totalGuardado: 4200,
      metasConcluidas: 4,
    },
    pilares: { organizar: 90, prosperar: 84, proteger: 78, conectar: 80 },
    capitulo: capitulo(agora, [1, 2, 1], TRINCAS[agora.getMonth() % 3]),
    colecao,
    marcos: [500, 1000, 2500],
    ajudou: 103,
    protegeu: 27,
    hoje: iso(agora),
    // Nada feito hoje ainda: S.done = {} no protótipo.
    feitasHoje: {},
    periodos: periodos(
      agora,
      { dias_fortes: 3, glow: 65 },
      null,
      { dias_fortes: 3, glow: 40 },
      {
        dias_fortes: 140,
        guardar_meta: 104,
        dica_ajudou: 103,
        dica_protegeu: 27,
        glow: 5220,
      }
    ),
  };
}

/** Conta nova: nada ainda (Glow zero, nenhum selo, coleção vazia). */
export function estadoJornadaContaNova(
  agora: Date = new Date()
): EstadoJornada {
  return {
    glowTotal: 0,
    glowPorPilar: { organizar: 0, prosperar: 0, proteger: 0, conectar: 0 },
    estagio: 0,
    glowInicioEstagio: 0,
    glowProximoEstagio: 100,
    selos: {},
    capitulo: capitulo(agora, []),
    colecao: [],
    marcos: [],
    ajudou: 0,
    protegeu: 0,
    preferencias: { ...PREFERENCIAS_DO_PROTOTIPO },
    hoje: iso(agora),
    // Nada feito hoje ainda: S.done = {} no protótipo.
    feitasHoje: {},
    destravados: [],
    ...DO_SERVIDOR,
    semana: { dias: [null, null, null, null, null, null, null] },
    selosProgresso: progressoDosSelos({}),
    dinheiro: { meta: null, totalGuardado: 0, metasConcluidas: 0 },
    pilares: { organizar: 0, prosperar: 0, proteger: 0, conectar: 0 },
    comeco: { passos: [false, false, false, false, false, false, false] },
    periodos: periodos(agora, null, null),
  };
}

/**
 * Comemorações que o PRÓXIMO registro do laboratório devolve (o servidor
 * de verdade decide isso; aqui é só pra ver cada comemoração na tela e
 * medir contra o protótipo). Usado por `window.__previewComemoracao` em
 * app/dev-preview/app/page.tsx.
 */
let comemoracoesDoLaboratorio: Comemoracao[] = [];
/** O que a ação preparada muda no estado (o que o servidor mandaria de
 * volta junto com as comemorações). */
let efeitoDoLaboratorio: ((e: EstadoJornada) => EstadoJornada) | null = null;

/** Soma `mais` aos contadores de um período. */
function somar(
  contadores: Record<string, number>,
  mais: Record<string, number>
): Record<string, number> {
  const out = { ...contadores };
  for (const [k, v] of Object.entries(mais)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/**
 * "Guardar numa meta" no laboratório, igual ao `act('save')` do demo do
 * protótipo: o dia de hoje vira forte (3 de 3 na semana), a semana conta
 * como semana guardando (missão do capítulo), a meta e o total ganham
 * € 10, o Prosperar sobe pela regra do servidor (Glow/160) e o selo Rumo à
 * meta I entra. O demo do protótipo não dá a semana firme nessa ação
 * (`noSteady`): o laboratório também não.
 */
function efeitoDeGuardar(e: EstadoJornada): EstadoJornada {
  const glowDaAcao = e.glowPorAcao?.guardar_meta?.glow ?? 0;
  const glowDoSelo = e.premios?.seloNivel[0] ?? 0;
  const ganho = glowDaAcao + glowDoSelo;
  const hoje = new Date(`${e.hoje}T12:00:00`);
  const dias = [...(e.semana?.dias ?? [])];
  const i = (hoje.getDay() + 6) % 7;
  const virouForte = dias[i] !== "forte";
  dias[i] = "forte";
  const fortes: Record<string, number> = virouForte ? { dias_fortes: 1 } : {};
  const c = e.periodos.corrente;
  const guardar = 10;
  const prosperar = e.glowPorPilar.prosperar + glowDaAcao;
  return {
    ...e,
    glowPorPilar: { ...e.glowPorPilar, prosperar },
    selos: { ...e.selos, rumo_a_meta: 1 },
    selosProgresso: {
      ...e.selosProgresso,
      rumo_a_meta: { contador: 1, proximo: CORTES.rumo_a_meta[1] },
    },
    semana: { dias },
    capitulo: e.capitulo && {
      ...e.capitulo,
      missoes: e.capitulo.missoes.map((m) =>
        m.tipo === "guardar_semanas"
          ? { ...m, progresso: Math.min(m.alvo, m.progresso + 1) }
          : m
      ),
    },
    dinheiro: e.dinheiro && {
      ...e.dinheiro,
      meta: e.dinheiro.meta && {
        ...e.dinheiro.meta,
        atual: e.dinheiro.meta.atual + guardar,
      },
      totalGuardado: e.dinheiro.totalGuardado + guardar,
    },
    // A % do Prosperar pela regra do servidor (0036): +Glow/160.
    pilares: e.pilares && {
      ...e.pilares,
      prosperar: Math.min(
        100,
        Math.round(e.pilares.prosperar + (glowDaAcao * 100) / 160)
      ),
    },
    periodos: {
      ...e.periodos,
      corrente: {
        semana: {
          ...c.semana,
          contadores: somar(c.semana.contadores, {
            ...fortes,
            guardar_meta: 1,
            semanas_guardou: 1,
            glow: ganho,
          }),
        },
        mes: {
          ...c.mes,
          contadores: somar(c.mes.contadores, {
            ...fortes,
            guardar_meta: 1,
            semanas_guardou: 1,
            glow: ganho,
          }),
        },
        ano: {
          ...c.ano,
          contadores: somar(c.ano.contadores, {
            ...fortes,
            guardar_meta: 1,
            semanas_guardou: 1,
            glow: ganho,
          }),
        },
      },
    },
  };
}
let contadorDoLaboratorio = 0;

export type DemoDeComemoracao = "selo" | "estagio" | "meta";

/** As mesmas sequências dos botões de demonstração do protótipo
 * (docs/jornada/referencias/prototipo-sua-jornada.html): a ação, depois o
 * que ela destrava, na ordem do servidor (pequena → selo → estágio → meta). */
export function prepararComemoracaoDeLaboratorio(demo: DemoDeComemoracao): {
  acao: "guardar_meta" | "planejar";
} {
  const id = () => `lab-${++contadorDoLaboratorio}`;
  efeitoDoLaboratorio = null;
  const pequena = (
    acao: "guardar_meta" | "planejar",
    glow: number
  ): Comemoracao => ({
    id: id(),
    tipo: "pequena",
    acao,
    glow,
    ganhou: true,
    pilar: acao === "planejar" ? "organizar" : "prosperar",
  });
  const rumoAMeta: Comemoracao = {
    id: id(),
    tipo: "selo",
    selo: "rumo_a_meta",
    nivel: 1,
    glow: 20,
    ganhou: true,
    pilar: "prosperar",
  };
  if (demo === "selo") {
    comemoracoesDoLaboratorio = [pequena("guardar_meta", 15), rumoAMeta];
    efeitoDoLaboratorio = efeitoDeGuardar;
    return { acao: "guardar_meta" };
  }
  if (demo === "estagio") {
    comemoracoesDoLaboratorio = [
      pequena("planejar", 5),
      {
        id: id(),
        tipo: "estagio",
        estagio: 2,
        de: 1,
        glow: 0,
        ganhou: true,
        itens: ["icone_estagio_2", "moldura_estagio_2", "tema_estagio_2"],
      },
    ];
    return { acao: "planejar" };
  }
  comemoracoesDoLaboratorio = [
    pequena("guardar_meta", 15),
    rumoAMeta,
    {
      id: id(),
      tipo: "meta",
      glow: 100,
      ganhou: true,
      pilar: "prosperar",
      nome: "Fundo Viagem",
      valor: 300,
      proxima: "Reserva de emergência",
    },
  ];
  return { acao: "guardar_meta" };
}

/** Transporte de laboratório: devolve o estado e grava preferências em memória. */
export function criarTransporteJornadaLaboratorio(
  inicial: EstadoJornada
): TransporteJornada {
  let estado = inicial;
  return {
    async lerEstado() {
      return estado;
    },
    async registrar(pedido) {
      // O que ela fez hoje (0038): conta a ação, até o limite do dia, para o
      // "Próximo passo" do card andar como no protótipo.
      const limite = estado.glowPorAcao?.[pedido.acao]?.limite;
      if (limite !== undefined) {
        const feitas = estado.feitasHoje?.[pedido.acao] ?? 0;
        estado = {
          ...estado,
          feitasHoje: {
            ...estado.feitasHoje,
            [pedido.acao]: Math.min(feitas + 1, limite),
          },
        };
      }
      const comemoracoes = comemoracoesDoLaboratorio;
      comemoracoesDoLaboratorio = [];
      // Só com uma comemoração preparada (__previewComemoracao): o Glow dela
      // entra no total, como no protótipo (305 → 340 com o selo). Sem nada
      // preparado, o laboratório não mexe no Glow (ele não é o motor).
      const ganho = comemoracoes.reduce((soma, c) => soma + c.glow, 0);
      if (ganho > 0)
        estado = { ...estado, glowTotal: estado.glowTotal + ganho };
      if (efeitoDoLaboratorio) estado = efeitoDoLaboratorio(estado);
      efeitoDoLaboratorio = null;
      return { estado, comemoracoes };
    },
    async salvarPreferencias(parcial) {
      estado = {
        ...estado,
        preferencias: { ...estado.preferencias, ...parcial },
      };
      return estado.preferencias;
    },
  };
}
