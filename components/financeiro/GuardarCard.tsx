"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, PiggyBank } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/Toast";
import { useJornada } from "@/components/jornada/useJornada";
import { listarWishlistItems, type WishlistItem } from "@/lib/rede/wishlist";
import {
  guardarNoDesejo,
  listarHistoricoGuardar,
  somarNoDesejo,
  type DepositoGuardado,
} from "@/lib/guardar/guardar";
import { TEXTOS_GUARDAR as T } from "@/lib/guardar/textos";
import { formatEUR } from "@/lib/guardar/valor";

const sectionTitleStyle = {
  fontSize: "13px",
  letterSpacing: "-0.035em",
  color: "var(--text)",
} as const;

interface Props {
  userId: string;
  /** Leva a pessoa até onde se cria um Desejo (Meu Espaço / Rede). */
  onCriarDesejo: () => void;
}

/** Soma que falhou depois do depósito gravado; "Tentar novamente" só soma. */
type SomaPendente = { desejoId: string; centavos: number };

function quando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia} · ${hora}`;
}

export function GuardarCard({ userId, onCriarDesejo }: Props) {
  const toast = useToast();
  const { registrar } = useJornada(userId);
  const [desejos, setDesejos] = useState<WishlistItem[]>([]);
  const [historico, setHistorico] = useState<DepositoGuardado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [erroHistorico, setErroHistorico] = useState(false);
  const [desejoId, setDesejoId] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<SomaPendente | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [d, h] = await Promise.allSettled([
      listarWishlistItems(supabase, userId),
      listarHistoricoGuardar(supabase, userId),
    ]);
    if (d.status === "fulfilled") {
      setDesejos(d.value);
      setErroCarregar(false);
      setDesejoId((atual) =>
        d.value.some((x) => x.id === atual) ? atual : (d.value[0]?.id ?? "")
      );
    } else {
      console.error("[GuardarCard] desejos:", d.reason);
      setErroCarregar(true);
    }
    if (h.status === "fulfilled") {
      setHistorico(h.value);
      setErroHistorico(false);
    } else {
      console.error("[GuardarCard] histórico:", h.reason);
      setErroHistorico(true);
    }
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function depoisDeGuardar() {
    toast.success(T.sucesso);
    void registrar("guardar_meta");
    setTexto("");
    setErro(null);
    setPendente(null);
    await carregar();
  }

  async function guardar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const r = await guardarNoDesejo(supabase, { userId, desejoId, texto });
    setSalvando(false);
    if (r.ok) {
      await depoisDeGuardar();
      return;
    }
    setErro(r.erro);
    if (r.etapa === "soma") {
      // o depósito já está no histórico: mostra e deixa só a soma pendente
      setPendente({ desejoId, centavos: r.centavos });
      setTexto("");
      await carregar();
    }
  }

  async function tentarSomarDeNovo() {
    if (!pendente || salvando) return;
    setSalvando(true);
    const r = await somarNoDesejo(supabase, { userId, ...pendente });
    setSalvando(false);
    if (r.ok) await depoisDeGuardar();
    else setErro(T.erroSoma);
  }

  const escolhido = desejos.find((d) => d.id === desejoId);
  const pct =
    escolhido && escolhido.valorAlvo > 0
      ? Math.min(100, (escolhido.valorAtual / escolhido.valorAlvo) * 100)
      : 0;
  const nomeDe = (id: string) =>
    desejos.find((d) => d.id === id)?.nome ?? T.desejoRemovido;

  return (
    <GlassCard radius="md" className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <PiggyBank size={14} style={{ color: "var(--accent)" }} />
        <h2 className="font-semibold" style={sectionTitleStyle}>
          {T.titulo}
        </h2>
      </div>

      {carregando && desejos.length === 0 && !erroCarregar ? (
        <p
          className="text-sm text-center py-6"
          style={{ color: "var(--text-muted)" }}
        >
          {T.carregando}
        </p>
      ) : erroCarregar && desejos.length === 0 ? (
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
      ) : desejos.length === 0 ? (
        <div className="flex flex-col items-center text-center py-4">
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            {T.vazioTitulo}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {T.vazioTexto}
          </p>
          <button
            onClick={onCriarDesejo}
            className="mt-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={{
              minHeight: "44px",
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            {T.vazioBotao}
          </button>
        </div>
      ) : (
        <>
          <p
            className="text-[11px] font-bold mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {T.escolherDesejo}
          </p>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {desejos.map((d) => {
              const on = d.id === desejoId;
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    setDesejoId(d.id);
                    setErro(null);
                  }}
                  aria-pressed={on}
                  className="px-3 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    minHeight: "44px",
                    background: on ? "var(--accent)" : "var(--surface)",
                    color: on ? "#fff" : "var(--text-muted)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--border-color)"}`,
                  }}
                >
                  {d.nome}
                </button>
              );
            })}
          </div>

          {escolhido && (
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-2">
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {T.progressoTitulo}
                </span>
                <span
                  className="text-xs tabular-nums shrink-0 ml-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatEUR(escolhido.valorAtual)} /{" "}
                  {formatEUR(escolhido.valorAlvo)}
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <div
                  className="progress-fill"
                  style={{
                    width: `${pct}%`,
                    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </div>
            </div>
          )}

          <label
            htmlFor="guardar-valor"
            className="text-[11px] font-bold block mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {T.campoValor}
          </label>
          <div className="flex gap-2">
            <input
              id="guardar-valor"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={T.placeholderValor}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setErro(null);
              }}
              disabled={salvando || Boolean(pendente)}
              className="flex-1 min-w-0 rounded-xl px-3 text-sm font-medium outline-none"
              style={{
                minHeight: "44px",
                background: "var(--surface)",
                border: `1px solid ${erro ? "var(--danger)" : "var(--border-color)"}`,
                color: "var(--text)",
              }}
            />
            <button
              onClick={guardar}
              disabled={salvando || Boolean(pendente)}
              className="px-4 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                minHeight: "44px",
                background: "var(--accent)",
                color: "#fff",
                opacity: salvando || pendente ? 0.6 : 1,
              }}
            >
              {salvando ? T.botaoSalvando : T.botao}
            </button>
          </div>

          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2 mt-2 text-xs font-medium"
              style={{ color: "var(--danger)" }}
            >
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span className="flex-1">{erro}</span>
            </div>
          )}
          {pendente && (
            <button
              onClick={() => void tentarSomarDeNovo()}
              disabled={salvando}
              className="mt-2 px-4 rounded-xl text-xs font-bold active:opacity-70 disabled:opacity-50"
              style={{
                minHeight: "44px",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
              }}
            >
              {salvando ? T.botaoSalvando : T.tentarNovamente}
            </button>
          )}

          <p
            className="text-[11px] font-bold mt-5 mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {T.historicoTitulo}
          </p>
          {erroHistorico ? (
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              {T.historicoErro}
            </p>
          ) : historico.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {T.historicoVazio}
            </p>
          ) : (
            <ul className="space-y-2">
              {historico.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {nomeDe(h.desejoId)}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {quando(h.criadoEm)}
                    </p>
                  </div>
                  <span
                    className="text-sm font-bold tabular-nums shrink-0"
                    style={{ color: "var(--accent)" }}
                  >
                    {formatEUR(h.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </GlassCard>
  );
}
