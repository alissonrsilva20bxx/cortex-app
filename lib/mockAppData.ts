import type { MockSupabaseSeed } from "./mockSupabase";
import type { Usuario } from "./types";
import { fotoExemploUri, type TemaFoto } from "./mockFotosRede";

export const MOCK_APP_USER_ID = "mock-app-user";

export const MOCK_APP_USUARIO: Usuario = {
  id: MOCK_APP_USER_ID,
  nome: "Miguel",
  email: "miguel@exemplo.com",
  telefone: "(11) 98765-4321",
};

const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

/**
 * As 4 amigas da fileira do topo da Rede, como a referência as desenha
 * (`5-telas-8-temas-claro-escuro.html`, tela Rede): nome, inicial e cor do
 * avatar. São dados de laboratório -- no app de verdade vêm do servidor.
 */
const AMIGAS_DA_REFERENCIA = [
  { id: "mock-amiga-1", nome: "Amiga 1", cor: "#c7b8f5" },
  { id: "mock-amiga-2", nome: "Amiga 2", cor: "#f7c6a3" },
  { id: "mock-amiga-3", nome: "Amiga 3", cor: "#b8e3d0" },
  { id: "mock-amiga-4", nome: "Amiga 4", cor: "#bcd3f5" },
];

const hoursAgoIso = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

/** Semente completa do "banco" mockado — chamada uma vez ao ativar o shell,
 * assim cada sessão de preview começa do mesmo estado "vivido".
 *
 * `opts.objetivosCount` existe só pra diagnóstico de layout (achado da
 * validação real de #131: vão de ~110-130px entre NextJobCard e
 * ObjetivosCard no Preview real) — reproduz os estados 0/1/vários
 * objetivos sem precisar de conta real nem de apagar dados um por um
 * pela UI (que só marca concluído, nunca remove). `undefined` mantém o
 * comportamento de sempre (todos os 4). */
export function buildMockAppSeed(opts?: {
  objetivosCount?: number;
}): MockSupabaseSeed {
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
      // Pixel (mockup Início/Agenda): "14h00 · Studio Miguel".
      local: "Studio Miguel",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
    },
    {
      id: "job-2",
      user_id: uid,
      // Pixel (mockup "Próximos atendimentos"): "Juliana Prado · Seg 28 ·
      // 09h00 · R$ 150" e os 5 seguintes, iguais aos do mockup.
      cliente_nome: "Juliana Prado",
      data: daysFromNow(5),
      hora: "09:00",
      valor: 150,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "confirmado",
      observacoes: "Confirma sempre por WhatsApp um dia antes.",
      criado_em: daysFromNow(-2),
    },
    {
      id: "job-3",
      user_id: uid,
      cliente_nome: "Beatriz Lima",
      data: daysFromNow(6),
      hora: "15:30",
      valor: 200,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
    },
    {
      id: "job-4",
      user_id: uid,
      cliente_nome: "Camila Duarte",
      data: daysFromNow(-3),
      hora: "10:00",
      valor: 120,
      modalidade: "presencial",
      local: "Studio Miguel",
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-4),
      // Pagou adiantado: no Financeiro entra em 17/09 (mockup), na Agenda
      // o atendimento continua no domingo 20/09 (mockup da Agenda).
      pago_em: daysFromNow(-6),
    },
    {
      id: "job-5",
      user_id: uid,
      cliente_nome: "Helena Brito",
      data: daysFromNow(-10),
      hora: "09:00",
      valor: 200,
      modalidade: "presencial",
      local: "Casa da cliente",
      status: "concluído",
      observacoes: "Cliente desde o começo, sempre indica gente nova.",
      criado_em: daysFromNow(-11),
      // Pagou em agosto (sinal): fatura em setembro, entrou no caixa em
      // agosto.
      pago_em: daysFromNow(-24),
    },
    {
      id: "job-15",
      user_id: uid,
      cliente_nome: "Renata Ferreira",
      data: daysFromNow(-9),
      hora: "15:00",
      valor: 110,
      modalidade: "presencial",
      local: "Studio Miguel",
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-12),
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
      cliente_nome: "Sônia Aparecida",
      data: daysFromNow(-30),
      hora: "15:30",
      valor: 150,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-31),
      // Os dois atendimentos de agosto da Sônia foram pagos juntos em 20/09
      // (as duas linhas "Sônia Aparecida +R$ 150" do mockup do Financeiro).
      pago_em: daysFromNow(-3),
    },
    {
      id: "job-16",
      user_id: uid,
      cliente_nome: "Sônia Aparecida",
      data: daysFromNow(-37),
      hora: "15:30",
      valor: 150,
      modalidade: "presencial",
      local: "Studio Miguel — Zona Sul",
      status: "concluído",
      observacoes: null,
      criado_em: daysFromNow(-38),
      pago_em: daysFromNow(-3),
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
    {
      id: "job-11",
      user_id: uid,
      cliente_nome: "Larissa Costa",
      data: daysFromNow(7),
      hora: "11:00",
      valor: 120,
      modalidade: "presencial",
      local: "Studio Miguel",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
    },
    {
      id: "job-12",
      user_id: uid,
      cliente_nome: "Fernanda Rocha",
      data: daysFromNow(8),
      hora: "16:00",
      valor: 180,
      modalidade: "presencial",
      local: "Studio Miguel",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
    },
    {
      id: "job-13",
      user_id: uid,
      cliente_nome: "Paula Mendes",
      data: daysFromNow(9),
      hora: "10:00",
      valor: 220,
      modalidade: "presencial",
      local: "Studio Miguel",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
    },
    {
      id: "job-14",
      user_id: uid,
      cliente_nome: "Carla Nunes",
      data: daysFromNow(10),
      hora: "13:00",
      valor: 160,
      modalidade: "presencial",
      local: "Studio Miguel",
      status: "agendado",
      observacoes: null,
      criado_em: daysFromNow(-1),
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
      // Pixel (mockup Financeiro A): "Material de trabalho -R$ 64, 18 set."
      descricao: "Material de trabalho",
      valor: 64,
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
      // Pixel (mockup): "Estacionamento -R$ 18, 16 set."
      descricao: "Estacionamento",
      valor: 18,
      categoria: "transporte",
      data: daysFromNow(-7),
      criado_em: daysFromNow(-7),
    },
    {
      id: "desp-4",
      user_id: uid,
      // Pixel: o mockup conta 6 saídas somando R$ 313 e mostra 5; esta é
      // a 6ª (valor que fecha a soma, fora da tela).
      descricao: "Alicate de cutícula novo",
      valor: 69,
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

  // Pixel (mockup): "Internet -R$ 99, 10 set."
  despesas.push({
    id: "desp-6",
    user_id: uid,
    descricao: "Internet",
    valor: 99,
    categoria: "internet",
    data: daysFromNow(-13),
    criado_em: daysFromNow(-13),
  });

  const receitas_avulsas = [
    {
      id: "rec-1",
      user_id: uid,
      descricao: "Venda de kit de esmaltes",
      valor: 80,
      categoria: "outros",
      // Agosto: setembro só tem os 4 lançamentos de entrada do mockup do
      // Financeiro, e agosto fecha o "-56% vs agosto".
      data: daysFromNow(-26),
      criado_em: daysFromNow(-26),
    },
    {
      id: "rec-2",
      user_id: uid,
      descricao: "Comissão de indicação",
      valor: 40,
      categoria: "outros",
      data: daysFromNow(-35),
      criado_em: daysFromNow(-35),
    },
  ];

  const objetivosAll = [
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
  const objetivos = objetivosAll.slice(
    0,
    opts?.objetivosCount ?? objetivosAll.length
  );

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
    // As 4 da fileira da referência (tela Rede): mesmo nome, mesma inicial
    // e a mesma cor de avatar que ela desenha.
    {
      user_id: "mock-amiga-juliana",
      nome_exibicao: "Juliana",
      cor_avatar: "#f59e0b",
      bio: "",
      avatar_url: null,
      area_atuacao: "",
      criado_em: daysFromNow(-26),
      atualizado_em: daysFromNow(-3),
    },
    ...AMIGAS_DA_REFERENCIA.map((a, i) => ({
      user_id: a.id,
      nome_exibicao: a.nome,
      cor_avatar: a.cor,
      bio: "",
      avatar_url: null,
      area_atuacao: "",
      criado_em: daysFromNow(-29 + i),
      atualizado_em: daysFromNow(-4),
    })),
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
    // Sem relação nenhuma com você: aparecem em "Descobrir" (Pessoas para
    // conhecer), como na proposta "Três abas".
    {
      user_id: "mock-descobrir-rita",
      nome_exibicao: "Rita Melo",
      cor_avatar: "#f0c4a8",
      bio: "Cílios · Setúbal",
      avatar_url: null,
      area_atuacao: "Cílios",
      criado_em: daysFromNow(-12),
      atualizado_em: daysFromNow(-1),
    },
    {
      user_id: "mock-descobrir-nina",
      nome_exibicao: "Nina Paz",
      cor_avatar: "#c3eab4",
      bio: "Estética · Lisboa",
      avatar_url: null,
      area_atuacao: "Estética",
      criado_em: daysFromNow(-9),
      atualizado_em: daysFromNow(-1),
    },
  ];
  // 15 posts -- o suficiente pra exercitar a paginação do feed
  // (FEED_PAGE_SIZE = 10: página 1 cheia + página 2 com resto, `hasMore`
  // vira false só na 2ª). `criado_em` estritamente decrescente pra o cursor
  // `.lt("criado_em", ...)` de `loadMorePosts` não pular nem repetir.
  const P: Array<{
    id: string;
    autor: string;
    categoria: string;
    texto: string;
    h: number;
  }> = [
    {
      id: "rede-post-1",
      autor: uid,
      categoria: "conquista",
      texto: "Fechei a agenda da semana inteira! 🎉",
      h: 3,
    },
    // 2º artigo da referência: Juliana, há 5h.
    {
      id: "rede-post-4",
      autor: "mock-amiga-juliana",
      categoria: "conquista",
      texto: "Antes e depois da cliente de hoje 💅 deslizem pro lado",
      h: 5,
    },
    {
      id: "rede-post-5",
      autor: FRIEND_ID,
      categoria: "dica",
      texto:
        "Quem trabalha sozinha: bloco de 15min entre clientes salva o dia.",
      h: 12,
    },
    {
      id: "rede-post-6",
      autor: uid,
      categoria: "duvida",
      texto: "Vale a pena migrar pra cabine própria ou continuo alugando?",
      h: 18,
    },
    {
      id: "rede-post-2",
      autor: FRIEND_ID,
      categoria: "dica",
      texto: "Dica: cliente que remarca demais, cobra sinal antecipado.",
      h: 26,
    },
    {
      id: "rede-post-7",
      autor: FRIEND_ID,
      categoria: "desabafo",
      texto: "Semana puxada, três no-show seguidos. Amanhã é outro dia.",
      h: 34,
    },
    {
      id: "rede-post-8",
      autor: uid,
      categoria: "conquista",
      texto: "Primeira cliente que veio por indicação da Rede! 🥹",
      h: 42,
    },
    {
      id: "rede-post-3",
      autor: uid,
      categoria: "geral",
      texto: "Alguém indica fornecedor de insumo bom na região?",
      h: 52,
    },
    {
      id: "rede-post-9",
      autor: FRIEND_ID,
      categoria: "dica",
      texto: "Planilha de custo por serviço mudou meu preço. Recomendo fazer.",
      h: 60,
    },
    {
      id: "rede-post-10",
      autor: uid,
      categoria: "geral",
      texto: "Playlist boa pro studio? Tô cansada da minha.",
      h: 72,
    },
    {
      id: "rede-post-11",
      autor: FRIEND_ID,
      categoria: "conquista",
      texto: "Bati a meta do mês faltando uma semana!",
      h: 90,
    },
    {
      id: "rede-post-12",
      autor: uid,
      categoria: "duvida",
      texto: "Como vocês lidam com cliente que pede desconto toda vez?",
      h: 110,
    },
    {
      id: "rede-post-13",
      autor: FRIEND_ID,
      categoria: "dica",
      texto: "Foto de portfólio: luz da janela > ringlight, sempre.",
      h: 130,
    },
    {
      id: "rede-post-14",
      autor: uid,
      categoria: "desabafo",
      texto:
        "Dia difícil. Obrigada a quem responde aqui, ajuda mais do que parece.",
      h: 160,
    },
    {
      id: "rede-post-15",
      autor: FRIEND_ID,
      categoria: "geral",
      texto: "Alguém mais de Zona Sul? Bora marcar um café.",
      h: 190,
    },
  ];
  const rede_posts = P.map((p) => ({
    id: p.id,
    autor_id: p.autor,
    categoria: p.categoria,
    texto: p.texto,
    criado_em: hoursAgoIso(p.h),
    atualizado_em: hoursAgoIso(p.h),
  }));

  // Fotos de exemplo (lib/mockFotosRede.ts): desenho SVG local no tamanho
  // NATIVO da foto, servido como a "URL assinada" do Storage mockado. As
  // dimensões vão no nome da miniatura (`-thumb-{L}x{A}.jpg`), como a rota
  // real grava, e é por elas que o feed escolhe o formato (proposta "Três
  // abas": 4:5, 1:1, 16:9 ou 1,91:1). No máximo 2 fotos por post, o teto do
  // banco (`ordem in (1,2)`, migration 0028).
  //  - post-1: retrato 4:5 (1080×1350);
  //  - post-4: carrossel antes/depois, as duas 4:5 -- e a memória de slide
  //    (`redeCache.lembrarSlide`) entre remounts;
  //  - post-8: carrossel 1:1 + uma 16:9, que aparece inteira com o fundo
  //    desfocado (outra proporção que a do quadro);
  //  - post-6: paisagem 16:9; post-3: paisagem 1,91:1; post-13: dica 1:1;
  //  - post-9: 3:4, recortada para 4:5 (só as bordas saem);
  //  - post-11: 9:16, fora dos formatos -- vai para 4:5 e aparece inteira
  //    (o recorte tiraria a área segura).
  const foto = (
    postId: string,
    autor: string,
    ordem: number,
    tema: TemaFoto,
    largura: number,
    altura: number,
    h: number
  ) => {
    const tw = 480;
    const th = Math.round((tw * altura) / largura);
    const dims = `${tw}x${th}`;
    const path = `${autor}/posts/${postId}/${ordem}.jpg`;
    const thumb_path = `${autor}/posts/${postId}/${ordem}-thumb-${dims}.jpg`;
    return {
      row: {
        id: `rede-foto-${postId}-${ordem}`,
        post_id: postId,
        autor_id: autor,
        path,
        thumb_path,
        ordem,
        criado_em: hoursAgoIso(h),
      },
      files: [
        {
          path,
          name: `${ordem}.jpg`,
          categoria: "rede",
          size: 320_000,
          mimeType: "image/jpeg",
          createdAt: hoursAgoIso(h),
          blobUrl: fotoExemploUri(tema, largura, altura),
        },
        {
          path: thumb_path,
          name: `${ordem}-thumb-${dims}.jpg`,
          categoria: "rede",
          size: 24_000,
          mimeType: "image/jpeg",
          createdAt: hoursAgoIso(h),
          blobUrl: fotoExemploUri(tema, tw, th),
        },
      ],
    };
  };
  const fotosDef = [
    foto("rede-post-1", uid, 1, "unhas", 1080, 1350, 3),
    foto("rede-post-4", "mock-amiga-juliana", 1, "antes", 1080, 1350, 5),
    foto("rede-post-4", "mock-amiga-juliana", 2, "depois", 1080, 1350, 5),
    foto("rede-post-6", uid, 1, "studio", 1920, 1080, 18),
    foto("rede-post-8", uid, 1, "cabelo", 1080, 1080, 42),
    foto("rede-post-8", uid, 2, "studio", 1920, 1080, 42),
    foto("rede-post-3", uid, 1, "studio", 1910, 1000, 52),
    foto("rede-post-9", FRIEND_ID, 1, "cores", 1080, 1440, 60),
    foto("rede-post-11", FRIEND_ID, 1, "depois", 1080, 1920, 90),
    foto("rede-post-13", FRIEND_ID, 1, "unhas", 1080, 1080, 130),
  ];
  const rede_post_fotos = fotosDef.map((f) => f.row);
  // 12 curtidas no 1º post e 8 no 2º: é o que a referência imprime.
  const curtidoras = [
    FRIEND_ID,
    "mock-amiga-juliana",
    ...AMIGAS_DA_REFERENCIA.map((a) => a.id),
  ];
  const curtidasDe = (postId: string, quantas: number) =>
    Array.from({ length: quantas }, (_, i) => ({
      post_id: postId,
      user_id:
        i < curtidoras.length ? curtidoras[i] : `mock-curtidora-${postId}-${i}`,
      criado_em: hoursAgoIso(2 + i),
    }));
  const rede_curtidas = [
    { post_id: "rede-post-2", user_id: uid, criado_em: hoursAgoIso(20) },
    ...curtidasDe("rede-post-1", 12),
    ...curtidasDe("rede-post-4", 8),
    // Descobrir lista as dicas da semana das mais curtidas para as menos.
    ...curtidasDe("rede-post-13", 6),
    ...curtidasDe("rede-post-9", 4),
    ...curtidasDe("rede-post-5", 2),
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

  // Os 5 arquivos são os da referência (tela Cofre, layout C): mesmo nome,
  // mesma categoria, mesmo tamanho impresso e mesma data. Com o relógio em
  // 23/09/2026, "Recentes" (os 4 mais novos) sai exatamente como a tela
  // desenhada. O 5º existe para o contador do card bater com os "5
  // arquivos" da referência -- e o tamanho dele é o que falta para o total
  // fechar em "1,3 MB", porque a soma dos tamanhos que a própria referência
  // imprime não dá esse total (contradição dela, listada no PR).
  const cofreFiles = [
    {
      path: `${uid}/comprovantes/recibo-renata-ferreira.jpg`,
      name: "recibo-renata-ferreira.jpg",
      categoria: "comprovantes",
      size: 244_736, // 239 KB
      mimeType: "image/jpeg",
      createdAt: daysFromNow(-4), // 19 de set.
    },
    {
      path: `${uid}/conversas/print-combinado-marcos.png`,
      name: "print-combinado-marcos.png",
      categoria: "conversas",
      size: 312_320, // 305 KB
      mimeType: "image/png",
      createdAt: daysFromNow(-6), // 17 de set.
    },
    {
      path: `${uid}/pessoal/lembrete-consulta.jpg`,
      name: "lembrete-consulta.jpg",
      categoria: "pessoal",
      size: 88_064, // 86 KB
      mimeType: "image/jpeg",
      createdAt: daysFromNow(-13), // 10 de set.
    },
    {
      path: `${uid}/comprovantes/recibo-camila-duarte.jpg`,
      name: "recibo-camila-duarte.jpg",
      categoria: "comprovantes",
      size: 197_632, // 193 KB
      mimeType: "image/jpeg",
      createdAt: daysFromNow(-31), // 23 de ago.
    },
    {
      path: `${uid}/pessoal/rg-frente.jpg`,
      name: "rg-frente.jpg",
      categoria: "pessoal",
      size: 520_000, // fecha o total do card em 1,3 MB
      mimeType: "image/jpeg",
      createdAt: daysFromNow(-43), // 11 de ago.
    },
    // Fotos dos posts da Rede (principal + miniatura) -- sem blobUrl, o
    // mock serve o placeholder SVG; o que importa é o path existir p/ assinar.
    ...fotosDef.flatMap((f) => f.files),
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
      // Um pedido de amizade pendente (Marina → você) pra exercitar o
      // fluxo de responder: card no perfil, aba Solicitações, banner do feed.
      rede_amizades: [
        // Marina aceita (era "pendente": a solicitação em aberto fazia
        // nascer um bloco que a referência não tem, acima da dobra).
        // Marina é a amizade MAIS ANTIGA de propósito: a fileira do topo
        // mostra as mais recentes primeiro, e a referência desenha as 4
        // "Amiga N" nas quatro primeiras posições. Marina fica depois
        // delas, alcançável deslizando.
        ...AMIGAS_DA_REFERENCIA.map((a, i) => ({
          id: `mock-amizade-${a.id}`,
          solicitante_id: a.id,
          destinatario_id: uid,
          status: "aceita",
          criado_em: daysFromNow(-28 + i),
          respondido_em: daysFromNow(-27 + i),
        })),
        {
          id: "mock-amizade-juliana",
          solicitante_id: "mock-amiga-juliana",
          destinatario_id: uid,
          status: "aceita",
          criado_em: daysFromNow(-26),
          respondido_em: daysFromNow(-25),
        },
        {
          id: "mock-amizade-marina",
          solicitante_id: FRIEND_ID,
          destinatario_id: uid,
          status: "aceita",
          criado_em: daysFromNow(-60),
          respondido_em: daysFromNow(-59),
        },
      ],
      rede_conversas: [],
      rede_conversas_participantes: [],
      rede_mensagens: [],
    },
    cofreFiles,
  };
}

/**
 * `?financeiro=vazio|so-entradas|so-saidas` do laboratório (só diagnóstico,
 * mesmo padrão do `?objetivos=`): monta o mês do Financeiro sem nada, só
 * com entradas ou só com saídas, para ver a barra entrou x saiu do "Saldo
 * do mês" nos 3 estados. Entradas = atendimentos concluídos + receitas
 * avulsas; saídas = despesas. Sem o parâmetro, a semente de sempre.
 */
export type CasoFinanceiro = "vazio" | "so-entradas" | "so-saidas";

export function ehCasoFinanceiro(x: unknown): x is CasoFinanceiro {
  return x === "vazio" || x === "so-entradas" || x === "so-saidas";
}

export function aplicarCasoFinanceiro(
  seed: MockSupabaseSeed,
  caso: CasoFinanceiro | null
): MockSupabaseSeed {
  if (!caso) return seed;
  const t = seed.tables;
  const semEntradas = caso === "vazio" || caso === "so-saidas";
  const semSaidas = caso === "vazio" || caso === "so-entradas";
  return {
    ...seed,
    tables: {
      ...t,
      jobs: semEntradas
        ? (t.jobs ?? []).filter((j) => j.status !== "concluído")
        : t.jobs,
      receitas_avulsas: semEntradas ? [] : t.receitas_avulsas,
      despesas: semSaidas ? [] : t.despesas,
    },
  };
}
