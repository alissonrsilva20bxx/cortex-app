/**
 * Tipos do estado da "Sua Jornada" (J11, #161) — o que o servidor (J10)
 * devolve e o que as telas (J12 em diante) recebem do `useJornada`.
 *
 * Só tipos e chaves. Nenhum número de Glow, limite ou corte de estágio:
 * quem decide tudo isso é o servidor (docs/jornada/spec-sua-jornada.md, §8,
 * "Onde a decisão acontece"). Nenhum texto visível: nomes, rótulos e moeda
 * moram em `lib/jornada/textos.ts`.
 */

/** Os 4 pilares (spec, decisão 3). */
export const PILARES = [
  "organizar",
  "prosperar",
  "proteger",
  "conectar",
] as const;
export type Pilar = (typeof PILARES)[number];

/**
 * As ações que o CLIENTE registra -- exatamente as que `jornada_registrar`
 * (J10, migration 0035) aceita; o teste de contrato trava as duas listas.
 * São as da §3 menos as duas de dica (ver `ACOES_DA_DICA`), mais
 * `abrir_jornada`: abrir a tela "Sua Jornada" é o contador do selo
 * "Primeiros passos" (§5) e não dá Glow. `atendimento` existe e não dá Glow
 * (decisão 1). Concluir uma meta NÃO é ação do cliente: é prêmio de uma vez
 * que o servidor decide sozinho a partir das metas dela (§3, §7).
 */
export const ACOES = [
  "despesa",
  "receita",
  "planejar",
  "guardar_meta",
  "comprovante_cofre",
  "descanso",
  "atendimento",
  "abrir_jornada",
] as const;
export type Acao = (typeof ACOES)[number];

/**
 * "Isso me ajudou" e "Isso me protegeu" (§3) são ações da spec, mas NÃO do
 * cliente: quem clica é outra pessoa e o Glow é da autora da dica. O
 * servidor credita a autora (`private.jornada_creditar_dica`, J10) e recusa
 * essas chaves em `jornada_registrar`. Ficam aqui só pra nomear os
 * contadores (`ajudou`, `protegeu`) e os textos.
 */
export const ACOES_DA_DICA = ["dica_ajudou", "dica_protegeu"] as const;
export type AcaoDaDica = (typeof ACOES_DA_DICA)[number];

/** Os 11 selos (spec, §5), com as chaves da J09 (`jornada_selos.selo`). */
export const SELOS = [
  "primeiros_passos",
  "planejadora",
  "mao_amiga",
  "semana_firme",
  "rumo_a_meta",
  "tudo_guardado",
  "descansar_conta",
  "guardia",
  "em_casa",
  "mes_a_mes",
  "um_ano",
] as const;
export type SeloId = (typeof SELOS)[number];
export type NivelSelo = 1 | 2 | 3;

/** Os tipos de missão do capítulo do mês (spec, §6). */
export const TIPOS_MISSAO = [
  "planejar_dias",
  "lancar_despesas",
  "tirar_descansos",
  "guardar_semanas",
  "comprovantes_cofre",
  "dias_fortes",
  "semanas_firmes",
  "dica_ajudou",
  "dica_protegeu",
  "dica_ajudou_ou_protegeu",
] as const;
export type TipoMissao = (typeof TIPOS_MISSAO)[number];

export interface Missao {
  tipo: TipoMissao;
  /** Quanto precisa (vem do servidor; o cliente não sabe a trinca do mês). */
  alvo: number;
  /** Quanto já fez neste mês. */
  progresso: number;
}

/** Capítulo do mês corrente (spec, §6). */
export interface Capitulo {
  ano: number;
  /** 1 a 12. */
  mes: number;
  missoes: Missao[];
  fechado: boolean;
}

/** Um mês fechado na coleção de enfeites. Mês em branco não aparece. */
export interface MesDaColecao {
  ano: number;
  mes: number;
}

/** Os marcos de dinheiro guardado (spec, §7). É chave, não Glow. */
export const MARCOS_DINHEIRO = [500, 1000, 2500, 5000] as const;
export type MarcoDinheiro = (typeof MARCOS_DINHEIRO)[number];

export interface Preferencias {
  somLigado: boolean;
  modoDiscreto: boolean;
  /** Estágio e selos no perfil público. Opt-in, desligado por padrão. */
  mostrarNoPerfil: boolean;
}

/** O estado inteiro da Jornada, como o servidor manda. */
export interface EstadoJornada {
  glowTotal: number;
  glowPorPilar: Record<Pilar, number>;
  /** 0 Começando, 1 Em movimento, 2 Organizada, 3 Prosperando, 4 Icônica, 5 Icônica II… */
  estagio: number;
  /** Glow total em que começa o próximo estágio (o servidor calcula). */
  glowProximoEstagio: number;
  selos: Partial<Record<SeloId, NivelSelo>>;
  capitulo: Capitulo | null;
  colecao: MesDaColecao[];
  marcos: MarcoDinheiro[];
  /** "Isso me ajudou" e "Isso me protegeu": visíveis só pra autora (decisão 12). */
  ajudou: number;
  protegeu: number;
  preferencias: Preferencias;
  /** Glow total em que começou o estágio atual (início da barra). */
  glowInicioEstagio?: number;
  /** Hoje no fuso dela, AAAA-MM-DD. */
  hoje?: string;
  /** Itens destravados por estágio (`moldura_estagio_N`, `icone_…`, `tema_…`). */
  destravados?: string[];
  /** Agregados do período corrente e do último fechado (resumos, J14). */
  periodos?: {
    corrente: Record<TipoPeriodo, Periodo>;
    ultimoFechado: Partial<Record<TipoPeriodo, Periodo>>;
  };
}

export type TipoPeriodo = "semana" | "mes" | "ano";

/** Só números agregados ("despesa": 12, "dias_fortes": 4…), nunca um diário. */
export interface Periodo {
  /** Primeiro dia do período (segunda-feira, dia 1, 1º de janeiro), AAAA-MM-DD. */
  inicio: string;
  contadores: Record<string, number>;
}

/**
 * O que comemorar. O servidor manda a fila já na ordem certa
 * (pequena → selo → estágio → meta, J10) e o cliente só toca.
 */
export const TIPOS_COMEMORACAO = [
  "pequena",
  "selo",
  "estagio",
  "capitulo",
  "marco",
  "meta",
] as const;
export type TipoComemoracao = (typeof TIPOS_COMEMORACAO)[number];

export interface Comemoracao {
  /** Id único do servidor: a fila nunca repete a mesma comemoração. */
  id: string;
  tipo: TipoComemoracao;
  /** Glow ganho por isto (0 quando passou do limite do dia). */
  glow: number;
  /** `false` = passou do limite: "a contagem segue", sem Glow. */
  ganhou: boolean;
  acao?: Acao;
  selo?: SeloId;
  nivel?: NivelSelo;
  estagio?: number;
  marco?: MarcoDinheiro;
  capitulo?: MesDaColecao;
  /** Comemoração grande que o servidor pediu pra deixar pra próxima abertura. */
  adiada?: boolean;
  /** Pilar que recebeu o Glow (pequena e selo). */
  pilar?: Pilar | null;
  /** No tipo "estagio": o estágio anterior e os itens destravados agora. */
  de?: number;
  itens?: string[];
}

/** O que o cliente manda a cada registro de ação. */
export interface PedidoRegistro {
  acao: Acao;
  /** Chave de idempotência: a mesma ação reenviada não conta duas vezes. */
  chave: string;
  /** Fuso IANA dela (ex.: "Europe/Lisbon"). */
  fuso: string;
  /** Deslocamento atual em minutos (UTC + x), pra servidor sem base de fusos. */
  deslocamentoMin: number;
}

export interface RespostaRegistro {
  estado: EstadoJornada;
  comemoracoes: Comemoracao[];
  /** A mesma chave já tinha chegado: nada contou de novo. */
  duplicada?: boolean;
}

/**
 * A ponte com o servidor. Em produção é o Supabase (`cliente.ts`); nos
 * testes, um falso. Nenhuma tela vê isto.
 */
export interface TransporteJornada {
  lerEstado(fuso: string, deslocamentoMin: number): Promise<EstadoJornada>;
  registrar(pedido: PedidoRegistro): Promise<RespostaRegistro>;
}

/** Códigos de erro (o texto de cada um está em `textos.ts`). */
export type ErroJornada = "sem-conexao" | "resposta-invalida";

// ─────────────────────────── validação ───────────────────────────

function ehNumero(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Confere uma resposta do servidor ou do disco antes de confiar nela. */
export function ehEstadoJornada(x: unknown): x is EstadoJornada {
  if (!ehObjeto(x)) return false;
  const p = x.glowPorPilar;
  const pr = x.preferencias;
  return (
    ehNumero(x.glowTotal) &&
    ehNumero(x.estagio) &&
    ehNumero(x.glowProximoEstagio) &&
    ehObjeto(p) &&
    PILARES.every((k) => ehNumero(p[k])) &&
    ehObjeto(x.selos) &&
    (x.capitulo === null || ehObjeto(x.capitulo)) &&
    Array.isArray(x.colecao) &&
    Array.isArray(x.marcos) &&
    ehNumero(x.ajudou) &&
    ehNumero(x.protegeu) &&
    ehObjeto(pr) &&
    typeof pr.somLigado === "boolean" &&
    typeof pr.modoDiscreto === "boolean" &&
    typeof pr.mostrarNoPerfil === "boolean"
  );
}

export function ehComemoracao(x: unknown): x is Comemoracao {
  return (
    ehObjeto(x) &&
    typeof x.id === "string" &&
    x.id.length > 0 &&
    (TIPOS_COMEMORACAO as readonly string[]).includes(x.tipo as string) &&
    ehNumero(x.glow) &&
    typeof x.ganhou === "boolean"
  );
}

export function ehPedidoRegistro(x: unknown): x is PedidoRegistro {
  return (
    ehObjeto(x) &&
    (ACOES as readonly string[]).includes(x.acao as string) &&
    typeof x.chave === "string" &&
    x.chave.length > 0 &&
    typeof x.fuso === "string" &&
    ehNumero(x.deslocamentoMin)
  );
}
