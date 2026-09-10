"use client";

import { useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { RedeTab } from "@/components/rede/RedeTab";
import { mockUsuario } from "@/lib/mock";
import { __setMockSupabaseClient } from "@/lib/supabase";
import { createMockSupabaseClient } from "@/lib/mockSupabase";
import type { TabId } from "@/lib/types";

/**
 * Preview isolado da Rede, sem depender de login/Supabase — rota temporária
 * de dev (exempta no middleware via prefixo /dev-preview), não faz parte
 * do app real. Sem chrome de dev: tema/modo seguem os já salvos em
 * localStorage pelo resto do app (Ajustes), como qualquer outra tela.
 */

/** URL da rota-fixture `/dev-preview/foto` -- imagem REAL via rede (não
 * `data:` URI), pra o painel Network mostrar o que o feed baixa de fato e
 * quando (`loading="lazy"` só adia recursos buscáveis, não `data:`). O
 * mock de Storage devolve este `blobUrl` em `createSignedUrls`. */
function fotoMock(w: number, h: number, rotulo: string, c: string): string {
  const cor = c.replace("#", "");
  return `/dev-preview/foto?w=${w}&h=${h}&c=${cor}&t=${encodeURIComponent(rotulo)}`;
}

/** Uma "foto" seedada: linha de rede_post_fotos + 2 arquivos no mock de
 * Storage (principal + miniatura). Se `dims` for true, o nome da miniatura
 * carrega LARGURA×ALTURA (fotos novas); senão simula foto legada. */
function seedFoto(
  autorId: string,
  postId: string,
  ordem: number,
  w: number,
  h: number,
  rotulo: string,
  cor: string,
  dims = true
) {
  const base = `${autorId}/posts/${postId}/${ordem}-seed`;
  const path = `${base}.jpg`;
  const thumbPath = dims ? `${base}-thumb-${w}x${h}.jpg` : `${base}-thumb.jpg`;
  const now = new Date().toISOString();
  const arquivo = (p: string, url: string) => ({
    path: p,
    name: p.split("/").pop() ?? p,
    categoria: "posts",
    size: 1234,
    mimeType: "image/jpeg",
    createdAt: now,
    blobUrl: url,
  });
  return {
    row: {
      post_id: postId,
      autor_id: autorId,
      path,
      thumb_path: thumbPath,
      ordem,
    },
    arquivos: [
      arquivo(path, fotoMock(w, h, rotulo, cor)),
      arquivo(
        thumbPath,
        fotoMock(Math.round(w / 3), Math.round(h / 3), rotulo, cor)
      ),
    ],
  };
}

const FOTOS_SEED = (autorId: string) => {
  const fotos = [
    // post-foto-1: uma foto retrato 4:5 (dentro dos limites)
    seedFoto(autorId, "post-foto-1", 1, 1080, 1350, "4:5", "#ec4899"),
    // post-foto-2: carrossel — 1ª quadrada, 2ª paisagem 16:9 (fora → faixa)
    seedFoto(autorId, "post-foto-2", 1, 1200, 1200, "1:1", "#8b5cf6"),
    seedFoto(autorId, "post-foto-2", 2, 1280, 720, "16:9", "#0ea5e9"),
    // post-foto-3: foto legada (sem dimensão no nome → mede a miniatura)
    seedFoto(autorId, "post-foto-3", 1, 900, 1200, "legada", "#f59e0b", false),
    // post-foto-4: bem no fim do feed — pra provar que a principal NÃO é
    // baixada antes de a pessoa rolar até lá (loading="lazy").
    seedFoto(autorId, "post-foto-4", 1, 1080, 1440, "fim-3:4", "#10b981"),
  ];
  return {
    rows: fotos.map((f) => f.row),
    arquivos: fotos.flatMap((f) => f.arquivos),
  };
};
export default function DevPreviewRede() {
  // Mesmo swap do /dev-preview/app: sem isso, chamadas reais de serviço
  // (ex.: lib/rede/perfis.ts) bateriam no Supabase real com um user_id
  // falso e sem sessão -- 400 garantido.
  const mockInitialized = useRef(false);
  if (!mockInitialized.current) {
    mockInitialized.current = true;
    const outraAutoraId = "outra-autora";
    const solicitanteId = "solicitante-1";
    const amigaId = "amiga-1";
    const sugestaoId = "sugestao-1";
    const fotosSeed = FOTOS_SEED(outraAutoraId);
    __setMockSupabaseClient(
      createMockSupabaseClient(
        {
          tables: {
            rede_perfis: [
              {
                id: "perfil-outra",
                user_id: outraAutoraId,
                nome_exibicao: "Camila Duarte",
                cor_avatar: "#FF7AB6",
                bio: "Nail designer há 6 anos.",
                area_atuacao: null,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
              },
              {
                id: "perfil-mock-user",
                user_id: mockUsuario.id,
                nome_exibicao: mockUsuario.nome,
                cor_avatar: "#06b6d4",
                bio: "",
                area_atuacao: null,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
              },
              {
                id: "perfil-solicitante",
                user_id: solicitanteId,
                nome_exibicao: "Larissa Prado",
                cor_avatar: "#7AA7FF",
                bio: "Cabeleireira mobile.",
                area_atuacao: null,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
              },
              {
                id: "perfil-amiga",
                user_id: amigaId,
                nome_exibicao: "Juliana Alves",
                cor_avatar: "#6EE7B7",
                bio: "Esteticista.",
                area_atuacao: null,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
              },
              {
                id: "perfil-sugestao",
                user_id: sugestaoId,
                nome_exibicao: "Fernanda Costa",
                cor_avatar: "#FFC24B",
                bio: "Maquiagem para noivas e eventos.",
                area_atuacao: null,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
              },
            ],
            rede_amizades: [
              {
                id: "amz-pendente",
                solicitante_id: solicitanteId,
                destinatario_id: mockUsuario.id,
                status: "pendente",
                criado_em: new Date().toISOString(),
                respondido_em: null,
              },
              {
                id: "amz-aceita",
                solicitante_id: mockUsuario.id,
                destinatario_id: amigaId,
                status: "aceita",
                criado_em: new Date().toISOString(),
                respondido_em: new Date().toISOString(),
              },
            ],
            rede_bloqueios: [],
            rede_conversas: [
              {
                id: "conversa-1",
                criado_em: new Date().toISOString(),
                user_high_id:
                  mockUsuario.id > amigaId ? mockUsuario.id : amigaId,
                user_low_id:
                  mockUsuario.id > amigaId ? amigaId : mockUsuario.id,
              },
            ],
            rede_conversas_participantes: [
              { conversa_id: "conversa-1", user_id: mockUsuario.id },
              { conversa_id: "conversa-1", user_id: amigaId },
            ],
            rede_mensagens: [
              {
                id: "msg-1",
                conversa_id: "conversa-1",
                autor_id: amigaId,
                texto: "Oi! Vi seu post sobre anotar os gastos, ótima dica!",
                criado_em: new Date(Date.now() - 3_600_000 * 3).toISOString(),
                lida_em: null,
              },
              {
                id: "msg-2",
                conversa_id: "conversa-1",
                autor_id: amigaId,
                texto: "Faz isso desde quando?",
                criado_em: new Date(Date.now() - 3_600_000 * 2.9).toISOString(),
                lida_em: null,
              },
            ],
            rede_posts: [
              {
                id: "post-1",
                autor_id: outraAutoraId,
                categoria: "conquista",
                texto:
                  "Depois de três meses acompanhando minhas entradas, finalmente entendi quanto realmente sobra no fim do mês.",
                criado_em: new Date(Date.now() - 3_600_000 * 2).toISOString(),
                atualizado_em: new Date(
                  Date.now() - 3_600_000 * 2
                ).toISOString(),
              },
              {
                id: "post-2",
                autor_id: mockUsuario.id,
                categoria: "dica",
                texto:
                  "Dica rápida: anotar os gastos assim que saem já evita esquecer no fim do mês.",
                criado_em: new Date(Date.now() - 3_600_000 * 5).toISOString(),
                atualizado_em: new Date(
                  Date.now() - 3_600_000 * 5
                ).toISOString(),
              },
              {
                id: "post-foto-1",
                autor_id: outraAutoraId,
                categoria: "geral",
                texto: "Foto única no feed (retrato 4:5).",
                criado_em: new Date(Date.now() - 3_600_000 * 6).toISOString(),
                atualizado_em: new Date(
                  Date.now() - 3_600_000 * 6
                ).toISOString(),
              },
              {
                id: "post-foto-2",
                autor_id: outraAutoraId,
                categoria: "geral",
                texto: "Carrossel: quadrada e paisagem (altura fixa pela 1ª).",
                criado_em: new Date(Date.now() - 3_600_000 * 7).toISOString(),
                atualizado_em: new Date(
                  Date.now() - 3_600_000 * 7
                ).toISOString(),
              },
              {
                id: "post-foto-3",
                autor_id: outraAutoraId,
                categoria: "geral",
                texto: "Foto legada (sem dimensão no nome da miniatura).",
                criado_em: new Date(Date.now() - 3_600_000 * 8).toISOString(),
                atualizado_em: new Date(
                  Date.now() - 3_600_000 * 8
                ).toISOString(),
              },
              {
                id: "post-foto-4",
                autor_id: outraAutoraId,
                categoria: "geral",
                texto:
                  "Foto no fim do feed — a principal só baixa ao rolar até aqui.",
                criado_em: new Date(Date.now() - 3_600_000 * 9).toISOString(),
                atualizado_em: new Date(
                  Date.now() - 3_600_000 * 9
                ).toISOString(),
              },
            ],
            rede_post_fotos: fotosSeed.rows,
            rede_comentarios: [
              {
                id: "com-1",
                post_id: "post-1",
                autor_id: mockUsuario.id,
                texto: "Que máximo, também preciso fazer isso!",
                criado_em: new Date(Date.now() - 3_600_000).toISOString(),
              },
              {
                id: "com-2",
                post_id: "post-2",
                autor_id: sugestaoId,
                texto: "Vou testar isso hoje mesmo!",
                criado_em: new Date(
                  Date.now() - 3_600_000 * 0.75
                ).toISOString(),
              },
            ],
            rede_curtidas: [
              {
                post_id: "post-1",
                user_id: mockUsuario.id,
                criado_em: new Date().toISOString(),
              },
              {
                post_id: "post-2",
                user_id: amigaId,
                criado_em: new Date(Date.now() - 3_600_000 * 0.5).toISOString(),
              },
            ],
          },
          cofreFiles: fotosSeed.arquivos,
        },
        mockUsuario.id
      )
    );
  }

  const [activeTab] = useState<TabId>("rede");
  // Simula o teclado: enquanto o compositor do chat está focado, a
  // BottomNav some (um teclado real cobriria/empurraria ela).
  const [chatComposerFocused, setChatComposerFocused] = useState(false);

  return (
    <div
      className="relative flex flex-col min-h-screen"
      style={{ background: "var(--bg)" }}
    >
      <main
        className="flex-1 overflow-y-auto pb-40 px-4"
        style={{ paddingTop: "calc(24px + env(safe-area-inset-top, 0px))" }}
      >
        <RedeTab
          usuario={mockUsuario}
          onChatFocusChange={setChatComposerFocused}
        />
      </main>

      {!chatComposerFocused && (
        <BottomNav activeTab={activeTab} onChange={() => {}} />
      )}
    </div>
  );
}
