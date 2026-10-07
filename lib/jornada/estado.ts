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
  // Jornada de Começo (0036, ordem do operador): só contam o passo, sem Glow.
  "criar_pin",
  "ver_resumo",
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
  /** Estágio OU selos no perfil público (os dois opt-ins abaixo). */
  mostrarNoPerfil: boolean;
  /** Folha de Ajustes do protótipo (0036). Todos opt-in, desligados. */
  estagioNoPerfil?: boolean;
  selosNoPerfil?: boolean;
  /** "Comemorações: Calma" -- só confirmações pequenas e silenciosas. */
  comemoracoesCalmas?: boolean;
  /** Jornada de Começo: os 7 passos da primeira semana. */
  jornadaComeco?: boolean;
}

/** A marca de um dia da semana corrente (0036): forte, descanso ou nada. */
export type MarcaDoDia = "forte" | "descanso" | null;

/** Glow, limite do dia e pilar de uma ação (a regra do servidor, §3). */
export interface RegraDaAcao {
  glow: number;
  limite: number;
  pilar: Pilar | null;
}

/** Os prêmios de uma vez (§3) e o Glow de cada nível de selo (§5). */
export interface Premios {
  capitulo: number;
  meta: number;
  marco: number;
  seloNivel: number[];
}

/** O contador de um selo e o corte do próximo nível (null = nível máximo). */
export interface ProgressoDoSelo {
  contador: number;
  proximo: number | null;
}

/** A meta de dinheiro em aberto (a mais antiga da Wishlist dela). */
export interface MetaDeDinheiro {
  nome: string;
  alvo: number;
  atual: number;
}

export interface Dinheiro {
  meta: MetaDeDinheiro | null;
  totalGuardado: number;
  metasConcluidas: number;
}

/** Os tipos de período (spec §8; J09 `jornada_periodos.tipo`). */
export const TIPOS_PERIODO = ["semana", "mes", "ano"] as const;
export type TipoPeriodo = (typeof TIPOS_PERIODO)[number];

/**
 * Agregado de um período (J09 `jornada_periodos`): o primeiro dia (no fuso
 * dela; a semana começa na segunda) e um mapa chave → número ("despesa": 12,
 * "dias_fortes": 4, "glow": 85...). EXATAMENTE estes dois campos: nunca uma
 * lista de dias nem nada que reconstrua o dia a dia (decisão 16). O teste de
 * contrato trava esta forma, e a validação recusa campo a mais.
 */
export interface Periodo {
  /** "AAAA-MM-DD". */
  inicio: string;
  contadores: Record<string, number>;
}

/**
 * Os agregados como o servidor manda (`jornada_estado`, J10): o período
 * corrente de cada tipo e o último fechado, quando já houver um.
 */
export interface Periodos {
  corrente: Record<TipoPeriodo, Periodo>;
  ultimoFechado: Partial<Record<TipoPeriodo, Periodo>>;
}

/** O estado inteiro da Jornada, como o servidor manda (`jornada_estado`, J10). */
export interface EstadoJornada {
  glowTotal: number;
  glowPorPilar: Record<Pilar, number>;
  /** 0 Começando, 1 Em movimento, 2 Organizada, 3 Prosperando, 4 Icônica, 5 Icônica II… */
  estagio: number;
  /** Glow total em que o estágio atual começou (o servidor calcula). */
  glowInicioEstagio: number;
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
  /** Hoje no fuso dela, AAAA-MM-DD. */
  hoje?: string;
  /** Itens destravados por estágio (`moldura_estagio_N`, `icone_…`, `tema_…`). */
  destravados?: string[];
  /** Agregados da semana, do mês e do ano (J09 `jornada_periodos`). */
  periodos: Periodos;
  // ── O que o protótipo mostra (0036, ordem do operador) ──
  /** A marca de cada dia (segunda a domingo) da semana CORRENTE. */
  semana?: { dias: MarcaDoDia[] };
  /** A tabela "O que dá Glow": a regra de cada ação. */
  glowPorAcao?: Partial<Record<Acao | AcaoDaDica, RegraDaAcao>>;
  premios?: Premios;
  /** O "3/10" de cada selo. */
  selosProgresso?: Partial<Record<SeloId, ProgressoDoSelo>>;
  dinheiro?: Dinheiro;
  /** A porcentagem de cada pilar (0 a 100), pela regra do protótipo. */
  pilares?: Record<Pilar, number>;
  /** Jornada de Começo: os 7 passos, feitos ou não. */
  comeco?: { passos: boolean[] };
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
  /** No tipo "meta" (0036): a meta concluída, o valor e a próxima. */
  nome?: string;
  valor?: number;
  proxima?: string | null;
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
  /** Grava só as preferências mandadas; devolve as preferências como ficaram. */
  salvarPreferencias(parcial: Partial<Preferencias>): Promise<Preferencias>;
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

function ehMes(x: unknown): x is MesDaColecao {
  return ehObjeto(x) && ehNumero(x.ano) && ehNumero(x.mes);
}

const opcionalBool = (v: unknown) => v === undefined || typeof v === "boolean";

export function ehPreferencias(x: unknown): x is Preferencias {
  return (
    ehObjeto(x) &&
    typeof x.somLigado === "boolean" &&
    typeof x.modoDiscreto === "boolean" &&
    typeof x.mostrarNoPerfil === "boolean" &&
    opcionalBool(x.estagioNoPerfil) &&
    opcionalBool(x.selosNoPerfil) &&
    opcionalBool(x.comemoracoesCalmas) &&
    opcionalBool(x.jornadaComeco)
  );
}

/** Os campos do protótipo (0036): se vierem, vêm na forma certa. */
function ehExtrasDoPrototipo(x: Record<string, unknown>): boolean {
  const {
    semana,
    glowPorAcao,
    premios,
    selosProgresso,
    dinheiro,
    pilares,
    comeco,
  } = x;
  return (
    (semana === undefined ||
      (ehObjeto(semana) &&
        Array.isArray(semana.dias) &&
        semana.dias.every(
          (d) => d === null || d === "forte" || d === "descanso"
        ))) &&
    (glowPorAcao === undefined ||
      (ehObjeto(glowPorAcao) &&
        Object.values(glowPorAcao).every(
          (r) => ehObjeto(r) && ehNumero(r.glow) && ehNumero(r.limite)
        ))) &&
    (premios === undefined ||
      (ehObjeto(premios) &&
        ehNumero(premios.capitulo) &&
        ehNumero(premios.meta) &&
        ehNumero(premios.marco) &&
        Array.isArray(premios.seloNivel) &&
        premios.seloNivel.every(ehNumero))) &&
    (selosProgresso === undefined ||
      (ehObjeto(selosProgresso) &&
        Object.values(selosProgresso).every(
          (p) =>
            ehObjeto(p) &&
            ehNumero(p.contador) &&
            (p.proximo === null || ehNumero(p.proximo))
        ))) &&
    (dinheiro === undefined ||
      (ehObjeto(dinheiro) &&
        ehNumero(dinheiro.totalGuardado) &&
        ehNumero(dinheiro.metasConcluidas) &&
        (dinheiro.meta === null ||
          (ehObjeto(dinheiro.meta) &&
            typeof dinheiro.meta.nome === "string" &&
            ehNumero(dinheiro.meta.alvo) &&
            ehNumero(dinheiro.meta.atual))))) &&
    (pilares === undefined ||
      (ehObjeto(pilares) && PILARES.every((k) => ehNumero(pilares[k])))) &&
    (comeco === undefined ||
      (ehObjeto(comeco) &&
        Array.isArray(comeco.passos) &&
        comeco.passos.every((p) => typeof p === "boolean")))
  );
}

function temSoAsChaves(x: Record<string, unknown>, chaves: string[]): boolean {
  return Object.keys(x).every((k) => chaves.includes(k));
}

/** Exatamente `inicio` (data) e `contadores` (só números). */
function ehPeriodo(x: unknown): x is Periodo {
  return (
    ehObjeto(x) &&
    temSoAsChaves(x, ["inicio", "contadores"]) &&
    typeof x.inicio === "string" &&
    /^\d+-\d+-\d+$/.test(x.inicio) &&
    ehObjeto(x.contadores) &&
    Object.values(x.contadores).every(ehNumero)
  );
}

function ehPeriodos(x: unknown): x is Periodos {
  if (!ehObjeto(x) || !temSoAsChaves(x, ["corrente", "ultimoFechado"])) {
    return false;
  }
  const { corrente, ultimoFechado } = x;
  return (
    ehObjeto(corrente) &&
    temSoAsChaves(corrente, [...TIPOS_PERIODO]) &&
    TIPOS_PERIODO.every((t) => ehPeriodo(corrente[t])) &&
    ehObjeto(ultimoFechado) &&
    temSoAsChaves(ultimoFechado, [...TIPOS_PERIODO]) &&
    Object.values(ultimoFechado).every(ehPeriodo)
  );
}

/** Confere uma resposta do servidor ou do disco antes de confiar nela. */
export function ehEstadoJornada(x: unknown): x is EstadoJornada {
  if (!ehObjeto(x)) return false;
  const p = x.glowPorPilar;
  return (
    ehNumero(x.glowTotal) &&
    ehNumero(x.estagio) &&
    ehNumero(x.glowInicioEstagio) &&
    ehNumero(x.glowProximoEstagio) &&
    ehObjeto(p) &&
    PILARES.every((k) => ehNumero(p[k])) &&
    ehObjeto(x.selos) &&
    (x.capitulo === null || ehObjeto(x.capitulo)) &&
    Array.isArray(x.colecao) &&
    x.colecao.every(ehMes) &&
    Array.isArray(x.marcos) &&
    ehNumero(x.ajudou) &&
    ehNumero(x.protegeu) &&
    ehPreferencias(x.preferencias) &&
    (x.hoje === undefined || typeof x.hoje === "string") &&
    (x.destravados === undefined ||
      (Array.isArray(x.destravados) &&
        x.destravados.every((d) => typeof d === "string"))) &&
    ehPeriodos(x.periodos) &&
    ehExtrasDoPrototipo(x)
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
