"use client";

import { ShieldCheck } from "lucide-react";
import { InicioCard } from "./InicioCard";

interface Props {
  /** O Cofre tem PIN configurado. */
  protegido: boolean;
  onOpenCofre: () => void;
}

/**
 * Card "Cofre" da grade da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): o card escuro com "Protegido".
 * Só aparece quando o Cofre tem PIN -- o mockup não mostra o estado sem
 * PIN, e um rótulo pra ele seria texto inventado (registrado no PR).
 */
export function CofreCard({ protegido, onOpenCofre }: Props) {
  if (!protegido) return null;

  return (
    <InicioCard
      tom="cofre"
      onClick={onOpenCofre}
      className="flex flex-col gap-2"
      style={{ padding: "16px" }}
    >
      <ShieldCheck size={20} aria-hidden />
      <span
        className="font-semibold"
        style={{ fontSize: "11px", color: "var(--hero-text-muted)" }}
      >
        Cofre
      </span>
      <span className="font-extrabold" style={{ fontSize: "16px" }}>
        Protegido
      </span>
    </InicioCard>
  );
}
