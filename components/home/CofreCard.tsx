"use client";

import { InicioCard } from "./InicioCard";
import { CARD_PEQUENO, IconeCard, ROTULO_CARD } from "./pecasMockup";

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

  // Mockup: card `--t-hero`, texto branco, rótulo `--t-hero-mut`.
  return (
    <InicioCard tom="cofre" onClick={onOpenCofre} style={CARD_PEQUENO}>
      <IconeCard cor="currentColor">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </IconeCard>
      <span style={{ ...ROTULO_CARD, color: "var(--t-hero-mut)" }}>Cofre</span>
      <span style={{ fontSize: "16px", fontWeight: 800 }}>Protegido</span>
    </InicioCard>
  );
}
