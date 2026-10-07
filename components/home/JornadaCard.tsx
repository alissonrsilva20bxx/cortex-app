"use client";

import type { CSSProperties } from "react";
import { useJornada } from "@/components/jornada/useJornada";
import {
  IconeDoEnfeite,
  IconeDoEstagio,
  IconeSeta,
} from "@/components/jornada/jornadaIcones";
import {
  contadorDaSemana,
  faltaProProximo,
  fracaoDoEstagio,
  missoesFeitas,
} from "@/components/jornada/progresso";
import {
  ABRIR_JORNADA,
  NOME_GLOW,
  RITMO_COMPLETO,
  ateProximo,
  capituloEmPartes,
  diasFortesDeTres,
  enfeiteEmPartes,
  nomeEstagio,
  numero,
  tituloJornada,
} from "@/lib/jornada/textos";

interface Props {
  userId: string;
  onAbrir: () => void;
}

/** Anel do protótipo (`ring(56, 5, p)`): trilho `--t-soft`, progresso
 * `--t-acc` com ponta redonda, começando no topo. */
function Anel({ fracao }: { fracao: number }) {
  const tamanho = 56;
  const espessura = 5;
  const raio = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * raio;
  const p = Math.min(1, Math.max(0, fracao));
  const centro = tamanho / 2;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <circle
        cx={centro}
        cy={centro}
        r={raio}
        fill="none"
        stroke="var(--t-soft)"
        strokeWidth={espessura}
      />
      <circle
        cx={centro}
        cy={centro}
        r={raio}
        fill="none"
        stroke="var(--t-acc)"
        strokeWidth={espessura}
        strokeLinecap="round"
        strokeDasharray={volta.toFixed(1)}
        strokeDashoffset={(volta * (1 - p)).toFixed(1)}
        transform={`rotate(-90 ${centro} ${centro})`}
      />
    </svg>
  );
}

// Valores do protótipo aprovado (docs/jornada/referencias/
// prototipo-sua-jornada.html, `.jcard` e filhos).
const LINHA: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--t-mut)",
  marginTop: "-4px",
};
const FORTE: CSSProperties = { color: "var(--t-ink)" };

/**
 * Card "Sua Jornada" no Início (J12, #162), no desenho do protótipo
 * aprovado: estágio, Glow e quanto falta, os dias fortes da semana e o
 * capítulo do mês. Tocar abre a tela da Jornada.
 *
 * O protótipo também desenha as bolinhas dos 7 dias e um "Próximo passo".
 * O estado da Jornada não tem o dia a dia da semana nem um próximo passo,
 * então essas duas peças não aparecem (decisão do operador, listada no PR).
 *
 * A Jornada nunca bloqueia o Início: sem estado ainda (carregando, ou erro
 * sem nada no cache), o card simplesmente não aparece.
 */
export function JornadaCard({ userId, onAbrir }: Props) {
  const { estado } = useJornada(userId);
  if (!estado) return null;

  const capitulo = estado.capitulo;
  const ritmoCompleto = contadorDaSemana(estado, "firme") > 0;
  const dias = diasFortesDeTres(contadorDaSemana(estado, "dias_fortes"));

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={ABRIR_JORNADA}
      // #131: o FAB recua se colidir com uma ação real (ver FAB.tsx).
      data-fab-avoid
      className="w-full text-left transition-transform active:scale-[.985]"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minWidth: 0,
        padding: "16px 16px 14px",
        borderRadius: "20px",
        // O protótipo não define line-height (fica "normal"); o Início
        // herda 1,5 do body (mockup das 5 telas).
        lineHeight: "normal",
        color: "var(--t-ink)",
        background:
          "radial-gradient(120% 90% at right top, color-mix(in srgb, var(--t-acc) 16%, transparent), transparent 60%), var(--t-card)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in srgb, var(--t-acc) 22%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span
          style={{
            position: "relative",
            width: "56px",
            height: "56px",
            flexShrink: 0,
          }}
        >
          <Anel fracao={fracaoDoEstagio(estado)} />
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--t-deep)",
            }}
          >
            <IconeDoEstagio estagio={estado.estagio} />
          </span>
        </span>
        <span style={{ display: "block", flexGrow: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: ".09em",
              textTransform: "uppercase",
              color: "var(--t-deep)",
            }}
          >
            {tituloJornada(estado.preferencias.modoDiscreto)}
          </span>
          <span
            style={{
              display: "block",
              fontSize: "19px",
              fontWeight: 800,
              letterSpacing: "-.3px",
              lineHeight: 1.2,
            }}
          >
            {nomeEstagio(estado.estagio)}
          </span>
          <span
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--t-mut)",
            }}
          >
            <b
              style={{
                color: "var(--t-ink)",
                fontWeight: 800,
                display: "inline-block",
              }}
            >
              {numero(estado.glowTotal)}
            </b>{" "}
            {NOME_GLOW} ·{" "}
            <span>
              {ateProximo(faltaProProximo(estado), estado.estagio + 1)}
            </span>
          </span>
        </span>
        <span style={{ color: "var(--t-mut)" }}>
          <IconeSeta />
        </span>
      </div>

      <span style={{ ...LINHA, display: "block" }}>
        <b style={FORTE}>{dias.forte}</b>
        {dias.resto}
        {ritmoCompleto && ` · ${RITMO_COMPLETO}`}
      </span>

      {capitulo && (
        <span
          style={{
            ...LINHA,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={
              capitulo.fechado
                ? {
                    // `.orn` do protótipo: o enfeite já conquistado (sombra
                    // com as mesmas cores, em hex: rgba(255,255,255,.45) e
                    // rgba(168,116,26,.3)).
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    background:
                      "radial-gradient(circle at 35% 30%, #ffe9b8, #e8b04a 55%, #a8741a)",
                    boxShadow:
                      "0 0 0 2px #ffffff73 inset, 0 4px 10px #a8741a4d",
                  }
                : {
                    // `.orn.off.now`: o enfeite do mês em andamento.
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px dashed var(--t-acc)",
                    color: "var(--t-deep)",
                  }
            }
          >
            <IconeDoEnfeite mes={capitulo.mes} />
          </span>
          {capitulo.fechado ? (
            <span>
              <b style={{ ...FORTE, fontWeight: 800 }}>
                {enfeiteEmPartes(capitulo.mes).forte}
              </b>
              {enfeiteEmPartes(capitulo.mes).resto}
            </span>
          ) : (
            <CapituloAberto
              partes={capituloEmPartes(
                capitulo.mes,
                missoesFeitas(capitulo),
                capitulo.missoes.length
              )}
            />
          )}
        </span>
      )}
    </button>
  );
}

function CapituloAberto({
  partes,
}: {
  partes: { antes: string; forte: string; resto: string };
}) {
  return (
    <span>
      {partes.antes}
      <b style={{ ...FORTE, fontWeight: 800 }}>{partes.forte}</b>
      {partes.resto}
    </span>
  );
}
