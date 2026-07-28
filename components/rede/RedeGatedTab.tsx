"use client";

import { useState } from "react";
import { RedeTeaserGate } from "./RedeTeaserGate";
import { SerialKeySheet } from "./SerialKeySheet";
import { RedeTab } from "./RedeTab";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario;
  onChatFocusChange?: (focused: boolean) => void;
}

/** Vitrine → código de acesso → Feed completo. Usado tanto na rota real (/)
 * quanto no shell mockado de /dev-preview/app. */
export function RedeGatedTab({ usuario, onChatFocusChange }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [keySheetOpen, setKeySheetOpen] = useState(false);

  if (unlocked) {
    return <RedeTab usuario={usuario} onChatFocusChange={onChatFocusChange} />;
  }

  return (
    <>
      <RedeTeaserGate onRequestJoin={() => setKeySheetOpen(true)} />
      <SerialKeySheet
        open={keySheetOpen}
        onClose={() => setKeySheetOpen(false)}
        onConfirm={() => {
          setKeySheetOpen(false);
          setUnlocked(true);
        }}
      />
    </>
  );
}
