"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  userId: string;
}

export function NotasSection({ userId }: Props) {
  const [notaId, setNotaId] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase
      .from("notas")
      .select("id, conteudo")
      .eq("user_id", userId)
      .order("criado_em", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setNotaId(data[0].id);
          setConteudo(data[0].conteudo);
        }
      });
  }, [userId]);

  async function autosave(text: string) {
    setSaving(true);
    const now = new Date().toISOString();
    if (notaId) {
      await supabase
        .from("notas")
        .update({ conteudo: text, atualizado_em: now })
        .eq("id", notaId);
    } else {
      const { data } = await supabase
        .from("notas")
        .insert({
          user_id: userId,
          conteudo: text,
          criado_em: now,
          atualizado_em: now,
        })
        .select("id")
        .single();
      if (data) setNotaId(data.id);
    }
    setSaving(false);
  }

  function handleChange(text: string) {
    setConteudo(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => autosave(text), 1200);
  }

  return (
    // Sem cabeçalho próprio ("Notas Gerais") desde #135: o único uso deste
    // componente (JobsTab, aba Agenda) agora é como corpo do sheet
    // "Anotações" (BottomSheet compartilhado), que já traz o título na
    // própria casca — um segundo rótulo seria redundante. `px-5 py-5`
    // reproduz o padding padrão dos outros corpos de sheet do app (ver
    // JobDetailSheet.tsx/ClienteDetailSheet.tsx).
    <div className="px-5 py-5">
      {saving && (
        <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
          Salvando…
        </p>
      )}
      <textarea
        rows={7}
        className="w-full rounded-2xl px-4 py-3 text-sm leading-relaxed resize-none outline-none transition-colors"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-color)",
          color: "var(--text)",
        }}
        placeholder="Anotações livres, lembretes, ideias…"
        value={conteudo}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}
