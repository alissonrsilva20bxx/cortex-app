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

// ── porcentagem: só formatação de tela (larguras e anéis), nenhum Glow ──

/** Largura cheia (`100%`). */
export const CHEIO = "100%";

/** Fração (0 a 1) em porcentagem: `0.683` → `"68%"`, ou `"68.3%"` com
 * `casas = 1`. Arredonda como o protótipo (`Math.round` / `toFixed`). */
export function emPorcento(fracao: number, casas = 0): string {
  const p = fracao * 100;
  return casas === 0 ? `${Math.round(p)}%` : `${p.toFixed(casas)}%`;
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

/** A linha de apoio de cada pilar na tela (protótipo). */
export const DESCRICAO_PILAR: Record<Pilar, string> = {
  organizar: "Agenda e despesas",
  prosperar: "Poupança e metas",
  proteger: "Cofre e descanso",
  conectar: "Ajudando na Rede",
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
  criar_pin: "PIN criado",
  ver_resumo: "Resumo visto",
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
    // Spec §5: "meses na Jornada", I = 1 -- conta o mês em que ela está,
    // não um mês completo (#199).
    descricao: "Seu primeiro mês na Jornada.",
    unidade: "meses na sua Jornada",
  },
  um_ano: {
    nome: "Um ano",
    // Spec §5: "um ano na Jornada" = 12 meses na Jornada (#199).
    descricao: "Um ano na sua Jornada.",
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
  return `${numero(Math.min(progresso, alvo))}/${numero(alvo)}`;
}

// ───────────────────────────── dinheiro ──────────────────────────────

/** "€ 1.000 guardados" */
export function textoMarco(marco: MarcoDinheiro): string {
  return `${money(marco)} guardados`;
}

// ───────────────────────────── comemorações ──────────────────────────

export const TITULO_COMEMORACAO = {
  selo: "Selo conquistado",
  estagio: "Novo estágio desbloqueado",
  capitulo: "Capítulo fechado",
  marco: "Marco do seu dinheiro",
  meta: "Meta concluída",
} as const;

/** As comemorações grandes no texto do protótipo (`medal`, `stageUp`,
 * `goalUp`, as medalhas douradas do capítulo e do marco). */
export const COMEMORACAO = {
  seloNivel: (nivel: number) => `Selo nível ${numero(nivel)}`,
  novoNivelIconica: "Novo nível de Icônica",
  capituloCompleto: (mes: number) => `${tituloCapitulo(mes)} completo`,
  enfeiteNaColecao: (mes: number) =>
    `Seu enfeite de ${nomeMes(mes)} entrou na coleção. Ele é seu pra sempre.`,
  marcoApoio: "Somando todas as suas metas. Dinheiro de verdade, seu.",
  metaVale: "Meta concluída é o que mais vale",
  /** A linha de apoio da meta (protótipo: `goalUp`). */
  metaGuardada: (valor: number) => `${money(valor)} guardados de verdade.`,
  proximaMeta: (nome: string) => `Próxima meta: ${nome}`,
  doZero: "Começa do zero, no seu ritmo",
  /** O aviso da meta em modo quieto: "Meta concluída · Fundo Viagem". */
  avisoMeta: (nome: string) =>
    nome ? `${TITULO_COMEMORACAO.meta} · ${nome}` : TITULO_COMEMORACAO.meta,
  continuar: "Continuar",
  verJornada: "Ver minha Jornada",
} as const;

/** A linha de baixo do estágio novo (protótipo: `stageUp`). */
export function subEstagio(nivel: number): string {
  const total = ESTAGIOS.length;
  if (nivel < total - 1)
    return `Estágio ${numero(nivel + 1)} de ${numero(total)} · você construiu isso, passo a passo.`;
  if (nivel === total - 1)
    return `Estágio ${numero(total)} de ${numero(total)} · depois vêm Icônica II, III… nada zera.`;
  return `Icônica nível ${numero(nivel - total + 2)} · tudo o que você ganhou continua seu.`;
}

// ──────────────────────────── preferências ───────────────────────────

/** Rótulos curtos (protótipo, "Ajustes da Jornada"). */
export const PREFERENCIAS = {
  som: "Sons",
  modoDiscreto: "Modo discreto",
  estagioNoPerfil: "Mostrar meu estágio no perfil",
  selosNoPerfil: "Mostrar selos no perfil",
  jornadaComeco: "Jornada de Começo",
} as const;

/** A linha de explicação de cada preferência (protótipo). */
export const DESCRICAO_PREFERENCIA = {
  som: "Segue a chave do silencioso do celular.",
  modoDiscreto: "1 toque: sem som, sem confete, palavras neutras.",
  estagioNoPerfil:
    "Desligado por padrão. Só as mulheres da Rede veem seu perfil.",
  selosNoPerfil: "Desligado por padrão. Você escolhe quais.",
  jornadaComeco: "7 passos curtos pra sua primeira semana. Opcional.",
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
  // Protótipo: "Estágio 2 de 5" até a Prosperando; da Icônica em diante,
  // "Icônica · nível 1", "Icônica · nível 2"…
  return nivel < total - 1
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

// Card do Início no desenho do protótipo: cada linha tem um trecho em
// negrito, então o texto vem em partes.

/** Dias fortes que fazem a semana firme (spec §3: "3 dias fortes por
 * semana"); o protótipo escreve "2 de 3". Só exibição: quem decide se a
 * semana foi firme continua sendo o servidor (contador "firme"). */
export const DIAS_FORTES_DA_SEMANA_FIRME = 3;

/** "95 até Organizada" (no card, o protótipo não repete "Glow"). */
export function ateProximo(falta: number, proximoEstagio: number): string {
  return `${numero(falta)} até ${nomeEstagio(proximoEstagio)}`;
}

/** "**2 de 3** dias fortes nesta semana" */
export function diasFortesDeTres(dias: number): {
  forte: string;
  resto: string;
} {
  const n = Math.min(dias, DIAS_FORTES_DA_SEMANA_FIRME);
  return {
    forte: `${numero(n)} de ${numero(DIAS_FORTES_DA_SEMANA_FIRME)}`,
    resto: " dias fortes nesta semana",
  };
}

/** "Capítulo de outubro · **1 de 3** missões" */
export function capituloEmPartes(
  mes: number,
  feitas: number,
  total: number
): { antes: string; forte: string; resto: string } {
  return {
    antes: `${tituloCapitulo(mes)} · `,
    forte: `${numero(feitas)} de ${numero(total)}`,
    resto: " missões",
  };
}

/** "**Lua de outubro** na sua coleção ✓" */
export function enfeiteEmPartes(mes: number): { forte: string; resto: string } {
  return { forte: nomeEnfeite(mes), resto: " na sua coleção ✓" };
}

export const SECAO = {
  ritmo: "Ritmo da semana",
  comeco: "Jornada de Começo",
  oQueDaGlow: "O que dá Glow",
  pilares: "Seus 4 pilares",
  selos: "Selos",
  colecao: "Sua coleção",
  dinheiro: "Seu dinheiro",
  ajustes: "Ajustes da Jornada",
} as const;

export const AJUSTES_DA_JORNADA = SECAO.ajustes;

export const FECHAR = "Fechar";

export function tituloDestrava(proximoEstagio: string): string {
  return `Destrava em ${proximoEstagio}`;
}

/** Um item que subir de estágio dá (spec §4: moldura, ícone, tema). */
export interface ItemDestravado {
  tipo: "moldura" | "tema" | "icone";
  nome: string;
  descricao: string;
}

/** Os itens de cada degrau, na ordem do protótipo (moldura, tema, ícone).
 * Só nomes: QUAIS itens cada estágio dá é o servidor que grava
 * (`jornada_destravados`: `moldura_estagio_N`, `tema_…`, `icone_…`). */
const ITENS_POR_DEGRAU: ItemDestravado[][] = [
  [],
  [
    { tipo: "moldura", nome: "Moldura suave", descricao: "Para o seu avatar" },
    { tipo: "tema", nome: "Tema Blush", descricao: "Um tom mais claro" },
    { tipo: "icone", nome: "Ícone Glow", descricao: "Troque nos Ajustes" },
  ],
  [
    {
      tipo: "moldura",
      nome: "Moldura ouro rosé",
      descricao: "Para o seu avatar",
    },
    {
      tipo: "tema",
      nome: "Tema Veludo",
      descricao: "Um tom mais fundo da sua cor",
    },
    { tipo: "icone", nome: "Ícone Faísca", descricao: "Troque nos Ajustes" },
  ],
  [
    {
      tipo: "moldura",
      nome: "Moldura champanhe",
      descricao: "Para o seu avatar",
    },
    { tipo: "tema", nome: "Tema Aurora", descricao: "Fundos com brilho suave" },
    { tipo: "icone", nome: "Ícone Flor", descricao: "Troque nos Ajustes" },
  ],
  [
    {
      tipo: "moldura",
      nome: "Moldura Icônica",
      descricao: "Animada, para o seu avatar",
    },
    { tipo: "tema", nome: "Tema Noir", descricao: "Preto e dourado" },
    { tipo: "icone", nome: "Ícone Coroa", descricao: "Troque nos Ajustes" },
  ],
];

/** O que o estágio `nivel` dá. Depois da Icônica, cada nível dá a sua
 * versão (Moldura Icônica II, Coroa II, Noir II…). */
export function itensDoEstagio(nivel: number): ItemDestravado[] {
  if (nivel < ITENS_POR_DEGRAU.length) return ITENS_POR_DEGRAU[nivel] ?? [];
  const r = romano(nivel - ESTAGIOS.length + 2);
  return [
    {
      tipo: "moldura",
      nome: `Moldura Icônica ${r}`,
      descricao: "Mais brilho a cada nível",
    },
    {
      tipo: "icone",
      nome: `Coroa ${r}`,
      descricao: "Ícone do app, nos Ajustes",
    },
    { tipo: "tema", nome: `Noir ${r}`, descricao: "Novos detalhes dourados" },
  ];
}

/** Os resumos em stories (protótipo: `slides()`). */
export const RECAP = {
  semNome: "Sem nome, sem logo. Seguro pra compartilhar.",
  prosperar: NOME_PILAR.prosperar,
  conectar: NOME_PILAR.conectar,
  vezesGuardando: (n: number) =>
    n === 1 ? "vez guardando dinheiro." : "vezes guardando dinheiro.",
  futuro: "A você do futuro agradece.",
  // Prosperar com a meta de dinheiro (0036, `dinheiro`).
  naMeta: (nome: string) => `na meta ${nome}.`,
  jaECaminho: (fracao: number) =>
    `Já é ${emPorcento(fracao)} do caminho. A você do futuro agradece.`,
  guardadosNasMetas: "guardados nas suas metas.",
  agoraMeta: (concluidas: number, nome: string | null) =>
    `${concluidas > 0 ? `${contagemMetas(concluidas)}. ` : ""}${nome ? `Agora: ${nome}.` : ""}`,
  guardadosDeVerdade: "guardados de verdade.",
  metasConcluidasPonto: (n: number) => `${contagemMetas(n)}.`,
  ateProximo: (falta: number, proximo: string) =>
    `${numero(falta)} até ${proximo}`,
  // semana
  suaSemana: "Sua semana",
  diasFortes: (n: number) => (n === 1 ? "dia forte." : "dias fortes."),
  apareceu: "Você apareceu pra você, não só pro trabalho.",
  mulheresAjudou: "mulheres disseram que sua dica ajudou.",
  soVoceVe: "Só você vê esse número.",
  glowNaSemana: `${NOME_GLOW} na semana`,
  cadaUmDeles: "Cada um deles foi você cuidando de você.",
  proximaSemana: "Próxima semana",
  passoPequeno: "Um passo pequeno: planeje a segunda no domingo à noite.",
  estaSemana: "Esta semana",
  umPassoDeCada: (n: number) =>
    `${numero(n)} ${plural(n, "dia forte", "dias fortes")}. Um passo de cada vez.`,
  // mês
  seuMes: (mes: number) => `Seu ${nomeMes(mes)}`,
  diasFortesNoMes: (n: number) =>
    n === 1 ? "dia forte no mês." : "dias fortes no mês.",
  cadaUmNoMes: "Cada um foi você cuidando do seu negócio, e de você.",
  capituloDe: (mes: number) => tituloCapitulo(mes),
  entrouNaColecao: (enfeite: string) => `${enfeite} entrou na sua coleção.`,
  enfeitesAteAgora: (n: number) => `${contagemEnfeites(n)} até agora.`,
  missoesDe: (feitas: number, total: number) =>
    `${numero(feitas)} de ${numero(total)}`,
  missoesFeitas: "missões feitas.",
  seNaoFechar: "Se não fechar, tudo bem. O mês fica em branco e nada é tirado.",
  glowNoMes: `${NOME_GLOW} no mês`,
  voceEstaEm: (estagio: string) => `Você está em ${estagio}.`,
  mesQueVem: "Mês que vem",
  capituloNovo: "Capítulo novo, 3 missões novas. No seu ritmo.",
  esteMes: "Este mês",
  diasCuidando: (n: number) =>
    `${numero(n)} ${plural(n, "dia", "dias")} cuidando de mim.`,
  // ano
  seuAno: "Seu ano",
  mesesNaJornada: "meses na sua Jornada.",
  idasEVindas: "Com idas e vindas. É assim mesmo.",
  suaColecao: "Sua coleção",
  enfeites: "enfeites.",
  mesesEmBrancoNaoTiraram: "Os meses em branco não tiraram nada.",
  vezesAjudou: "vezes sua dica ajudou alguém.",
  eProtegeu: (n: number) =>
    `E ${numero(n)} disseram que ela as protegeu. Só você vê.`,
  glow: NOME_GLOW,
  nadaZera: "Nada zera. O ano que vem soma em cima.",
  praGuardar: "Pra guardar",
  meuAno: "Meu ano",
  umAnoCuidando: "Um ano cuidando de mim. Passo a passo.",
} as const;

export const SUBTITULO_AJUSTES =
  "Tudo aqui é escolha sua. Nada da sua Jornada fica público se você não ligar.";

/** A nota de cada seção (protótipo). */
/** Texto com um trecho em negrito no meio: [antes, negrito, depois]. */
export type TrechoComDestaque = readonly [string, string, string];

export const NOTA: Record<
  | "estagio"
  | "selos"
  | "capitulo"
  | "mesesEmBranco"
  | "ritmo"
  | "ritmoCompleto"
  | "oQueDaGlow",
  TrechoComDestaque
> = {
  ritmo: [
    "Dia forte é qualquer dia em que você cuida do seu negócio. ",
    "Descanso nunca quebra o seu ritmo",
    ", e não existe sequência pra perder.",
  ],
  ritmoCompleto: [
    "",
    "Ritmo completo.",
    " O que vier a mais nesta semana é bônus.",
  ],
  oQueDaGlow: [
    "Depois do limite do dia, o que você registra continua salvo, só não dá Glow. Atendimento só marca o dia como ativo, 1x por dia. ",
    "Sua Jornada premia cuidar de você, nunca trabalhar mais.",
    "",
  ],
  estagio: [
    "Subir só soma. ",
    "Nada do que você já tem é tirado",
    ", e depois da Icônica vêm Icônica II, III…",
  ],
  selos: [
    "Cada selo tem níveis. ",
    "O próximo nível vem com o tempo",
    ", no seu ritmo.",
  ],
  capitulo: [
    "Todo mês tem missões novas. ",
    "Se não der, tudo bem:",
    " o mês fica em branco na coleção e nada é tirado.",
  ],
  mesesEmBranco: [
    "Os meses tracejados ficaram em branco. ",
    "Sem culpa:",
    " eles não voltam, mas também não tiram nada de você.",
  ],
};

/** Chip do capítulo: "completo ✓", "último dia", "5 dias". */
export function prazoCapitulo(diasRestantes: number, fechado: boolean): string {
  if (fechado) return "completo ✓";
  if (diasRestantes <= 0) return "último dia";
  return `${numero(diasRestantes)} ${plural(diasRestantes, "dia", "dias")}`;
}

/** "O prêmio do mês: um enfeite pra coleção e +40 Glow" / "Já está na sua
 * coleção. +40 Glow" (o Glow vem do servidor, `premios.capitulo`). Sem ele
 * (servidor antigo), a frase sem o número. */
export function premioCapitulo(fechado: boolean, glow?: number): string {
  if (glow === undefined)
    return fechado
      ? "Já está na sua coleção."
      : "O prêmio do mês: um enfeite pra coleção.";
  return fechado
    ? `Já está na sua coleção. +${numero(glow)} ${NOME_GLOW}`
    : `O prêmio do mês: um enfeite pra coleção e +${numero(glow)} ${NOME_GLOW}`;
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

// ───────────────────── 0036: as peças com dados novos ─────────────────────

/** A meta da semana: 3 dias fortes (spec §3, "Ritmo"). */
export const DIAS_FORTES_DO_RITMO = 3;

/** As letras dos dias, de segunda a domingo (protótipo: DAYS). */
export const LETRAS_DOS_DIAS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

/** "2 de 3 dias fortes" (chip do Ritmo da semana). */
export function chipRitmo(fortes: number): string {
  return `${numero(Math.min(fortes, DIAS_FORTES_DO_RITMO))} de ${numero(DIAS_FORTES_DO_RITMO)} dias fortes`;
}

export const LEGENDA_RITMO = {
  forte: "Dia forte",
  descanso: "Descanso",
  hoje: "Hoje",
} as const;

/** Seu dinheiro: a meta atual e o total. */
export const META_ATUAL = "Meta atual";
/** "€120 de €300" */
export function metaDeAte(atual: number, alvo: number): string {
  return `${money(atual)} de ${money(alvo)}`;
}
/** "Marcos do total guardado · €120" */
export function marcosDoTotal(total: string): string {
  return `${MARCOS_DO_TOTAL} · ${total}`;
}
/** O valor escondido do Modo discreto (protótipo: `moneyHidden`). */
export function dinheiroEscondido(): string {
  return money(0).replace("0", "•••");
}
export const MARCO_ESCONDIDO = "•••";
/** A nota do dinheiro: [antes, +100 Glow, meio, +50, depois]. */
export function notaDinheiro(
  meta: number,
  marco: number
): readonly [string, string, string, string, string] {
  return [
    "Concluir uma meta vale ",
    `+${numero(meta)} ${NOME_GLOW}`,
    ", e cada marco ",
    `+${numero(marco)}`,
    ". É dinheiro de verdade, então é o que mais vale.",
  ];
}

/** O contador de um selo com níveis: "3/10" ou "nível máximo". */
export function contadorSelo(contador: number, proximo: number | null): string {
  return proximo === null
    ? NIVEL_MAXIMO
    : `${numero(contador)}/${numero(proximo)}`;
}

/** "O que dá Glow": o limite de cada linha (`capTxt` do protótipo). */
export function limiteDoDia(vezes: number): string {
  return vezes === 1 ? "1x por dia" : `até ${numero(vezes)}x por dia`;
}
/** "+5" (o número do `ptsTag` do protótipo, antes da faísca). */
export function maisGlow(glow: number): string {
  return `+${numero(glow)}`;
}
/** A porcentagem de 0 a 100 do servidor como fração (o anel do pilar). */
export function dePorcento(porcento: number): number {
  return porcento / 100;
}
export const UMA_VEZ_POR_MES = "1x por mês";
export const LINHA_GLOW = {
  planejar: "Planejar o dia ou a semana",
  despesa: "Lançar uma despesa",
  guardar_meta: "Guardar dinheiro numa meta",
  comprovante_cofre: "Guardar um comprovante no Cofre",
  descanso: "Tirar um dia de descanso",
  dica_ajudou: "Sua dica ajudou alguém",
  meta: "Concluir uma meta",
  marco: "Marco do seu dinheiro",
  capitulo: "Completar o capítulo do mês",
} as const;

/** Jornada de Começo (protótipo: STARTER). */
export const PASSOS_DO_COMECO = [
  "Criar seu PIN",
  "Criar sua primeira meta",
  "Planejar sua semana",
  "Guardar um comprovante no Cofre",
  "Dar oi na Rede",
  "Tirar um dia de descanso",
  "Ver seu primeiro resumo",
] as const;
/** "Dia 3 de 7" */
export function diaDoComeco(feitos: number): string {
  const total = PASSOS_DO_COMECO.length;
  return `Dia ${numero(Math.min(total, feitos + 1))} de ${numero(total)}`;
}
export const FAZER = "Fazer";

/** Folha de Ajustes: as linhas novas do protótipo. */
export const COMEMORACOES = {
  titulo: "Comemorações",
  descricao: "Calma deixa só confirmações pequenas e silenciosas.",
  completa: "Completa",
  calma: "Calma",
} as const;
export const ESTAGIO_OCULTO = "Estágio oculto";
export const SELOS_OCULTOS = "Selos ocultos";
