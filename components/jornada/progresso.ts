import type {
  Capitulo,
  EstadoJornada,
  MesDaColecao,
} from "@/lib/jornada/estado";

/**
 * Leituras do estado pras telas da Jornada (J12, #162). Nada aqui decide
 * Glow: só lê o que o servidor mandou (o estágio já vem com os cortes
 * prontos em `glowInicioEstagio`/`glowProximoEstagio`) e calcula o que é
 * calendário (dias que faltam no mês, meses da coleção).
 */

function entre(min: number, valor: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

/** Quanto do estágio atual ela já andou (de 0 a 1). */
export function fracaoDoEstagio(estado: EstadoJornada): number {
  const andado = estado.glowTotal - estado.glowInicioEstagio;
  const tamanho = estado.glowProximoEstagio - estado.glowInicioEstagio;
  return tamanho > 0 ? entre(0, andado / tamanho, 1) : 0;
}

/** Quanto falta pro próximo estágio (nunca negativo). */
export function faltaProProximo(estado: EstadoJornada): number {
  return Math.max(0, estado.glowProximoEstagio - estado.glowTotal);
}

/** Contador da semana corrente (J09 `jornada_periodos`), 0 se não houver. */
export function contadorDaSemana(estado: EstadoJornada, chave: string): number {
  return estado.periodos.semana.atual?.contadores[chave] ?? 0;
}

/** Missões já cumpridas no capítulo. */
export function missoesFeitas(capitulo: Capitulo): number {
  return capitulo.missoes.filter((m) => m.progresso >= m.alvo).length;
}

/** Dias que faltam pro capítulo acabar (0 no último dia; 0 fora do mês). */
export function diasRestantes(capitulo: Capitulo, hoje: Date): number {
  if (
    hoje.getFullYear() !== capitulo.ano ||
    hoje.getMonth() + 1 !== capitulo.mes
  ) {
    return 0;
  }
  const ultimoDia = new Date(capitulo.ano, capitulo.mes, 0).getDate();
  return Math.max(0, ultimoDia - hoje.getDate());
}

export type SituacaoDoMes = "fechado" | "branco" | "atual";

export interface MesNaColecao extends MesDaColecao {
  situacao: SituacaoDoMes;
}

const MESES_NO_ANO = 12;

function indice(m: MesDaColecao): number {
  return m.ano * MESES_NO_ANO + (m.mes - 1);
}

/**
 * Os meses da coleção, do mais antigo ao atual: os fechados (com enfeite),
 * os que ficaram em branco desde o início dela (tracejados, sem culpa) e o
 * mês corrente ainda em aberto. Conta nova: só o mês corrente.
 */
export function mesesDaColecao(
  estado: EstadoJornada,
  hoje: Date
): MesNaColecao[] {
  const atual: MesDaColecao = estado.capitulo
    ? { ano: estado.capitulo.ano, mes: estado.capitulo.mes }
    : { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const fechados = new Set(estado.colecao.map(indice));
  const primeiro = Math.min(
    estado.inicio ? indice(estado.inicio) : indice(atual),
    ...estado.colecao.map(indice)
  );
  const meses: MesNaColecao[] = [];
  for (let i = primeiro; i <= indice(atual); i++) {
    const mes: MesDaColecao = {
      ano: Math.floor(i / MESES_NO_ANO),
      mes: (i % MESES_NO_ANO) + 1,
    };
    const situacao: SituacaoDoMes = fechados.has(i)
      ? "fechado"
      : i === indice(atual)
        ? "atual"
        : "branco";
    meses.push({ ...mes, situacao });
  }
  return meses;
}
