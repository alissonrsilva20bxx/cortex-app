"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  mudarStatus,
  type DepsMudarStatus,
  type NovoStatus,
} from "@/lib/atendimentos/status";
import type { Job } from "@/lib/types";
import { ERRO_STATUS } from "./textosAgenda";

/** O mesmo `update` de status do JobForm, só com o status. */
const gravarNoBanco: DepsMudarStatus["atualizar"] = async (id, status) => {
  const { error } = await supabase
    .from("jobs")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  return { error };
};

/**
 * Muda o status de um atendimento pelo fluxo (Confirmar, Concluir, Não
 * aconteceu). Quem usa só recebe `mudar`, `salvando` e `erro`; depois de
 * gravar, chama `aoMudar` para recarregar Agenda, Financeiro e Início.
 */
export function useMudarStatus(aoMudar?: () => void) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const limparErro = useCallback(() => setErro(null), []);

  const mudar = useCallback(
    async (job: Job, novo: NovoStatus): Promise<boolean> => {
      if (salvando) return false;
      setSalvando(true);
      setErro(null);
      const r = await mudarStatus(job, novo, { atualizar: gravarNoBanco });
      setSalvando(false);
      if (!r.ok) {
        if (r.motivo === "falha-ao-gravar") {
          console.error("[useMudarStatus] falha ao gravar:", r.detalhe);
          setErro(ERRO_STATUS[novo]);
        } else {
          setErro(ERRO_STATUS.foraDoFluxo);
        }
        return false;
      }
      aoMudar?.();
      return true;
    },
    [salvando, aoMudar]
  );

  return { mudar, salvando, erro, limparErro };
}
