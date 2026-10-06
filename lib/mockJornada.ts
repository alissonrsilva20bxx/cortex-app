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
  EstadoJornada,
  MesDaColecao,
  Missao,
  Periodos,
  TipoMissao,
  TransporteJornada,
} from "@/lib/jornada/estado";

/** As trincas da spec §6, mês a mês (1 = janeiro). */
const TRINCAS: Record<number, [TipoMissao, number][]> = {
  1: [
    ["planejar_dias", 8],
    ["lancar_despesas", 10],
    ["tirar_descansos", 2],
  ],
  2: [
    ["guardar_semanas", 3],
    ["comprovantes_cofre", 4],
    ["dica_ajudou", 2],
  ],
  3: [
    ["planejar_dias", 6],
    ["dias_fortes", 10],
    ["comprovantes_cofre", 3],
  ],
  4: [
    ["guardar_semanas", 4],
    ["lancar_despesas", 12],
    ["tirar_descansos", 2],
  ],
  5: [
    ["comprovantes_cofre", 5],
    ["planejar_dias", 8],
    ["dica_protegeu", 1],
  ],
  6: [
    ["tirar_descansos", 3],
    ["guardar_semanas", 3],
    ["semanas_firmes", 2],
  ],
  7: [
    ["lancar_despesas", 10],
    ["planejar_dias", 6],
    ["dias_fortes", 12],
  ],
  8: [
    ["guardar_semanas", 4],
    ["comprovantes_cofre", 5],
    ["tirar_descansos", 2],
  ],
  9: [
    ["planejar_dias", 8],
    ["semanas_firmes", 3],
    ["dica_ajudou", 3],
  ],
  10: [
    ["tirar_descansos", 3],
    ["lancar_despesas", 12],
    ["comprovantes_cofre", 4],
  ],
  11: [
    ["guardar_semanas", 4],
    ["planejar_dias", 6],
    ["dias_fortes", 10],
  ],
  12: [
    ["tirar_descansos", 3],
    ["guardar_semanas", 2],
    ["dica_ajudou_ou_protegeu", 2],
  ],
};

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

function capitulo(agora: Date, progresso: number[]): Capitulo {
  const mes = agora.getMonth() + 1;
  const missoes: Missao[] = TRINCAS[mes].map(([tipo, alvo], i) => ({
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
  semanaFechada: Record<string, number> | null
): Periodos {
  const primeiroDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const primeiroDoAno = new Date(agora.getFullYear(), 0, 1);
  const semanaPassada = segunda(agora);
  semanaPassada.setDate(semanaPassada.getDate() - 7);
  return {
    corrente: {
      semana: { inicio: iso(segunda(agora)), contadores: semana ?? {} },
      mes: { inicio: iso(primeiroDoMes), contadores: semana ?? {} },
      ano: { inicio: iso(primeiroDoAno), contadores: semana ?? {} },
    },
    ultimoFechado: semanaFechada
      ? { semana: { inicio: iso(semanaPassada), contadores: semanaFechada } }
      : {},
  };
}

/** Uma usuária com algumas semanas de Jornada. */
export function estadoJornadaExemplo(agora: Date = new Date()): EstadoJornada {
  return {
    glowTotal: 305,
    glowPorPilar: { organizar: 140, prosperar: 60, proteger: 70, conectar: 35 },
    estagio: 1,
    glowInicioEstagio: 100,
    glowProximoEstagio: 400,
    selos: {
      primeiros_passos: 1,
      planejadora: 1,
      mao_amiga: 1,
      tudo_guardado: 1,
    },
    capitulo: capitulo(agora, [2, 5, 1]),
    // Um mês fechado na coleção, o seguinte em branco e o atual em aberto.
    colecao: [mesAntes(agora, 2)],
    marcos: [500],
    ajudou: 14,
    protegeu: 4,
    preferencias: {
      somLigado: true,
      modoDiscreto: false,
      mostrarNoPerfil: false,
    },
    hoje: iso(agora),
    destravados: [],
    periodos: periodos(
      agora,
      { dias_fortes: 2, despesa: 4, glow: 45 },
      { dias_fortes: 3, despesa: 6, glow: 80 }
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
    preferencias: {
      somLigado: true,
      modoDiscreto: false,
      mostrarNoPerfil: false,
    },
    hoje: iso(agora),
    destravados: [],
    periodos: periodos(agora, null, null),
  };
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
    async registrar() {
      return { estado, comemoracoes: [] };
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
