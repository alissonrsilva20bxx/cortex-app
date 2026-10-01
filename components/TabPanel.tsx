"use client";

import type { ReactNode } from "react";
import type { TabId } from "@/lib/types";

/**
 * Mantém a aba montada em segundo plano (display:none) em vez de
 * desmontar ao trocar — evita reconsultar o Supabase toda vez que a
 * usuária volta pra uma aba já visitada. Troca SECA, sem fade: numa
 * tab bar do iOS a aba nova simplesmente aparece (a animação fica pra
 * navegação em profundidade — push/pop dentro da aba). O fade-up que
 * existia aqui fazia toda troca de aba parecer uma página web recarregando.
 */
interface Props {
  tab: TabId;
  activeTab: TabId;
  children: ReactNode;
}

export function TabPanel({ tab, activeTab, children }: Props) {
  return (
    <div
      data-tab-panel={tab}
      style={{ display: activeTab === tab ? "block" : "none" }}
    >
      {children}
    </div>
  );
}
