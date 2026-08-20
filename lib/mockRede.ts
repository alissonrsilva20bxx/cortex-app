/**
 * Dados mockados da Rede — 100% locais, nada aqui toca o Supabase.
 * Mesmo espírito do lib/mock.ts: fixture estável para construir e revisar
 * a experiência visual antes de existir qualquer tabela/API real.
 */

export type Privacidade = "privado" | "amigas" | "comunidade";
export type WishlistEstado = "quero" | "planejando" | "conquistado";
export type ClienteStatus = "ativo" | "vip" | "em-negociacao" | "pausado";
export type Plataforma =
  | "instagram"
  | "whatsapp"
  | "tiktok"
  | "site"
  | "agenda";

export interface RedeUser {
  id: string;
  nome: string;
  handle: string;
  bio: string;
  cor: string; // hex — cor de fundo do avatar (sem fotos reais, como o resto do app)
}

export interface DiscoverPerson {
  userId: string;
  motivo: string;
}

export interface LiveLink {
  id: string;
  plataforma: Plataforma;
  label: string;
  url: string;
  ativo: boolean;
  ordem: number;
}

export interface WishlistItem {
  id: string;
  nome: string;
  cor: string;
  valorAlvo: number;
  valorAtual: number;
  estado: WishlistEstado;
  privacidade: Privacidade;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  status: ClienteStatus;
  etiquetas: string[];
  ultimoContato: string; // YYYY-MM-DD
  observacoes: string;
}

/** "há 2h" / "há 3 d" / "12 jul" — sempre relativo ao instante de renderização. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

export const REDE_USERS: RedeUser[] = [
  {
    id: "u1",
    nome: "Camila Duarte",
    handle: "@camila.unhas",
    bio: "Nail designer há 6 anos — cuidando de mãos e autoestima.",
    cor: "#FF7AB6",
  },
  {
    id: "u2",
    nome: "Larissa Prado",
    handle: "@lari.hair",
    bio: "Cabeleireira mobile, atendo em domicílio na Zona Sul.",
    cor: "#7AA7FF",
  },
  {
    id: "u3",
    nome: "Fernanda Costa",
    handle: "@fe.makeup",
    bio: "Maquiagem para noivas e eventos.",
    cor: "#FFC24B",
  },
  {
    id: "u4",
    nome: "Juliana Alves",
    handle: "@ju.esteticista",
    bio: "Esteticista — skincare e bem-estar.",
    cor: "#6EE7B7",
  },
  {
    id: "u5",
    nome: "Patrícia Nunes",
    handle: "@pati.designer",
    bio: "Design de sobrancelhas.",
    cor: "#C4B5FD",
  },
  {
    id: "u6",
    nome: "Renata Souza",
    handle: "@re.massoterapia",
    bio: "Massoterapeuta.",
    cor: "#FCA5A5",
  },
  {
    id: "u7",
    nome: "Bianca Torres",
    handle: "@bia.trancista",
    bio: "Tranças e cuidados capilares afro.",
    cor: "#5EEAD4",
  },
  {
    id: "u8",
    nome: "Débora Lima",
    handle: "@debora.podologa",
    bio: "Podóloga.",
    cor: "#FDBA74",
  },
];

export const findUser = (id: string) => REDE_USERS.find((u) => u.id === id);

/** Bio mockada de "mim" — nome/avatar vêm do usuário real, só a bio é fixture. */
export const MY_BIO =
  "Prestando atendimento com carinho e organização todo dia 💛";

export const DISCOVER_PEOPLE: DiscoverPerson[] = [
  { userId: "u3", motivo: "5 amigas em comum" },
  { userId: "u8", motivo: "Perto de você" },
];

/** Buscas recentes mockadas — mostradas na Busca antes de digitar algo. */
export const RECENT_SEARCHES: string[] = [
  "Camila Duarte",
  "precificação",
  "box braids",
  "conquista",
];

export const LIVE_LINKS: LiveLink[] = [
  {
    id: "ll1",
    plataforma: "instagram",
    label: "Meu Instagram",
    url: "instagram.com/seuusuario",
    ativo: true,
    ordem: 0,
  },
  {
    id: "ll2",
    plataforma: "whatsapp",
    label: "Fale comigo no WhatsApp",
    url: "wa.me/5511999999999",
    ativo: true,
    ordem: 1,
  },
  {
    id: "ll3",
    plataforma: "agenda",
    label: "Agendar horário",
    url: "jobapp.app/agenda/voce",
    ativo: true,
    ordem: 2,
  },
  {
    id: "ll4",
    plataforma: "tiktok",
    label: "Meu TikTok",
    url: "tiktok.com/@seuusuario",
    ativo: false,
    ordem: 3,
  },
  {
    id: "ll5",
    plataforma: "site",
    label: "Site / portfólio",
    url: "seusite.com.br",
    ativo: false,
    ordem: 4,
  },
];
