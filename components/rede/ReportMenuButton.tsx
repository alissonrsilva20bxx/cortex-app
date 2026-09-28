"use client";

import { useState } from "react";
import { MoreHorizontal, Flag } from "lucide-react";
import { OptionsSheet } from "./OptionsSheet";

interface Props {
  /** Só chama o gatilho real (RedeTab: `setReportTarget`) -- este
   * componente não sabe nada sobre confirmação de motivo, serviço
   * (`criarDenuncia`) ou feedback (toast); tudo isso é o mesmo fluxo que o
   * "..." do `PostCard` já usa, reaproveitado sem duplicação. */
  onReport: () => void;
}

/**
 * "..." discreto que só oferece "Denunciar publicação" -- usado no
 * cabeçalho do `ProfilePhotoViewer` (posts com foto) e sobreposto na
 * célula sem foto da grade (`ProfilePostsGrid`, que não abre visualizador
 * nenhum pra essas). Ticket #140 (achado do review de Standards em cima de
 * #139): a grade/visualizador do perfil excluem curtir/comentar/
 * compartilhar de propósito ("já existem no feed"), mas denunciar é
 * moderação/segurança, categoricamente diferente -- não pode desaparecer
 * só porque um post saiu da paginação do feed.
 *
 * Nunca renderizado pra posts do próprio usuário -- decidido pelo
 * chamador (só passa `onReportPost` quando `!isMe`), não aqui: este
 * componente nem recebe informação de autoria, só aparece ou não.
 *
 * Só 1 opção na lista, sem "Cancelar" explícito (diferente do menu
 * "Publicação" do `PostCard`, que tem Denunciar+Cancelar): o
 * `BottomSheet` por baixo já oferece fechar via X (44×44) e toque no
 * fundo -- um "Cancelar" faria a mesma coisa duas vezes. Decisão explícita
 * do usuário 2026-09-23 ("menu com somente Denunciar publicação").
 */
export function ReportMenuButton({ onReport }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Alvo de toque real em 44×44 (achado #56, mesmo truque de
          PostCard.tsx: `width/height: 44` no <button>, círculo visual
          menor por dentro) -- o círculo de 32px sozinho, como na 1ª
          versão, era discreto demais pro mínimo documentado no repo. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Mais opções"
        className="flex items-center justify-center active:opacity-70"
        style={{ width: 44, height: 44 }}
      >
        <span
          aria-hidden="true"
          className="flex items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
          }}
        >
          <MoreHorizontal size={16} />
        </span>
      </button>
      <OptionsSheet
        open={open}
        title="Publicação"
        onClose={() => setOpen(false)}
        options={[
          {
            key: "denunciar",
            label: "Denunciar publicação",
            Icon: Flag,
            danger: true,
            onSelect: onReport,
          },
        ]}
      />
    </>
  );
}
