"use client";

import { useEffect } from "react";
import { useToast } from "@/components/Toast";
import { TEXTOS_AUTH } from "@/lib/textosAuth";

/** `?error=` no endereço e o endereço sem ele (os outros parâmetros ficam). */
export function tirarErroDaUrl(search: string): {
  temErro: boolean;
  semErro: string;
} {
  const params = new URLSearchParams(search);
  const temErro = params.has("error");
  params.delete("error");
  const resto = params.toString();
  return { temErro, semErro: resto ? `?${resto}` : "" };
}

/**
 * Quem está logada e volta do Google com falha (a reconfirmação do PIN) cai
 * em /login?error=, e o middleware a leva ao início com o `?error=` junto.
 * Aqui o início mostra o aviso, que fica até a pessoa agir (R18rev BAIXA
 * 4), e tira o parâmetro do endereço (recarregar não repete o aviso). O
 * valor do parâmetro nunca é lido, como no login.
 */
export function useAvisoErroDeEntrada(): void {
  const toast = useToast();
  useEffect(() => {
    const { temErro, semErro } = tirarErroDaUrl(window.location.search);
    if (!temErro) return;
    toast.error(TEXTOS_AUTH.erro.entrada, { ateAgir: true });
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + semErro + window.location.hash
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
