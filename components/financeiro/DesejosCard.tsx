"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Plus, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/Toast";
import {
  DesejoForm,
  type DesejoFormState,
} from "@/components/desejo/DesejoForm";
import { OptionsSheet } from "@/components/rede/OptionsSheet";
import { WishlistCard } from "@/components/rede/WishlistCard";
import {
  atualizarWishlistItem,
  criarWishlistItem,
  excluirWishlistItem,
  listarWishlistItems,
  type WishlistItem,
} from "@/lib/rede/wishlist";
import { garantirPerfil } from "@/lib/rede/perfis";
import { WISHLIST_PALETTE } from "@/lib/desejo/desejo";
import { avisarDesejosMudaram, useAoMudarDesejos } from "@/lib/desejo/eventos";
import { TEXTOS_DESEJO as T } from "@/lib/desejo/textos";

const sectionTitleStyle = {
  fontSize: "13px",
  letterSpacing: "-0.035em",
  color: "var(--text)",
} as const;

interface Props {
  userId: string;
  nomeUsuaria: string;
  /** false só quando já se sabe que não há acesso à Rede (teste acabou). */
  podeCriar: boolean;
  onAbrirRede: () => void;
}

/** Erro de RLS/FK ao criar sem ser membro da Rede. */
function semAcessoRede(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "42501" || code === "23503";
}

export function DesejosCard({
  userId,
  nomeUsuaria,
  podeCriar,
  onAbrirRede,
}: Props) {
  const toast = useToast();
  const [itens, setItens] = useState<WishlistItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<WishlistItem | null>(null);
  const [excluindo, setExcluindo] = useState<WishlistItem | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await listarWishlistItems(supabase, userId));
      setErroCarregar(false);
    } catch (e) {
      console.error("[DesejosCard] carregar:", e);
      setErroCarregar(true);
    }
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useAoMudarDesejos(carregar);

  function abrirNovo() {
    setEditando(null);
    setFormAberto(true);
  }

  function fechar() {
    setFormAberto(false);
    setEditando(null);
  }

  async function salvar(form: DesejoFormState, existente: WishlistItem | null) {
    const valorAlvo = Number(form.valorAlvo);
    const prazo = form.prazo || null;
    try {
      if (existente) {
        const salvo = await atualizarWishlistItem(supabase, {
          itemId: existente.id,
          nome: form.nome,
          valorAlvo,
          estado: form.estado,
          privacidade: form.privacidade,
          prazo,
        });
        toast.success(prazo && !salvo.prazo ? T.okSalvoSemPrazo : T.okSalvo);
      } else {
        await garantirPerfil(supabase, userId, nomeUsuaria);
        const criado = await criarWishlistItem(supabase, {
          nome: form.nome,
          cor: WISHLIST_PALETTE[itens.length % WISHLIST_PALETTE.length],
          valorAlvo,
          estado: form.estado,
          privacidade: form.privacidade,
          prazo,
        });
        toast.success(
          prazo && !criado.prazo ? T.okCriadoSemPrazo : T.okCriado
        );
      }
      fechar();
      avisarDesejosMudaram();
    } catch (e) {
      console.error("[DesejosCard] salvar:", e);
      if (!existente && semAcessoRede(e)) {
        setSemAcesso(true);
        fechar();
        return;
      }
      toast.error(T.erroSalvar);
    }
  }

  async function excluir(item: WishlistItem) {
    try {
      await excluirWishlistItem(supabase, { itemId: item.id });
      setExcluindo(null);
      fechar();
      toast.success(T.okExcluido);
      avisarDesejosMudaram();
    } catch (e) {
      console.error("[DesejosCard] excluir:", e);
      toast.error(T.erroExcluir);
    }
  }

  const bloqueado = !podeCriar || semAcesso;

  return (
    <GlassCard radius="md" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={sectionTitleStyle}>
            {T.cardTitulo}
          </h2>
        </div>
        {!bloqueado && itens.length > 0 && (
          <button
            onClick={abrirNovo}
            className="flex items-center gap-1 px-3 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={{
              minHeight: "44px",
              background: "rgb(var(--accent-rgb) / 0.12)",
              color: "var(--accent)",
              border: "1px solid rgb(var(--accent-rgb) / 0.3)",
            }}
          >
            <Plus size={12} />
            {T.novo}
          </button>
        )}
      </div>

      {carregando && itens.length === 0 && !erroCarregar ? (
        <p
          className="text-sm text-center py-6"
          style={{ color: "var(--text-muted)" }}
        >
          {T.carregando}
        </p>
      ) : erroCarregar && itens.length === 0 ? (
        <div className="flex flex-col items-center text-center py-4">
          <AlertCircle size={22} style={{ color: "var(--danger)" }} />
          <p
            className="font-semibold mt-3 text-xs"
            style={{ color: "var(--text)" }}
          >
            {T.erroCarregar}
          </p>
          <button
            onClick={() => void carregar()}
            disabled={carregando}
            className="mt-3 px-4 rounded-xl text-xs font-bold active:opacity-70 disabled:opacity-50"
            style={{
              minHeight: "44px",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            {T.tentarNovamente}
          </button>
        </div>
      ) : itens.length === 0 ? (
        bloqueado ? (
          <div className="flex flex-col items-center text-center py-4">
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--text)" }}
            >
              {T.semRedeTitulo}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {T.semRedeTexto}
            </p>
            <button
              onClick={onAbrirRede}
              className="mt-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                minHeight: "44px",
                background: "var(--accent)",
                color: "#fff",
              }}
            >
              {T.semRedeBotao}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-4">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {T.vazio}
            </p>
            <button
              onClick={abrirNovo}
              className="mt-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                minHeight: "44px",
                background: "var(--accent)",
                color: "#fff",
              }}
            >
              {T.criar}
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {itens.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onClick={() => {
                setEditando(item);
                setFormAberto(true);
              }}
            />
          ))}
        </div>
      )}

      <DesejoForm
        open={formAberto}
        item={editando}
        onClose={fechar}
        onSave={salvar}
        onDeleteRequest={(item) => {
          setFormAberto(false);
          setExcluindo(item);
        }}
      />

      <OptionsSheet
        open={!!excluindo}
        title={T.excluirConfirmar}
        onClose={() => setExcluindo(null)}
        options={[
          {
            key: "confirmar",
            label: T.excluirSim,
            Icon: Trash2,
            danger: true,
            onSelect: () => {
              if (excluindo) void excluir(excluindo);
            },
          },
          {
            key: "cancelar",
            label: T.cancelar,
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />
    </GlassCard>
  );
}
