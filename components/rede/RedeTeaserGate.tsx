"use client";

import { useState } from "react";
import {
  UsersRound,
  UserRound,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  Link2,
  Heart,
  MessageSquare as CommentIcon,
  Compass,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/Toast";
import { Avatar } from "./Avatar";

const BENEFICIOS = [
  { Icon: Sparkles, texto: "Trocar experiências com segurança" },
  { Icon: MessageCircle, texto: "Tirar dúvidas com quem entende sua rotina" },
  { Icon: UsersRound, texto: "Criar conexões profissionais" },
  { Icon: CommentIcon, texto: "Conversar em privado" },
  { Icon: Link2, texto: "Organizar seu perfil e LiveLinks" },
];

type TeaserPost = {
  id: string;
  nome: string;
  cor: string;
  categoria: string;
  categoriaRgb: string;
  tempo: string;
  texto: string;
  curtidas: number;
  comentarios: number;
};

const TEASER_POSTS: TeaserPost[] = [
  {
    id: "teaser-1",
    nome: "Camila Duarte",
    cor: "#ec4899",
    categoria: "Conquista",
    categoriaRgb: "236 72 153",
    tempo: "há 2h",
    texto:
      "Depois de três meses acompanhando minhas entradas, finalmente entendi quanto realmente sobra no fim do mês.",
    curtidas: 24,
    comentarios: 2,
  },
  {
    id: "teaser-2",
    nome: "Miguel",
    cor: "#8b5cf6",
    categoria: "Conquista",
    categoriaRgb: "139 92 246",
    tempo: "há 5h",
    texto:
      "Semana cheia, mas terminei o mês batendo a meta pela primeira vez! 🎉",
    curtidas: 12,
    comentarios: 1,
  },
  {
    id: "teaser-3",
    nome: "Ana Souza",
    cor: "#06b6d4",
    categoria: "Dica",
    categoriaRgb: "6 182 212",
    tempo: "ontem",
    texto:
      "Organizar os atendimentos por semana me ajudou a enxergar horários livres e planejar melhor.",
    curtidas: 18,
    comentarios: 3,
  },
];

function TeaserPostCard({ post }: { post: TeaserPost }) {
  return (
    <GlassCard radius="lg" className="p-4" style={{ pointerEvents: "none" }}>
      <div className="flex items-start gap-3">
        <Avatar nome={post.nome} cor={post.cor} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="font-semibold text-sm truncate"
              style={{ color: "var(--text)" }}
            >
              {post.nome}
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: `rgb(${post.categoriaRgb} / 0.12)`,
                color: `rgb(${post.categoriaRgb})`,
                border: `1px solid rgb(${post.categoriaRgb} / 0.25)`,
              }}
            >
              {post.categoria}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {post.tempo}
          </p>
        </div>
      </div>

      <p
        className="text-sm leading-relaxed mt-3"
        style={{ color: "var(--text-2)" }}
      >
        {post.texto}
      </p>

      <div
        className="flex items-center gap-4 mt-3 pt-3"
        style={{ borderTop: "1px solid var(--divider)" }}
      >
        <span
          className="flex items-center gap-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <Heart size={16} />
          <span className="text-xs font-semibold tabular-nums">
            {post.curtidas}
          </span>
        </span>
        <span
          className="flex items-center gap-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <CommentIcon size={16} />
          <span className="text-xs font-semibold tabular-nums">
            {post.comentarios}
          </span>
        </span>
      </div>
    </GlassCard>
  );
}

function ComingSoonRow({
  Icon,
  titulo,
  subtitulo,
}: {
  Icon: typeof UsersRound;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="flex items-center gap-3.5 py-3">
      <div
        className="flex items-center justify-center rounded-xl shrink-0"
        style={{
          width: 38,
          height: 38,
          background: "rgb(var(--accent-rgb) / 0.12)",
        }}
      >
        <Icon size={17} style={{ color: "var(--accent)" }} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          {titulo}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {subtitulo}
        </p>
      </div>
    </div>
  );
}

/** Qual sheet do gate está visível — dono é o componente pai (RedeGatedTab),
 * garantindo no máximo um aberto por vez entre os três (inclui o
 * SerialKeySheet, que o pai renderiza). */
export type GateSheet = "preview" | "confirmacao" | "chave" | null;

interface Props {
  sheet: GateSheet;
  onSheetChange: (sheet: GateSheet) => void;
}

export function RedeTeaserGate({ sheet, onSheetChange }: Props) {
  const toast = useToast();
  const [solicitando, setSolicitando] = useState(false);
  const [jaExistiaSolicitacao, setJaExistiaSolicitacao] = useState(false);

  async function handleQueroParticipar() {
    if (solicitando) return;
    setSolicitando(true);
    try {
      const res = await fetch("/api/rede/solicitar-beta", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível enviar sua solicitação.");
        return;
      }
      setJaExistiaSolicitacao(Boolean(data.jaExistia));
      onSheetChange("confirmacao");
    } catch {
      toast.error("Não foi possível enviar sua solicitação.");
    } finally {
      setSolicitando(false);
    }
  }

  return (
    <div className="pb-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <h2
          className="font-extrabold"
          style={{
            fontSize: "26px",
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          Rede
        </h2>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{
            background: "rgb(var(--accent-rgb) / 0.12)",
            color: "var(--accent)",
            border: "1px solid rgb(var(--accent-rgb) / 0.22)",
          }}
        >
          Em breve
        </span>
      </div>

      {/* Hero */}
      <GlassCard radius="xl" className="p-6 mb-6">
        <div
          className="flex items-center justify-center rounded-2xl mb-4"
          style={{
            width: 48,
            height: 48,
            background: "rgb(var(--accent-rgb) / 0.14)",
            boxShadow: "var(--glow-sm)",
          }}
        >
          <UsersRound size={22} style={{ color: "var(--accent)" }} />
        </div>
        <p
          className="font-black leading-tight"
          style={{
            fontSize: "24px",
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          Você não precisa crescer sozinha.
        </p>
        <p
          className="text-sm mt-2.5 leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          Uma comunidade privada para profissionais que vivem a mesma rotina que
          você.
        </p>
      </GlassCard>

      {/* Prévia do feed */}
      <section className="mb-6">
        <p className="section-label mb-3">Prévia do que vem por aí</p>
        <div className="relative">
          <div className="space-y-3">
            {TEASER_POSTS.map((post) => (
              <TeaserPostCard key={post.id} post={post} />
            ))}
          </div>
          <div
            className="absolute left-0 right-0 bottom-0 pointer-events-none"
            style={{
              height: "72px",
              background: "linear-gradient(to bottom, transparent, var(--bg))",
              borderBottomLeftRadius: "var(--radius-lg)",
              borderBottomRightRadius: "var(--radius-lg)",
            }}
          />
        </div>
        <p
          className="text-center text-[11px] font-semibold mt-2"
          style={{ color: "var(--text-muted)" }}
        >
          Demonstração — sem curtidas, comentários ou publicações reais ainda
        </p>
      </section>

      {/* Benefícios */}
      <section className="mb-6">
        <p className="section-label mb-3">O que você vai poder fazer</p>
        <GlassCard radius="lg" className="px-4">
          {BENEFICIOS.map((b, i) => (
            <div
              key={i}
              style={
                i > 0 ? { borderTop: "1px solid var(--divider)" } : undefined
              }
            >
              <BeneficioRow texto={b.texto} Icon={b.Icon} />
            </div>
          ))}
        </GlassCard>
      </section>

      {/* Plano */}
      <section className="mb-6">
        <GlassCard radius="md" className="p-4 flex items-center gap-3.5">
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--text)" }}
            >
              Rede fará parte do JobApp Rede
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Plano previsto: R$ 49,90/mês
            </p>
          </div>
        </GlassCard>
      </section>

      {/* Ações */}
      <button
        onClick={handleQueroParticipar}
        disabled={solicitando}
        className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {solicitando ? "Enviando…" : "Quero participar da beta"}
      </button>
      <button
        onClick={() => onSheetChange("chave")}
        className="w-full py-2.5 text-xs font-semibold active:opacity-70"
        style={{ color: "var(--text-muted)" }}
      >
        Já tem um código de convite? Digite aqui
      </button>
      <button
        onClick={() => onSheetChange("preview")}
        className="w-full flex items-center justify-center gap-1.5 py-3.5 text-sm font-semibold active:opacity-70"
        style={{ color: "var(--text)" }}
      >
        <Compass size={15} />
        Conhecer o que vem por aí
      </button>

      <BottomSheet
        open={sheet === "confirmacao"}
        onClose={() => onSheetChange(null)}
        title="Solicitação de beta"
      >
        <div className="px-5 py-5">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-2)" }}
          >
            {jaExistiaSolicitacao
              ? "Você já está na lista de espera. Avisamos assim que seu convite estiver pronto."
              : "Solicitação enviada! Avisamos assim que seu convite estiver pronto."}
          </p>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "preview"}
        onClose={() => onSheetChange(null)}
        title="O que vem por aí"
      >
        <div className="px-5 py-3 pb-6">
          <ComingSoonRow
            Icon={UsersRound}
            titulo="Feed"
            subtitulo="Dicas, conquistas e desabafos de quem vive sua rotina"
          />
          <div style={{ borderTop: "1px solid var(--divider)" }}>
            <ComingSoonRow
              Icon={UserRound}
              titulo="Perfil"
              subtitulo="LiveLinks e vitrine pública, do seu jeito"
            />
          </div>
          <div style={{ borderTop: "1px solid var(--divider)" }}>
            <ComingSoonRow
              Icon={Sparkles}
              titulo="Amigas"
              subtitulo="Conecte-se com outras profissionais"
            />
          </div>
          <div style={{ borderTop: "1px solid var(--divider)" }}>
            <ComingSoonRow
              Icon={MessageCircle}
              titulo="Conversas"
              subtitulo="Mensagens privadas, sem sair do app"
            />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function BeneficioRow({
  texto,
  Icon,
}: {
  texto: string;
  Icon: typeof UsersRound;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon size={16} style={{ color: "var(--accent)" }} />
      <p className="text-sm" style={{ color: "var(--text)" }}>
        {texto}
      </p>
    </div>
  );
}
