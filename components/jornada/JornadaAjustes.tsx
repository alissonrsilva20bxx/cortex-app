"use client";

import type { Preferencias } from "@/lib/jornada/estado";
import {
  DESCRICAO_PREFERENCIA,
  PREFERENCIAS,
  SECAO,
  SUBTITULO_AJUSTES,
} from "@/lib/jornada/textos";
import { JornadaSecao } from "./JornadaPecas";

type Chave = "somLigado" | "modoDiscreto";

const ROTULO: Record<Chave, string> = {
  somLigado: PREFERENCIAS.som,
  modoDiscreto: PREFERENCIAS.modoDiscreto,
};

const DESCRICAO: Record<Chave, string> = {
  somLigado: DESCRICAO_PREFERENCIA.som,
  modoDiscreto: DESCRICAO_PREFERENCIA.modoDiscreto,
};

function trocar(chave: Chave, valor: boolean): Partial<Preferencias> {
  return chave === "somLigado" ? { somLigado: valor } : { modoDiscreto: valor };
}

/**
 * Ajustes da Jornada: Sons e Modo discreto. A chave só grava a preferência
 * (pelo `useJornada`); o que o Modo discreto muda nas telas é a J13.
 * "Mostrar no perfil" é opt-in de outra entrega: não aparece aqui.
 */
export function JornadaAjustes({
  preferencias,
  onMudar,
}: {
  preferencias: Preferencias;
  onMudar: (parcial: Partial<Preferencias>) => void;
}) {
  const chaves: Chave[] = ["somLigado", "modoDiscreto"];
  return (
    <JornadaSecao titulo={SECAO.ajustes} nota={SUBTITULO_AJUSTES}>
      <ul className="flex flex-col">
        {chaves.map((chave, i) => (
          <li
            key={chave}
            className="flex items-center gap-3"
            style={{
              padding: "10px 0",
              borderTop: i > 0 ? "1px solid var(--divider)" : undefined,
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                id={`jornada-ajuste-${chave}`}
                className="font-bold"
                style={{ fontSize: "14px" }}
              >
                {ROTULO[chave]}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {DESCRICAO[chave]}
              </span>
            </div>
            <Chavinha
              ligada={preferencias[chave]}
              rotuloId={`jornada-ajuste-${chave}`}
              onTrocar={() => onMudar(trocar(chave, !preferencias[chave]))}
            />
          </li>
        ))}
      </ul>
    </JornadaSecao>
  );
}

function Chavinha({
  ligada,
  rotuloId,
  onTrocar,
}: {
  ligada: boolean;
  rotuloId: string;
  onTrocar: () => void;
}) {
  // Área de toque 48×44 (#198); o trilho que se vê continua 48×28, e a
  // margem negativa não deixa a linha crescer.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-labelledby={rotuloId}
      onClick={onTrocar}
      className="flex shrink-0 items-center"
      style={{ width: "48px", height: "44px", margin: "-8px 0" }}
    >
      <span
        aria-hidden
        className="relative block transition-colors"
        style={{
          width: "48px",
          height: "28px",
          borderRadius: "var(--radius-pill)",
          background: ligada ? "var(--j-progresso)" : "var(--j-trilho)",
        }}
      >
        <span
          className="absolute rounded-full transition-transform"
          style={{
            top: "3px",
            left: "3px",
            width: "22px",
            height: "22px",
            background: "var(--j-chave-botao)",
            boxShadow: "var(--j-chave-sombra)",
            transform: ligada ? "translateX(20px)" : "none",
          }}
        />
      </span>
    </button>
  );
}
