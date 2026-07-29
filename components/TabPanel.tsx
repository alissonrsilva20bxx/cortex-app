"use client";

import type { ReactNode } from "react";
import type { TabId } from "@/lib/types";

/**
 * Mantém a aba montada em segundo plano (display:none) em vez de
 * desmontar ao trocar — evita reconsultar o Supabase toda vez que a
 * usuária volta pra uma aba já visitada. `animate-fade-up` reaplica
 * sozinha: navegadores reiniciam animações CSS quando o elemento sai
 * de display:none, então cada troca ainda ganha a transição.
 */
interface Props {
  tab: TabId;
  activeTab: TabId;
  children: ReactNode;
}

export function TabPanel({ tab, activeTab, children }: Props) {
  return (
    <div
      className="animate-fade-up"
      style={{ display: activeTab === tab ? "block" : "none" }}
    >
      {children}
    </div>
  );
}
