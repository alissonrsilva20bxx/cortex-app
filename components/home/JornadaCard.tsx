"use client";

import type { CSSProperties } from "react";
import { useJornada } from "@/components/jornada/useJornada";
import {
  FaiscaCheia,
  IconeDoEnfeite,
  IconeDoEstagio,
  IconeDoPrototipo,
  IconeSeta,
} from "@/components/jornada/jornadaIcones";
import {
  bolinhasDaSemana,
  contadorDaSemana,
  faltaProProximo,
  fracaoDoEstagio,
  indiceDeHojeNaSemana,
  missoesFeitas,
  proximoPasso,
  type Bolinha as TipoDaBolinha,
} from "@/components/jornada/progresso";
import {
  ABRIR_JORNADA,
  LETRAS_DA_SEMANA,
  NOME_GLOW,
  PROXIMO_PASSO,
  RITMO_COMPLETO,
  TEXTO_DO_PROXIMO_PASSO,
  ateProximo,
  capituloEmPartes,
  diasFortesDeTres,
  enfeiteEmPartes,
  glowDoPasso,
  nomeEstagio,
  numero,
  tituloJornada,
  type AcaoDoProximoPasso,
} from "@/lib/jornada/textos";

interface Props {
  userId: string;
  onAbrir: () => void;
  /** "Próximo passo": leva para onde ela faz a ação (Financeiro, Cofre,
   * Agenda). */
  onProximoPasso: (acao: AcaoDoProximoPasso) => void;
}

/** O ícone de cada passo (`ACTIONS[k].ic` do protótipo). */
const ICONE_DO_PASSO: Record<AcaoDoProximoPasso, string> = {
  guardar_meta: "coins",
  comprovante_cofre: "shieldp",
  planejar: "cal",
  descanso: "moon",
  despesa: "receipt",
};

/** Uma bolinha da semana (`.dot` do protótipo): forte, descanso, hoje ou
 * vazia. A vazia muda no escuro (classe em globals.css). */
function Bolinha({ tipo }: { tipo: TipoDaBolinha }) {
  const base: CSSProperties = {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  };
  if (tipo === "forte")
    return (
      <span style={{ ...base, background: "var(--t-acc)" }}>
        <IconeDoPrototipo nome="check" tamanho={15} traco={3} />
      </span>
    );
  if (tipo === "descanso")
    return (
      <span
        style={{ ...base, background: "var(--t-soft)", color: "var(--t-deep)" }}
      >
        <IconeDoPrototipo nome="moon" tamanho={13} traco={2.4} />
      </span>
    );
  if (tipo === "hoje")
    return (
      <span
        style={{
          ...base,
          background: "transparent",
          boxShadow: "inset 0 0 0 2px var(--t-acc)",
        }}
      />
    );
  return <span className="jornada-dia-vazio" style={base} />;
}

const PASSO: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "14px",
  background: "var(--t-sub)",
  textAlign: "left",
  color: "inherit",
  font: "inherit",
};
const PASSO_ICONE: CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  background: "var(--t-acc)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const PASSO_TEXTO: CSSProperties = {
  flexGrow: 1,
  fontSize: "13px",
  fontWeight: 700,
  minWidth: 0,
};
const PASSO_ROTULO: CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: ".07em",
  textTransform: "uppercase",
  color: "var(--t-mut)",
};

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
 * Também as 7 bolinhas da semana (a marca de cada dia, `semana.dias`, 0036)
 * e o "Próximo passo" (o primeiro que ela não fez hoje, `feitasHoje`,
 * 0038), por ordem do operador. O card é um `div` com papel de botão: o
 * "Próximo passo" é um botão de verdade dentro dele.
 *
 * A Jornada nunca bloqueia o Início: sem estado ainda (carregando, ou erro
 * sem nada no cache), o card simplesmente não aparece.
 */
export function JornadaCard({ userId, onAbrir, onProximoPasso }: Props) {
  const { estado } = useJornada(userId);
  if (!estado) return null;

  const capitulo = estado.capitulo;
  const ritmoCompleto = contadorDaSemana(estado, "firme") > 0;
  const dias = diasFortesDeTres(contadorDaSemana(estado, "dias_fortes"));
  const bolinhas = bolinhasDaSemana(estado);
  const hoje = indiceDeHojeNaSemana(estado);
  const passo = proximoPasso(estado);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
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
        // O .ph do protótipo herda 16px do navegador; o Início herda 15px do
        // body (mockup das 5 telas).
        fontSize: "16px",
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
        <IconeSeta />
      </div>

      {bolinhas.length === 7 && (
        // `weekHTML(false)`: segunda a domingo, a bolinha e a letra.
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {bolinhas.map((tipo, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                fontSize: "10px",
                fontWeight: 700,
                color: i === hoje ? "var(--t-deep)" : "var(--t-mut)",
              }}
            >
              <Bolinha tipo={tipo} />
              {LETRAS_DA_SEMANA[i]}
            </div>
          ))}
        </div>
      )}

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

      {passo ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onProximoPasso(passo);
          }}
          className="transition-transform active:scale-[.97]"
          style={PASSO}
        >
          <span style={PASSO_ICONE}>
            <IconeDoPrototipo
              nome={ICONE_DO_PASSO[passo]}
              tamanho={16}
              traco={2.3}
            />
          </span>
          <span style={PASSO_TEXTO}>
            <small style={PASSO_ROTULO}>{PROXIMO_PASSO.rotulo}</small>
            {TEXTO_DO_PROXIMO_PASSO[passo]}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "12px",
              fontWeight: 800,
              color: "var(--t-deep)",
              whiteSpace: "nowrap",
            }}
          >
            {glowDoPasso(estado.glowPorAcao?.[passo]?.glow ?? 0)}
            <FaiscaCheia tamanho={11} />
          </span>
        </button>
      ) : (
        <div style={{ ...PASSO, cursor: "default" }}>
          <span style={{ ...PASSO_ICONE, background: "var(--t-green)" }}>
            <IconeDoPrototipo nome="check" tamanho={16} traco={3} />
          </span>
          <span style={PASSO_TEXTO}>
            <small style={PASSO_ROTULO}>{PROXIMO_PASSO.feitoRotulo}</small>
            {PROXIMO_PASSO.feito}
          </span>
        </div>
      )}
    </div>
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
