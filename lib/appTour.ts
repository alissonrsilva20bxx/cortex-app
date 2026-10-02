import type { TabId } from "@/lib/types";

/**
 * Tour guiado do app (coachmarks), mostrado uma vez logo depois do
 * onboarding de conta nova e reabrível em Ajustes. O onboarding só cuida
 * de dados (meta, 1º atendimento, PIN); o tour mostra ONDE as coisas
 * moram: Início → Agenda → Financeiro → Cofre → Rede (feed e perfil) →
 * Ajustes, como o "passo a passo" dos outros apps.
 *
 * Lógica pura aqui (testável no vitest `node`); o overlay em si fica em
 * `components/onboarding/AppTour.tsx`.
 */

export interface TourStep {
  id: string;
  /** Aba que precisa estar ativa enquanto o passo aparece (null = mantém). */
  tab: TabId | null;
  /** Valor de `data-tour` do elemento destacado (null = cartão sem alvo). */
  target: string | null;
  title: string;
  body: string;
  /** Tocar no destaque (ou no botão principal) troca pra esta aba. */
  goTo?: TabId;
  /** Rótulo do botão principal (padrão "Próximo"). */
  cta?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "home-hero",
    tab: "home",
    target: "home-hero",
    title: "Este é o seu Início",
    body: "Aqui você vê quanto já ganhou no mês e quanto falta pras suas metas. É o coração do JobApp.",
  },
  {
    id: "fab",
    tab: "home",
    target: "fab",
    title: "O botão +",
    body: "Cria o que faz sentido na aba em que você está: atendimento, despesa, entrada ou arquivo do Cofre.",
  },
  {
    id: "go-agenda",
    tab: "home",
    target: "nav-jobs",
    title: "Agora, a Agenda",
    body: "Toque em Agenda aqui embaixo.",
    goTo: "jobs",
    cta: "Abrir Agenda",
  },
  {
    id: "agenda",
    tab: "jobs",
    target: null,
    title: "Agenda",
    body: "Seus atendimentos por dia: marque, confirme e acompanhe quem já pagou. No Bloco de notas ficam lembretes gerais.",
  },
  {
    id: "go-financeiro",
    tab: "jobs",
    target: "nav-financeiro",
    title: "Próxima parada: Financeiro",
    body: "Toque em Financeiro.",
    goTo: "financeiro",
    cta: "Abrir Financeiro",
  },
  {
    id: "financeiro",
    tab: "financeiro",
    target: null,
    title: "Financeiro",
    body: "Entradas, despesas e metas do mês. Os números do Início saem daqui, e você troca de visão nas abas lá em cima.",
  },
  {
    // Só aponta, não abre: entrar no Cofre pede o PIN dele, e o tour não
    // deve parar numa tela de senha.
    id: "cofre",
    tab: "financeiro",
    target: "nav-cofre",
    title: "Cofre",
    body: "Guarde documentos, contratos e fotos com um PIN só dele. Quando quiser, é só tocar aqui.",
    cta: "Entendi",
  },
  {
    id: "go-rede",
    tab: "financeiro",
    target: "nav-rede",
    title: "E a Rede",
    body: "Toque em Rede pra conhecer o feed.",
    goTo: "rede",
    cta: "Abrir Rede",
  },
  {
    id: "rede-feed",
    tab: "rede",
    target: null,
    title: "Feed da Rede",
    body: "Publicações das suas amigas: curta, comente e mande mensagem. Pela lupa você encontra e adiciona pessoas.",
  },
  {
    id: "rede-perfil",
    tab: "rede",
    target: "rede-perfil",
    title: "Seu perfil",
    body: "Toque na sua foto pra abrir o seu espaço: lá você coloca a foto de perfil, edita a bio e vê suas publicações.",
  },
  {
    id: "ajustes",
    tab: "home",
    target: "home-ajustes",
    title: "Ajustes",
    body: "Sua foto no Início abre os Ajustes: tema, PIN, notificações e este tour de novo, quando quiser.",
  },
  {
    id: "fim",
    tab: "home",
    target: null,
    title: "Tudo pronto!",
    body: "Você já sabe onde fica cada coisa. Bom trabalho!",
    cta: "Começar",
  },
];

/** Situação do convite da Rede, como o `RedeGatedTab` informa. */
export type RedeAcessoTour = "pendente" | "liberado" | "bloqueado";

/**
 * Quem ainda não resgatou convite vê a vitrine da Rede, não o feed nem o
 * próprio perfil -- os passos da Rede trocam por estes (mesma quantidade,
 * pra contagem "x de N" não pular). Cada um substitui o passo de mesmo
 * índice da lista padrão.
 */
const PASSOS_REDE_BLOQUEADA: Record<string, TourStep> = {
  "go-rede": {
    id: "go-rede",
    tab: "financeiro",
    target: "nav-rede",
    title: "E a Rede",
    body: "Toque em Rede pra conhecer a comunidade.",
    goTo: "rede",
    cta: "Abrir Rede",
  },
  "rede-feed": {
    id: "rede-vitrine",
    tab: "rede",
    target: null,
    title: "A Rede",
    body: "É a comunidade do JobApp: feed, amigas e mensagens entre profissionais. A entrada é só por convite, então ela fica liberada quando você usar o seu.",
  },
  "rede-perfil": {
    id: "rede-convite",
    tab: "rede",
    target: "rede-convite",
    title: "Tem um convite?",
    body: "Toque aqui pra digitar o código que você recebeu. Ainda não tem? Peça pra participar da beta pelo botão acima.",
  },
};

/** Passos do tour conforme o acesso à Rede (pendente segue a lista padrão). */
export function stepsDoTour(acesso: RedeAcessoTour): TourStep[] {
  if (acesso !== "bloqueado") return TOUR_STEPS;
  return TOUR_STEPS.map((s) => PASSOS_REDE_BLOQUEADA[s.id] ?? s);
}

export const tourDoneKey = (userId: string) => `jobapp-tour-done:${userId}`;

/** Onde o cartão do passo fica em relação ao destaque. */
export type TourPlacement = "above" | "below" | "center";

/**
 * Sem alvo (ou alvo ainda não medido) = cartão centralizado; alvo na
 * metade de baixo da tela (BottomNav, FAB) = cartão em cima; senão, embaixo.
 */
export function tourPlacement(
  rect: { top: number; height: number } | null,
  viewportHeight: number
): TourPlacement {
  if (!rect) return "center";
  const mid = rect.top + rect.height / 2;
  return mid > viewportHeight / 2 ? "above" : "below";
}
