"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bell } from "lucide-react";

import { TOUR_STEPS, tourPlacement } from "@/lib/appTour";
import { isPushSubscribed, isPushSupported, subscribeToPush } from "@/lib/push";
import type { TabId } from "@/lib/types";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  userId: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onClose: () => void;
}

/** Folga do destaque em volta do elemento. */
const PAD = 6;
/** Quanto esperar o alvo aparecer (troca de aba) antes de cair no cartão central. */
const ESPERA_ALVO_MS = 700;

function isIOSNaoInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/**
 * Coachmarks por cima do app de verdade (não telas de mentira): escurece
 * tudo, recorta um "furo" no elemento do passo e mostra um cartão curto.
 * Nos passos de navegação, tocar no furo troca de aba como a usuária
 * faria — o tour ensina o gesto, não só descreve.
 */
export function AppTour({ userId, activeTab, onTabChange, onClose }: Props) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [esperando, setEsperando] = useState(true);
  const [vh, setVh] = useState(800);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  // Push no último passo: só oferece se der pra ativar de verdade aqui.
  const [push, setPush] = useState<"indisponivel" | "off" | "on" | "ativando">(
    "indisponivel"
  );
  const [pushErro, setPushErro] = useState<string | null>(null);
  useEffect(() => {
    if (!isPushSupported()) return;
    let vivo = true;
    isPushSubscribed()
      .then((s) => vivo && setPush(s ? "on" : "off"))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // Garante a aba do passo (sem "re-tocar" a aba ativa, que rola pro
  // topo / volta a Rede pra raiz).
  const activeRef = useRef(activeTab);
  activeRef.current = activeTab;
  useEffect(() => {
    if (step.tab && step.tab !== activeRef.current) onTabChange(step.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Mede o alvo a cada frame enquanto o passo está na tela: cobre a
  // animação de troca de aba, rolagem e rotação sem um listener por caso.
  // Só faz setState quando a medida muda.
  useEffect(() => {
    let raf = 0;
    let chave = "";
    let rolou = false;
    let esperandoAtual = true;
    const inicio = performance.now();
    setRect(null);
    setEsperando(Boolean(step.target));

    const tick = () => {
      setVh((v) => (v === window.innerHeight ? v : window.innerHeight));
      const el = step.target
        ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
        : null;
      const r = el?.getBoundingClientRect();
      const visivel = Boolean(r && r.width > 0 && r.height > 0);

      if (el && r && visivel && !rolou) {
        rolou = true;
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ block: "center" });
        }
      }

      const prox: Rect | null =
        r && visivel
          ? {
              top: Math.round(r.top),
              left: Math.round(r.left),
              width: Math.round(r.width),
              height: Math.round(r.height),
            }
          : null;
      const k = prox
        ? `${prox.top},${prox.left},${prox.width},${prox.height}`
        : "-";
      if (k !== chave) {
        chave = k;
        setRect(prox);
      }

      const aindaEsperando =
        Boolean(step.target) &&
        !visivel &&
        performance.now() - inicio < ESPERA_ALVO_MS;
      if (aindaEsperando !== esperandoAtual) {
        esperandoAtual = aindaEsperando;
        setEsperando(aindaEsperando);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function avancar() {
    if (step.goTo) onTabChange(step.goTo);
    if (last) onClose();
    else setI((n) => n + 1);
  }

  async function ativarPush() {
    setPushErro(null);
    setPush("ativando");
    try {
      await subscribeToPush(userId);
      setPush("on");
    } catch (e) {
      setPush("off");
      setPushErro(e instanceof Error ? e.message : "Não deu pra ativar agora.");
    }
  }

  const placement = tourPlacement(rect, vh);
  const hole = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const cardPos: CSSProperties =
    placement === "above" && hole
      ? { bottom: Math.max(16, vh - hole.top + 12) }
      : placement === "below" && hole
        ? { top: hole.top + hole.height + 12 }
        : !step.target && !last
          ? // Passo que explica a aba inteira: cartão embaixo, acima da
            // BottomNav, pra aba continuar visível atrás do véu.
            { bottom: "calc(104px + env(safe-area-inset-bottom, 0px))" }
          : {
              top: "50%",
              transform: "translateY(-50%)",
            };

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="Tour do app"
      data-tour-overlay
      style={{ touchAction: "none" }}
    >
      {/* Backdrop: sem alvo, um véu inteiro; com alvo, o próprio furo
          projeta a sombra gigante que escurece o resto. */}
      {hole ? (
        <button
          type="button"
          aria-label={step.goTo ? (step.cta ?? "Próximo") : step.title}
          onClick={step.goTo ? avancar : undefined}
          className="absolute transition-all duration-300 ease-out"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            // Botões da BottomNav/FAB/avatar são redondos; cards, 24px.
            borderRadius: Math.min(hole.height / 2, 24),
            boxShadow:
              "0 0 0 2px rgb(var(--accent-rgb) / 0.9), 0 0 0 9999px rgba(0, 0, 0, 0.66)",
            cursor: step.goTo ? "pointer" : "default",
            background: "transparent",
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(0, 0, 0, 0.45)" }}
        />
      )}

      {!esperando && (
        <div
          key={step.id}
          className="absolute left-4 right-4 mx-auto max-w-[420px] rounded-[20px] p-5"
          style={{
            ...cardPos,
            animation: "fade-in 0.25s ease-out",
            background: "rgb(var(--bg-rgb) / 0.98)",
            border: "1px solid var(--border-color)",
            boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
          }}
        >
          <p
            className="text-xs font-semibold mb-1"
            style={{ color: "var(--accent)" }}
          >
            {i + 1} de {TOUR_STEPS.length}
          </p>
          <h2
            className="text-lg font-extrabold mb-1.5"
            style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            {step.title}
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {step.body}
          </p>

          {last && push !== "indisponivel" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={ativarPush}
                disabled={push !== "off"}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-opacity active:opacity-70"
                style={{
                  border: "1px solid var(--border-color)",
                  color: push === "on" ? "var(--success)" : "var(--text)",
                  background: "var(--surface)",
                }}
              >
                <Bell size={16} />
                {push === "on"
                  ? "Notificações ativadas"
                  : push === "ativando"
                    ? "Ativando…"
                    : "Ativar notificações"}
              </button>
              {pushErro && (
                <p
                  className="text-xs mt-2 text-center"
                  style={{ color: "var(--danger)" }}
                >
                  {pushErro}
                </p>
              )}
            </div>
          )}
          {last && push === "indisponivel" && isIOSNaoInstalado() && (
            <p
              className="text-xs mt-3 leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              No iPhone, as notificações chegam quando o JobApp está na Tela de
              Início (Compartilhar → Adicionar à Tela de Início).
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            {!last ? (
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium px-1 py-2 transition-opacity active:opacity-60"
                style={{ color: "var(--text-muted)" }}
              >
                Pular tour
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={avancar}
              className="rounded-full px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {step.cta ?? "Próximo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
