import { espacoExtraParaPilulaPx } from "@/lib/bottomNavCompactStyle";

/**
 * O fim do Início: espaço para o último botão rolar até ficar livre da
 * pílula do teste grátis e da barra de abas (a pílula fica fixa por cima
 * do conteúdo; ela não se esconde). A área segura do iPhone sobe a pílula,
 * então sobe o espaço junto.
 */
export function EspacoDaPilula() {
  return (
    <div
      aria-hidden="true"
      data-espaco-da-pilula
      style={{
        height: `calc(${espacoExtraParaPilulaPx()}px + env(safe-area-inset-bottom, 0px))`,
      }}
    />
  );
}
