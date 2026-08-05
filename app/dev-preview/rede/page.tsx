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
            ],
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
          cofreFiles: [],
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
