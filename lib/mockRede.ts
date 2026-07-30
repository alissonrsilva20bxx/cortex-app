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

export interface Conversation {
  id: string;
  userId: string;
  ultimaMensagem: string;
  hora: string;
  naoLidas: number;
}

export interface RedeMessage {
  id: string;
  deMim: boolean;
  texto: string;
  hora: string;
  /** Só se aplica a mensagens minhas — ausente = já entregue (mock antigo). */
  status?: "sending" | "sent" | "error";
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

export interface RedeNotificacao {
  id: string;
  tipo:
    | "curtida"
    | "comentario"
    | "solicitacao"
    | "mencao"
    | "mensagem"
    | "aviso";
  /** Ausente em avisos da comunidade — não partem de uma pessoa específica. */
  userId?: string;
  texto: string;
  criadoEm: string;
  lida: boolean;
}

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

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

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    userId: "u1",
    ultimaMensagem: "Manda o link daquele curso?",
    hora: "09:41",
    naoLidas: 2,
  },
  {
    id: "c2",
    userId: "u2",
    ultimaMensagem: "Combinado! Te vejo sábado 💛",
    hora: "Ontem",
    naoLidas: 0,
  },
  {
    id: "c3",
    userId: "u7",
    ultimaMensagem: "Amei o resultado 😍",
    hora: "Seg",
    naoLidas: 1,
  },
  {
    id: "c4",
    userId: "u4",
    ultimaMensagem: "Vou fazer a promoção também, obrigada pela ideia!",
    hora: "Qui",
    naoLidas: 0,
  },
];

export const MESSAGES: Record<string, RedeMessage[]> = {
  c1: [
    {
      id: "m1",
      deMim: false,
      texto: "Oi! Vi seu post sobre precificação 👀",
      hora: "09:20",
    },
    {
      id: "m2",
      deMim: true,
      texto: "Oi Camila! Foi bom né, me ajudou a reorganizar os preços",
      hora: "09:25",
    },
    {
      id: "m3",
      deMim: false,
      texto: "Manda o link daquele curso?",
      hora: "09:41",
    },
  ],
  c2: [
    {
      id: "m4",
      deMim: false,
      texto: "Combinado! Te vejo sábado 💛",
      hora: "Ontem",
    },
  ],
  c3: [
    {
      id: "m5",
      deMim: true,
      texto: "Oi Bianca, terminei suas tranças hoje!",
      hora: "Seg",
    },
    { id: "m6", deMim: false, texto: "Amei o resultado 😍", hora: "Seg" },
  ],
  c4: [
    {
      id: "m7",
      deMim: false,
      texto: "Vou fazer a promoção também, obrigada pela ideia!",
      hora: "Qui",
    },
  ],
};

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

export const WISHLIST_ITEMS: WishlistItem[] = [
  {
    id: "w1",
    nome: "Cadeira hidráulica nova",
    cor: "#FF7AB6",
    valorAlvo: 1800,
    valorAtual: 1250,
    estado: "planejando",
    privacidade: "amigas",
  },
  {
    id: "w2",
    nome: "Curso de extensão de cílios",
    cor: "#7AA7FF",
    valorAlvo: 650,
    valorAtual: 650,
    estado: "conquistado",
    privacidade: "comunidade",
  },
  {
    id: "w3",
    nome: "Kit de esmaltes importados",
    cor: "#FFC24B",
    valorAlvo: 320,
    valorAtual: 80,
    estado: "quero",
    privacidade: "privado",
  },
  {
    id: "w4",
    nome: "Retiro de bem-estar de fim de semana",
    cor: "#6EE7B7",
    valorAlvo: 2200,
    valorAtual: 900,
    estado: "planejando",
    privacidade: "amigas",
  },
];

export const CLIENTES: Cliente[] = [
  {
    id: "cl1",
    nome: "Renata Ferreira",
    telefone: "(11) 98888-1234",
    status: "vip",
    etiquetas: ["fidelizada", "indicação"],
    ultimoContato: "2026-07-20",
    observacoes: "Prefere horário da manhã. Alérgica a acetona comum.",
  },
  {
    id: "cl2",
    nome: "Marcos Vinícius",
    telefone: "(11) 97777-2345",
    status: "ativo",
    etiquetas: ["quinzenal"],
    ultimoContato: "2026-07-18",
    observacoes: "Sempre confirma por WhatsApp um dia antes.",
  },
  {
    id: "cl3",
    nome: "Sônia Aparecida",
    telefone: "(11) 96666-3456",
    status: "em-negociacao",
    etiquetas: ["pacote fechado?"],
    ultimoContato: "2026-07-15",
    observacoes: "Pediu orçamento de pacote mensal, aguardando resposta.",
  },
  {
    id: "cl4",
    nome: "Igor Salles",
    telefone: "(11) 95555-4567",
    status: "pausado",
    etiquetas: ["viagem"],
    ultimoContato: "2026-06-30",
    observacoes: "Viajou a trabalho, volta a agendar em agosto.",
  },
  {
    id: "cl5",
    nome: "Helena Brito",
    telefone: "(11) 94444-5678",
    status: "vip",
    etiquetas: ["fidelizada"],
    ultimoContato: "2026-07-22",
    observacoes: "Cliente desde o começo. Sempre traz indicação nova.",
  },
];

export const REDE_NOTIFICACOES: RedeNotificacao[] = [
  {
    id: "n1",
    tipo: "curtida",
    userId: "u1",
    texto: "curtiu sua publicação",
    criadoEm: hoursAgo(1),
    lida: false,
  },
  {
    id: "n2",
    tipo: "comentario",
    userId: "u7",
    texto: 'comentou: "Arrasou!! 👏"',
    criadoEm: hoursAgo(4),
    lida: false,
  },
  {
    id: "n3",
    tipo: "solicitacao",
    userId: "u5",
    texto: "quer ser sua amiga",
    criadoEm: daysAgo(1),
    lida: true,
  },
  {
    id: "n4",
    tipo: "mencao",
    userId: "u4",
    texto: "mencionou você nos comentários",
    criadoEm: daysAgo(2),
    lida: true,
  },
  {
    id: "n5",
    tipo: "mensagem",
    userId: "u2",
    texto: "te enviou uma mensagem",
    criadoEm: hoursAgo(6),
    lida: false,
  },
  {
    id: "n6",
    tipo: "aviso",
    texto:
      "Novidade: agora dá pra reordenar seus LiveLinks direto do Meu Espaço.",
    criadoEm: daysAgo(3),
    lida: true,
  },
];
