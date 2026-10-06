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
  TipoPeriodo,
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

/** "95 Glow até Organizada" (protótipo: card e topo da tela). */
export function glowAteProximo(falta: number, proximoEstagio: number): string {
  return `${numero(falta)} ${NOME_GLOW} até ${nomeEstagio(proximoEstagio)}`;
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

/** Rótulos curtos (protótipo, "Ajustes da Jornada"). */
export const PREFERENCIAS = {
  som: "Sons",
  modoDiscreto: "Modo discreto",
  mostrarNoPerfil: "Mostrar meu estágio no perfil",
} as const;

/** A linha de explicação de cada preferência (protótipo). */
export const DESCRICAO_PREFERENCIA = {
  som: "Segue a chave do silencioso do celular.",
  modoDiscreto: "1 toque: sem som, sem confete, palavras neutras.",
  mostrarNoPerfil:
    "Desligado por padrão. Só as mulheres da Rede veem seu perfil.",
} as const;

// ────────────────────────── tela e card (J12) ────────────────────────
// Tudo do protótipo aprovado (docs/jornada/referencias/prototipo-sua-jornada.html).

/** Título da tela e do card. Com o Modo discreto, a palavra fica neutra. */
export function tituloJornada(modoDiscreto: boolean): string {
  return modoDiscreto ? "Seu progresso" : "Sua Jornada";
}

/** Nome acessível do card do Início. */
export const ABRIR_JORNADA = "Abrir sua Jornada";

export const VOLTAR = "Voltar";

/** "Estágio 2 de 5" até a Icônica; depois "Icônica · nível 2". */
export function rotuloEstagio(nivel: number): string {
  const total = ESTAGIOS.length;
  return nivel < total
    ? `Estágio ${numero(nivel + 1)} de ${numero(total)}`
    : `${ESTAGIOS[total - 1]} · nível ${numero(nivel - total + 2)}`;
}

/** "2 dias fortes nesta semana" */
export function diasFortesNaSemana(dias: number): string {
  return `${numero(dias)} ${plural(dias, "dia forte", "dias fortes")} nesta semana`;
}

export const RITMO_COMPLETO = "ritmo completo ✓";

/** "Capítulo de outubro · 1 de 3 missões" */
export function linhaCapitulo(
  mes: number,
  feitas: number,
  total: number
): string {
  return `${tituloCapitulo(mes)} · ${numero(feitas)} de ${numero(total)} missões`;
}

/** "Lua de outubro na sua coleção ✓" */
export function enfeiteNaColecao(mes: number): string {
  return `${nomeEnfeite(mes)} na sua coleção ✓`;
}

export const SECAO = {
  pilares: "Seus 4 pilares",
  selos: "Selos",
  colecao: "Sua coleção",
  dinheiro: "Seu dinheiro",
  ajustes: "Ajustes da Jornada",
} as const;

export const SUBTITULO_AJUSTES =
  "Tudo aqui é escolha sua. Nada da sua Jornada fica público se você não ligar.";

/** A nota de cada seção (protótipo). */
export const NOTA = {
  estagio:
    "Subir só soma. Nada do que você já tem é tirado, e depois da Icônica vêm Icônica II, III…",
  selos: "Cada selo tem níveis. O próximo nível vem com o tempo, no seu ritmo.",
  capitulo:
    "Todo mês tem missões novas. Se não der, tudo bem: o mês fica em branco na coleção e nada é tirado.",
  mesesEmBranco:
    "Os meses tracejados ficaram em branco. Sem culpa: eles não voltam, mas também não tiram nada de você.",
} as const;

/** Chip do capítulo: "completo ✓", "último dia", "5 dias". */
export function prazoCapitulo(diasRestantes: number, fechado: boolean): string {
  if (fechado) return "completo ✓";
  if (diasRestantes <= 0) return "último dia";
  return `${numero(diasRestantes)} ${plural(diasRestantes, "dia", "dias")}`;
}

/** "O prêmio do mês: um enfeite pra coleção" / "Já está na sua coleção." */
export function premioCapitulo(fechado: boolean): string {
  return fechado
    ? "Já está na sua coleção."
    : "O prêmio do mês: um enfeite pra coleção.";
}

/** "3 enfeites" */
export function contagemEnfeites(n: number): string {
  return `${numero(n)} ${plural(n, "enfeite", "enfeites")}`;
}

/** "1 meta concluída" */
export function contagemMetas(n: number): string {
  return `${numero(n)} ${plural(n, "meta concluída", "metas concluídas")}`;
}

/** "3 de 11" (selos conquistados) */
export function contagemSelos(conquistados: number, total: number): string {
  return `${numero(conquistados)} de ${numero(total)}`;
}

export const NIVEL_MAXIMO = "nível máximo";

/** "out 26" (célula da coleção). */
const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
export function rotuloMesColecao(ano: number, mes: number): string {
  return `${MESES_CURTOS[mes - 1] ?? ""} ${String(ano).slice(-2)}`;
}

/** Título da lista de marcos (protótipo: "Marcos do total guardado"). */
export const MARCOS_DO_TOTAL = "Marcos do total guardado";

/** "Isso me ajudou / Isso me protegeu" (decisão 12): só a autora vê. */
export const SO_VOCE_VE = "Só você vê isso";
export function textoAjudou(n: number): string {
  return `${numero(n)} ${plural(n, "mulher disse", "mulheres disseram")} que ajudou`;
}
export function textoProtegeu(n: number): string {
  return `${numero(n)} ${plural(n, "disse", "disseram")} que as protegeu`;
}

// ─────────────────────────────── estados ─────────────────────────────

export const CARREGANDO = "Carregando sua Jornada…";

export const MENSAGEM_ERRO: Record<ErroJornada, string> = {
  "sem-conexao":
    "Sem conexão. Sua Jornada se atualiza quando a internet voltar.",
  "resposta-invalida": "Não deu pra carregar sua Jornada agora. Tente de novo.",
};

/* ── Resumos de semana, mês e ano (J14, #164) ───────────────────────
   Montados SÓ com os contadores que `jornada_periodos` guarda (spec §8):
   `glow`, `dias_fortes`, as contagens por ação, e — por tipo de período —
   `firme`/`guardou` na semana, `semanas_firmes`/`semanas_guardou` no mês e
   no ano. Nada de diário: nenhum texto aqui pede "o que aconteceu no dia
   tal". Período fraco não é falha; período vazio é só vazio. */

export const RESUMO_TITULO: Record<TipoPeriodo, string> = {
  semana: "Esta semana",
  mes: "Este mês",
  ano: "Este ano",
};

/** Aba/rótulo curto de cada período. */
export const RESUMO_ABA: Record<TipoPeriodo, string> = {
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
};

/** "45 Glow nesta semana" */
export function resumoGlow(glow: number, tipo: TipoPeriodo): string {
  const quando = { semana: "nesta semana", mes: "neste mês", ano: "neste ano" };
  return `${numero(glow)} ${NOME_GLOW} ${quando[tipo]}`;
}

/** "2 dias fortes" / "1 dia forte" */
export function resumoDiasFortes(dias: number): string {
  return dias === 1 ? "1 dia forte" : `${numero(dias)} dias fortes`;
}

/** Ritmo: na semana é sim/não; no mês e no ano é contagem. */
export function resumoRitmo(valor: number, tipo: TipoPeriodo): string | null {
  if (valor <= 0) return null;
  if (tipo === "semana") return "Semana firme";
  return valor === 1 ? "1 semana firme" : `${numero(valor)} semanas firmes`;
}

/** Dinheiro guardado: na semana é sim/não; no mês e no ano é contagem. */
export function resumoGuardou(valor: number, tipo: TipoPeriodo): string | null {
  if (valor <= 0) return null;
  if (tipo === "semana") return "Você guardou dinheiro";
  return valor === 1
    ? "1 semana guardando dinheiro"
    : `${numero(valor)} semanas guardando dinheiro`;
}

/** Título da lista de ações do período. */
export const RESUMO_FEITOS = "O que você construiu";

/**
 * Rótulo de contagem de cada ação no resumo (singular/plural). Só as ações
 * que entram no resumo: atendimento fica de fora de propósito (decisão 1:
 * volume de trabalho não é conquista).
 */
interface ContagemAcao {
  um: string;
  muitos: string;
}

/**
 * Chaves de contador de período que viram linha no resumo. São as chaves
 * que `jornada_periodos.contadores` guarda (J10 `jornada_somar_periodo`):
 * as ações da §3 mais as duas de dica, que o servidor credita sozinho.
 * `atendimento` e `abrir_jornada` ficam de fora de propósito.
 */
const CONTAGEM_ACAO: Record<string, ContagemAcao> = {
  despesa: { um: "despesa lançada", muitos: "despesas lançadas" },
  receita: { um: "entrada lançada", muitos: "entradas lançadas" },
  planejar: { um: "dia planejado", muitos: "dias planejados" },
  guardar_meta: {
    um: "vez guardando dinheiro",
    muitos: "vezes guardando dinheiro",
  },
  comprovante_cofre: {
    um: "comprovante no Cofre",
    muitos: "comprovantes no Cofre",
  },
  descanso: { um: "dia de descanso", muitos: "dias de descanso" },
  dica_ajudou: {
    um: "vez que sua dica ajudou",
    muitos: "vezes que sua dica ajudou",
  },
  dica_protegeu: {
    um: "vez que sua dica protegeu",
    muitos: "vezes que sua dica protegeu",
  },
};

/** As chaves que aparecem no resumo, na ordem em que aparecem. */
export const ACOES_DO_RESUMO = Object.keys(CONTAGEM_ACAO);

/** "4 despesas lançadas" — null quando a chave não entra no resumo. */
export function resumoAcao(acao: string, n: number): string | null {
  const texto = CONTAGEM_ACAO[acao];
  if (!texto || n <= 0) return null;
  return `${numero(n)} ${n === 1 ? texto.um : texto.muitos}`;
}

/** Uma linha de comparação com o período fechado anterior. */
export function resumoAnterior(glow: number, tipo: TipoPeriodo): string {
  const quando = {
    semana: "Na semana passada",
    mes: "No mês passado",
    ano: "No ano passado",
  };
  return `${quando[tipo]}: ${numero(glow)} ${NOME_GLOW}`;
}

/** Período sem nada ainda. Sem cobrança: vazio é só vazio. */
export const RESUMO_VAZIO: Record<TipoPeriodo, string> = {
  semana: "Nada por aqui nesta semana. Tudo bem.",
  mes: "Nada por aqui neste mês. Tudo bem.",
  ano: "Nada por aqui neste ano. Tudo bem.",
};

/** Rodapé do resumo: o tom do pacote, sem cobrança. */
export const RESUMO_RODAPE =
  "Isto é o que você construiu, não uma meta a bater. O que não veio neste período não fica devendo.";
