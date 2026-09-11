import type { MockSupabaseSeed } from "./mockSupabase";
import type { Usuario } from "./types";

export const MOCK_APP_USER_ID = "mock-app-user";

export const MOCK_APP_USUARIO: Usuario = {
  id: MOCK_APP_USER_ID,
  nome: "Miguel",
  email: "miguel@exemplo.com",
};

const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

const hoursAgoIso = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

/** Semente completa do "banco" mockado — chamada uma vez ao ativar o shell,
 * assim cada sessão de preview começa do mesmo estado "vivido". */
export function buildMockAppSeed(): MockSupabaseSeed {
  const uid = MOCK_APP_USER_ID;

  const jobs = [
    {
      id: "job-1",
      user_id: uid,
      cliente_nome: "Renata Ferreira",
      data: daysFromNow(2),
      hora: "14:00",
      valor: 180,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
    },
    {
      id: "job-2",
      user_id: uid,
      cliente_nome: "Marcos Vinícius",
      data: daysFromNow(5),
      hora: "10:30",
      valor: 220,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "confirmado",
      observacoes: "Confirma sempre por WhatsApp um dia antes.",
      criado_em: daysFromNow(-2),
    },
    {
      id: "job-3",
      user_id: uid,
      cliente_nome: "Patrícia Nunes",
      data: daysFromNow(12),
      hora: "09:30",
      valor: 300,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
    },
    {
      id: "job-4",
      user_id: uid,
      cliente_nome: "Sônia Aparecida",
      data: daysFromNow(-3),
      hora: "16:00",
      valor: 150,
      modalidade: "online",
      local: null,
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-4),
    },
    {
      id: "job-5",
      user_id: uid,
      cliente_nome: "Helena Brito",
      data: daysFromNow(-10),
      hora: "09:00",
      valor: 280,
      modalidade: "presencial",
      local: "Casa da cliente",
      status: "concluído",
      observacoes: "Cliente desde o começo, sempre indica gente nova.",
      criado_em: daysFromNow(-11),
    },
    {
      id: "job-6",
      user_id: uid,
      cliente_nome: "Igor Salles",
      data: daysFromNow(-20),
      hora: "11:00",
      valor: 95,
      modalidade: "online",
      local: null,
      status: "cancelado",
      observacoes: "Cliente viajou a trabalho.",
      criado_em: daysFromNow(-22),
    },
    {
      id: "job-7",
      user_id: uid,
      cliente_nome: "Camila Duarte",
      data: daysFromNow(-30),
      hora: "15:30",
      valor: 320,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-31),
    },
    {
      id: "job-8",
      user_id: uid,
      cliente_nome: "Ana Souza",
      data: daysFromNow(-45),
      hora: "13:00",
      valor: 175,
      modalidade: "online",
      local: null,
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-46),
    },
    {
      id: "job-9",
      user_id: uid,
      cliente_nome: "Bianca Torres",
      data: daysFromNow(-60),
      hora: "10:00",
      valor: 260,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-61),
    },
    {
      id: "job-10",
      user_id: uid,
      cliente_nome: "Débora Lima",
      data: daysFromNow(-75),
      hora: "17:00",
      valor: 140,
      modalidade: "online",
      local: null,
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-76),
    },
  ];

  const metas = [
    { id: "meta-dia", user_id: uid, periodo: "dia", valor_alvo: 300 },
    { id: "meta-mes", user_id: uid, periodo: "mes", valor_alvo: 3500 },
    { id: "meta-ano", user_id: uid, periodo: "ano", valor_alvo: 40000 },
  ];

  const despesas = [
    {
      id: "desp-1",
      user_id: uid,
      descricao: "Esmaltes e produtos",
      valor: 120,
      categoria: "equipamentos",
      data: daysFromNow(-5),
      criado_em: daysFromNow(-5),
    },
    {
      id: "desp-2",
      user_id: uid,
      descricao: "Uber pra atendimento",
      valor: 35,
      categoria: "transporte",
      data: daysFromNow(-2),
      criado_em: daysFromNow(-2),
    },
    {
      id: "desp-3",
      user_id: uid,
      descricao: "Impulsionar post no Instagram",
      valor: 50,
      categoria: "marketing",
      data: daysFromNow(-8),
      criado_em: daysFromNow(-8),
    },
    {
      id: "desp-4",
      user_id: uid,
      descricao: "Alicate de cutícula novo",
      valor: 80,
      categoria: "ferramentas",
      data: daysFromNow(-15),
      criado_em: daysFromNow(-15),
    },
    {
      id: "desp-5",
      user_id: uid,
      descricao: "Almoço entre atendimentos",
      valor: 28,
      categoria: "alimentacao",
      data: daysFromNow(-1),
      criado_em: daysFromNow(-1),
    },
  ];

  const receitas_avulsas = [
    {
      id: "rec-1",
      user_id: uid,
      descricao: "Venda de kit de esmaltes",
      valor: 60,
      categoria: "outros",
      data: daysFromNow(-4),
      criado_em: daysFromNow(-4),
    },
    {
      id: "rec-2",
      user_id: uid,
      descricao: "Comissão de indicação",
      valor: 40,
      categoria: "outros",
      data: daysFromNow(-9),
      criado_em: daysFromNow(-9),
    },
  ];

  const objetivos = [
    {
      id: "obj-1",
      user_id: uid,
      titulo: "Fazer curso de extensão de cílios",
      descricao: null,
      categoria: "financeiro",
      concluido: false,
      criado_em: daysFromNow(-6),
    },
    {
      id: "obj-2",
      user_id: uid,
      titulo: "Organizar a agenda da semana",
      descricao: null,
      categoria: "afazeres",
      concluido: true,
      criado_em: daysFromNow(-10),
    },
    {
      id: "obj-3",
      user_id: uid,
      titulo: "Beber mais água durante os atendimentos",
      descricao: null,
      categoria: "saude",
      concluido: false,
      criado_em: daysFromNow(-3),
    },
    {
      id: "obj-4",
      user_id: uid,
      titulo: "Tirar um fim de semana de folga",
      descricao: null,
      categoria: "vida",
      concluido: false,
      criado_em: daysFromNow(-14),
    },
  ];

  const notas = [
    {
      id: "nota-1",
      user_id: uid,
      conteudo:
        "Renata prefere atendimento de manhã. Levar removedor extra no próximo atendimento da Sônia.",
      criado_em: daysFromNow(-7),
      atualizado_em: daysFromNow(-2),
    },
  ];

  // ── Rede: semente mínima pra a aba abrir no Feed (não no gate) em
  // /dev-preview/app -- convite já resgatado + perfil + alguns posts. Sem
  // isso o RedeGatedTab cai sempre na vitrine e o Feed fica intestável no
  // shell mockado. Fotos ficam de fora (exigiriam blobs no bucket).
  const FRIEND_ID = "mock-friend-marina";
  const rede_convites = [
    {
      id: "convite-mock-1",
      codigo_hash: "mock-hash",
      criado_em: daysFromNow(-20),
      expira_em: daysFromNow(60),
      solicitacao_id: null,
      usado_em: daysFromNow(-18),
      usado_por: uid,
    },
  ];
  const rede_perfis = [
    {
      user_id: uid,
      nome_exibicao: "Miguel",
      cor_avatar: "#8b5cf6",
      bio: "Nail designer • Studio Zona Sul",
      avatar_url: null,
      area_atuacao: "Unhas",
      criado_em: daysFromNow(-18),
      atualizado_em: daysFromNow(-2),
    },
    {
      user_id: FRIEND_ID,
      nome_exibicao: "Marina Alves",
      cor_avatar: "#ec4899",
      bio: "Extensão de cílios",
      avatar_url: null,
      area_atuacao: "Cílios",
      criado_em: daysFromNow(-30),
      atualizado_em: daysFromNow(-5),
    },
  ];
  const rede_posts = [
    {
      id: "rede-post-1",
      autor_id: uid,
      categoria: "conquista",
      texto: "Fechei a agenda da semana inteira! 🎉",
      criado_em: hoursAgoIso(3),
      atualizado_em: hoursAgoIso(3),
    },
    {
      id: "rede-post-2",
      autor_id: FRIEND_ID,
      categoria: "dica",
      texto: "Dica: cliente que remarca demais, cobra sinal antecipado.",
      criado_em: hoursAgoIso(26),
      atualizado_em: hoursAgoIso(26),
    },
    {
      id: "rede-post-3",
      autor_id: uid,
      categoria: "geral",
      texto: "Alguém indica fornecedor de insumo bom na região?",
      criado_em: hoursAgoIso(52),
      atualizado_em: hoursAgoIso(52),
    },
  ];
  // 1 foto no post 1 -- exercita a re-assinatura sob demanda no cold start
  // (o cache persistido não guarda URL assinada). Dimensões no nome da
  // miniatura (3:4 retrato). Os blobs caem no placeholder SVG do mock.
  const fotoPath = `${uid}/posts/rede-post-1/1.jpg`;
  const fotoThumbPath = `${uid}/posts/rede-post-1/1-thumb-1080x1350.jpg`;
  const rede_post_fotos = [
    {
      id: "rede-foto-1",
      post_id: "rede-post-1",
      autor_id: uid,
      path: fotoPath,
      thumb_path: fotoThumbPath,
      ordem: 1,
      criado_em: hoursAgoIso(3),
    },
  ];
  const rede_curtidas = [
    { post_id: "rede-post-2", user_id: uid, criado_em: hoursAgoIso(20) },
    { post_id: "rede-post-1", user_id: FRIEND_ID, criado_em: hoursAgoIso(2) },
  ];
  const rede_comentarios = [
    {
      id: "rede-com-1",
      post_id: "rede-post-1",
      autor_id: FRIEND_ID,
      texto: "Arrasou!",
      criado_em: hoursAgoIso(2),
    },
  ];

  const configuracoes = [
    {
      id: "config-1",
      user_id: uid,
      tema: "grafite",
      pin_hash: null,
      trial_started_at: daysFromNow(-3),
      assinatura_status: "trial",
    },
  ];

  const cofreFiles = [
    {
      path: `${uid}/comprovantes/recibo-renata-ferreira.jpg`,
      name: "recibo-renata-ferreira.jpg",
      categoria: "comprovantes",
      size: 245_000,
      mimeType: "image/jpeg",
      createdAt: daysFromNow(-3),
    },
    {
      path: `${uid}/comprovantes/recibo-camila-duarte.jpg`,
      name: "recibo-camila-duarte.jpg",
      categoria: "comprovantes",
      size: 198_000,
      mimeType: "image/jpeg",
      createdAt: daysFromNow(-30),
    },
    {
      path: `${uid}/conversas/print-combinado-marcos.png`,
      name: "print-combinado-marcos.png",
      categoria: "conversas",
      size: 312_000,
      mimeType: "image/png",
      createdAt: daysFromNow(-5),
    },
    {
      path: `${uid}/documentos/contrato-parceria-studio.pdf`,
      name: "contrato-parceria-studio.pdf",
      categoria: "documentos",
      size: 540_000,
      mimeType: "application/pdf",
      createdAt: daysFromNow(-40),
    },
    {
      path: `${uid}/pessoal/lembrete-consulta.jpg`,
      name: "lembrete-consulta.jpg",
      categoria: "pessoal",
      size: 88_000,
      mimeType: "image/jpeg",
      createdAt: daysFromNow(-12),
    },
    // Foto do rede-post-1 (principal + miniatura) -- sem blobUrl, o mock
    // serve o placeholder SVG; o que importa é o path existir pra assinar.
    {
      path: fotoPath,
      name: "1.jpg",
      categoria: "rede",
      size: 320_000,
      mimeType: "image/jpeg",
      createdAt: hoursAgoIso(3),
    },
    {
      path: fotoThumbPath,
      name: "1-thumb-1080x1350.jpg",
      categoria: "rede",
      size: 24_000,
      mimeType: "image/jpeg",
      createdAt: hoursAgoIso(3),
    },
  ];

  return {
    tables: {
      jobs,
      metas,
      despesas,
      receitas_avulsas,
      objetivos,
      notas,
      configuracoes,
      push_subscriptions: [],
      rede_convites,
      rede_perfis,
      rede_posts,
      rede_curtidas,
      rede_comentarios,
      rede_post_fotos,
      rede_livelinks: [],
      rede_wishlist: [],
      rede_clientes: [],
      rede_amizades: [],
      rede_conversas: [],
      rede_conversas_participantes: [],
      rede_mensagens: [],
    },
    cofreFiles,
  };
}
