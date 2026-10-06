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
 * As 9 ações que o app registra (spec, §3). As chaves batem com as da J09
 * (`jornada_acoes.acao`, migration 0034). `atendimento` existe e não dá
 * Glow (decisão 1). Concluir uma meta NÃO é ação do cliente: é prêmio de uma
 * vez que o servidor decide sozinho a partir das metas dela (§3, §7).
 */
export const ACOES = [
  "despesa",
  "receita",
  "planejar",
  "guardar_meta",
  "comprovante_cofre",
  "descanso",
  "dica_ajudou",
  "dica_protegeu",
  "atendimento",
] as const;
export type Acao = (typeof ACOES)[number];

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
