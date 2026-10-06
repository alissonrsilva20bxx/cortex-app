/**
 * TODO texto visível da "Sua Jornada" e a formatação de moeda, num lugar só
 * (spec, decisão 17 e §9). Nenhum componente nem lógica escreve texto ou
 * símbolo de moeda direto: tudo vem daqui. Trocar idioma/moeda no futuro é
 * trocar este arquivo (e o bloco `LOCALE`/`CURRENCY`), não caçar strings.
 *
 * O teste `tests/jornada/textos.test.ts` garante que nenhum outro arquivo
 * de `lib/jornada/` e `components/jornada/` tem texto visível ou moeda.
 *
 * Nada aqui decide valor: os números (Glow, alvos de missão, estágio) chegam
 * do servidor e este arquivo só os escreve por extenso.
 */

import type {
  Acao,
  AcaoDaDica,
  ErroJornada,
  MarcoDinheiro,
  Pilar,
  SeloId,
  TipoMissao,
} from "./estado";

// ─────────────────────────── idioma e moeda ───────────────────────────

export const LOCALE = "pt-BR";
export const CURRENCY = "EUR";

const formatoMoeda = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const formatoNumero = new Intl.NumberFormat(LOCALE);

/** Valor em dinheiro por extenso ("€ 500" / "500 €", conforme o LOCALE). */
export function money(valor: number): string {
  return formatoMoeda.format(valor);
}

/** Número com separador de milhar do LOCALE ("1.200"). */
export function numero(valor: number): string {
  return formatoNumero.format(valor);
}

// ─────────────────────────────── Glow ────────────────────────────────

export const NOME_GLOW = "Glow";

/** "+15 Glow" */
export function glowGanho(glow: number): string {
  return `+${numero(glow)} ${NOME_GLOW}`;
}

/** "1.200 Glow" */
export function glowTotal(glow: number): string {
  return `${numero(glow)} ${NOME_GLOW}`;
}

/** "Faltam 300 Glow para Organizada" */
export function faltaParaProximo(
  falta: number,
  proximoEstagio: number
): string {
  return `Faltam ${numero(falta)} ${NOME_GLOW} para ${nomeEstagio(proximoEstagio)}`;
}

// ───────────────────────────── estágios ──────────────────────────────

const ESTAGIOS = [
  "Começando",
  "Em movimento",
  "Organizada",
  "Prosperando",
  "Icônica",
] as const;

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function romano(n: number): string {
  return ROMANOS[n - 1] ?? String(n);
}

/** Nome do estágio pelo nível que o servidor mandou (0 = Começando). */
export function nomeEstagio(nivel: number): string {
  if (nivel < ESTAGIOS.length) return ESTAGIOS[Math.max(0, nivel)];
  // Depois de Icônica: Icônica II, III... (nada zera, spec §4).
  const ultimo = ESTAGIOS[ESTAGIOS.length - 1];
  return `${ultimo} ${romano(nivel - ESTAGIOS.length + 2)}`;
}

// ────────────────────────────── pilares ──────────────────────────────

export const NOME_PILAR: Record<Pilar, string> = {
  organizar: "Organizar",
  prosperar: "Prosperar",
  proteger: "Proteger",
  conectar: "Conectar",
};

// ─────────────────────────────── ações ───────────────────────────────

/** Rótulo da comemoração pequena de cada ação. */
export const ROTULO_ACAO: Record<Acao, string> = {
  despesa: "Despesa lançada",
  receita: "Entrada lançada",
  planejar: "Amanhã está planejado",
  guardar_meta: "Dinheiro guardado na sua meta",
  comprovante_cofre: "Comprovante seguro no Cofre",
  descanso: "Dia de descanso garantido",
  atendimento: "Dia ativo",
  abrir_jornada: "Você abriu sua Jornada",
};

/** "Isso me ajudou" / "Isso me protegeu": creditadas pelo servidor à autora. */
export const ROTULO_DICA: Record<AcaoDaDica, string> = {
  dica_ajudou: "Sua dica ajudou alguém hoje",
  dica_protegeu: "Sua dica protegeu alguém",
};

/** Passou do limite do dia: registra, sem Glow. */
export const LIMITE_DO_DIA =
  "O Glow de hoje por isso já veio. A contagem segue.";

// ─────────────────────────────── selos ───────────────────────────────

export interface TextoSelo {
  nome: string;
  descricao: string;
  /** Unidade do contador ("dias planejados"); vazio nos selos de nível único. */
  unidade: string;
}

export const SELO: Record<SeloId, TextoSelo> = {
  primeiros_passos: {
    nome: "Primeiros passos",
    descricao: "Você abriu sua Jornada.",
    unidade: "",
  },
  planejadora: {
    nome: "Planejadora",
    descricao: "Planejou um dia antes de ele começar.",
    unidade: "dias planejados com antecedência",
  },
  mao_amiga: {
    nome: "Mão amiga",
    descricao: "Uma dica sua ajudou alguém.",
    unidade: "vezes que sua dica ajudou alguém",
  },
  semana_firme: {
    nome: "Semana firme",
    descricao: "3 dias fortes numa semana. Isso é ritmo.",
    unidade: "semanas firmes",
  },
  rumo_a_meta: {
    nome: "Rumo à meta",
    descricao: "Seu primeiro dinheiro guardado numa meta.",
    unidade: "vezes guardando dinheiro",
  },
  tudo_guardado: {
    nome: "Tudo guardado",
    descricao: "Seu primeiro comprovante seguro no Cofre.",
    unidade: "comprovantes seguros no Cofre",
  },
  descansar_conta: {
    nome: "Descansar conta",
    descricao: "Você tirou um dia de descanso de propósito.",
    unidade: "descansos de propósito",
  },
  guardia: {
    nome: "Guardiã",
    descricao: "Sua dica protegeu outras mulheres.",
    unidade: "vezes que sua dica protegeu alguém",
  },
  em_casa: {
    nome: "Em casa",
    descricao: "Você completou seus primeiros 7 dias.",
    unidade: "",
  },
  mes_a_mes: {
    nome: "Mês a mês",
    descricao: "Um mês inteiro na sua Jornada.",
    unidade: "meses na sua Jornada",
  },
  um_ano: {
    nome: "Um ano",
    descricao: "Um ano inteiro cuidando de você.",
    unidade: "",
  },
};

/** "Planejadora II" */
export function nomeSeloComNivel(selo: SeloId, nivel: number): string {
  return `${SELO[selo].nome} ${romano(nivel)}`;
}

// ───────────────────────── capítulo do mês ───────────────────────────

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Nome do mês (1 a 12), em minúsculas como no meio da frase. */
export function nomeMes(mes: number): string {
  return MESES[mes - 1] ?? "";
}

/** O enfeite de cada mês (1 a 12), spec §6. */
const ENFEITES = [
  "Faísca de janeiro",
  "Coração de fevereiro",
  "Broto de março",
  "Luz de abril",
  "Paleta de maio",
  "Sol de junho",
  "Onda de julho",
  "Moeda de agosto",
  "Sino de setembro",
  "Lua de outubro",
  "Folha de novembro",
  "Estrela de dezembro",
];

export function nomeEnfeite(mes: number): string {
  return ENFEITES[mes - 1] ?? "";
}

/** "Capítulo de outubro" */
export function tituloCapitulo(mes: number): string {
  return `Capítulo de ${nomeMes(mes)}`;
}

export const MES_EM_BRANCO = "Mês em branco";

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

/** Texto de uma missão, com o alvo que o servidor mandou. */
export function textoMissao(tipo: TipoMissao, alvo: number): string {
  const n = numero(alvo);
  switch (tipo) {
    case "planejar_dias":
      return `Planejar ${n} ${plural(alvo, "dia", "dias")}`;
    case "lancar_despesas":
      return `Lançar ${n} ${plural(alvo, "despesa", "despesas")}`;
    case "tirar_descansos":
      return `Tirar ${n} ${plural(alvo, "descanso", "descansos")}`;
    case "guardar_semanas":
      return `Guardar dinheiro em ${n} ${plural(alvo, "semana", "semanas")}`;
    case "comprovantes_cofre":
      return `Guardar ${n} ${plural(alvo, "comprovante", "comprovantes")} no Cofre`;
    case "dias_fortes":
      return `Ter ${n} ${plural(alvo, "dia forte", "dias fortes")}`;
    case "semanas_firmes":
      return `Ter ${n} ${plural(alvo, "semana firme", "semanas firmes")}`;
    case "dica_ajudou":
      return `Sua dica ajudar ${n} ${plural(alvo, "vez", "vezes")}`;
    case "dica_protegeu":
      return `Sua dica proteger alguém ${n} ${plural(alvo, "vez", "vezes")}`;
    case "dica_ajudou_ou_protegeu":
      return `Sua dica ajudar ou proteger ${n} ${plural(alvo, "vez", "vezes")}`;
  }
}

/** "3 de 8" */
export function progressoMissao(progresso: number, alvo: number): string {
  return `${numero(Math.min(progresso, alvo))} de ${numero(alvo)}`;
}

// ───────────────────────────── dinheiro ──────────────────────────────

/** "€ 1.000 guardados" */
export function textoMarco(marco: MarcoDinheiro): string {
  return `${money(marco)} guardados`;
}

// ───────────────────────────── comemorações ──────────────────────────

export const TITULO_COMEMORACAO = {
  selo: "Selo novo",
  estagio: "Você subiu de estágio",
  capitulo: "Capítulo fechado",
  marco: "Marco de dinheiro",
  meta: "Meta concluída",
} as const;

// ──────────────────────────── preferências ───────────────────────────

export const PREFERENCIAS = {
  som: "Som da Jornada",
  modoDiscreto: "Modo discreto",
  mostrarNoPerfil: "Mostrar estágio e selos no perfil",
} as const;

// ─────────────────────────────── estados ─────────────────────────────

export const CARREGANDO = "Carregando sua Jornada…";

export const MENSAGEM_ERRO: Record<ErroJornada, string> = {
  "sem-conexao":
    "Sem conexão. Sua Jornada se atualiza quando a internet voltar.",
  "resposta-invalida": "Não deu pra carregar sua Jornada agora. Tente de novo.",
};
