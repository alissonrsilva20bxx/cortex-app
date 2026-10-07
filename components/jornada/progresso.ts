import type {
  Capitulo,
  EstadoJornada,
  MarcaDoDia,
  MesDaColecao,
} from "@/lib/jornada/estado";
import {
  ORDEM_DO_PROXIMO_PASSO,
  type AcaoDoProximoPasso,
} from "@/lib/jornada/textos";

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
  return estado.periodos.corrente.semana.contadores[chave] ?? 0;
}

/**
 * O dia de hoje no fuso dela, como o servidor mandou (`hoje`, AAAA-MM-DD);
 * sem ele, o dia do aparelho.
 */
export function hojeDoEstado(estado: EstadoJornada, aparelho: Date): Date {
  const m = estado.hoje?.match(/^(\d+)-(\d+)-(\d+)$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : aparelho;
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
 * os que ficaram em branco depois do primeiro fechado (tracejados, sem
 * culpa) e o mês corrente ainda em aberto. Conta nova: só o mês corrente.
 * O servidor não manda o mês em que a Jornada começou, então os meses em
 * branco antes do primeiro enfeite não aparecem.
 */
export function mesesDaColecao(
  estado: EstadoJornada,
  hoje: Date
): MesNaColecao[] {
  const atual: MesDaColecao = estado.capitulo
    ? { ano: estado.capitulo.ano, mes: estado.capitulo.mes }
    : { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const fechados = new Set(estado.colecao.map(indice));
  const primeiro = Math.min(indice(atual), ...estado.colecao.map(indice));
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

/** As marcas da semana corrente (0036, `semana.dias`), de segunda a
 * domingo; sem o campo (servidor antigo), a semana vazia. */
export function marcasDaSemana(estado: EstadoJornada): MarcaDoDia[] {
  return estado.semana?.dias ?? [null, null, null, null, null, null, null];
}

/** Os dias fortes da semana: as marcas, ou o contador do período. */
export function diasFortesDaSemana(estado: EstadoJornada): number {
  if (estado.semana)
    return estado.semana.dias.filter((d) => d === "forte").length;
  return contadorDaSemana(estado, "dias_fortes");
}

/** O dia de hoje na semana (segunda = 0), como o `S.today` do protótipo. */
export function indiceDeHoje(hoje: Date): number {
  return (hoje.getDay() + 6) % 7;
}

/**
 * O "Próximo passo" do card do Início (protótipo: `nextKey()`): a primeira
 * ação de ORDEM_DO_PROXIMO_PASSO que ela ainda não fez hoje (`S.done`; quem
 * bateu o limite do dia também já fez). `null` = hoje ela já cuidou de
 * tudo. Lê `feitasHoje` do servidor (0038).
 */
export function proximoPasso(estado: EstadoJornada): AcaoDoProximoPasso | null {
  for (const acao of ORDEM_DO_PROXIMO_PASSO)
    if (!estado.feitasHoje?.[acao]) return acao;
  return null;
}

/** Índice de hoje na semana do card (0 = segunda ... 6 = domingo). */
export function indiceDeHojeNaSemana(estado: EstadoJornada): number {
  const d = new Date(`${estado.hoje ?? ""}T00:00:00`);
  const dia = Number.isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
  return (dia + 6) % 7;
}

/** Para onde o "Próximo passo" leva: a aba (e a sub-aba do Financeiro)
 * onde ela faz aquela ação no app. */
export function destinoDoProximoPasso(acao: AcaoDoProximoPasso): {
  aba: "financeiro" | "cofre" | "jobs";
  financeiro?: "metas" | "saidas";
} {
  if (acao === "guardar_meta")
    return { aba: "financeiro", financeiro: "metas" };
  if (acao === "despesa") return { aba: "financeiro", financeiro: "saidas" };
  if (acao === "comprovante_cofre") return { aba: "cofre" };
  return { aba: "jobs" };
}
