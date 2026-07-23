"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatBRL, monthEarnings, monthConcludedCount } from "@/lib/finance";
import type { Job } from "@/lib/types";

/**
 * Recap do mês fechado (§7.3): "Você construiu R$ X em <mês> — no seu
 * ritmo." Aparece uma vez por mês, só quando há algo a celebrar — se o mês
 * anterior não teve nenhum atendimento concluído, não aparece (nunca pune
 * mês parado, só fica em silêncio).
 */

const STORAGE_KEY = "jobapp-recap-last-shown";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Recap {
  label: string;
  total: number;
  atendimentos: number;
}

interface Props {
  jobs: Job[];
}

export function RecapSheet({ jobs }: Props) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const now = new Date();
    const currentKey = monthKey(now);
    if (localStorage.getItem(STORAGE_KEY) === currentKey) return;

    const prevRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const total = monthEarnings(jobs, prevRef);

    if (total > 0) {
      setRecap({
        label: prevRef.toLocaleDateString("pt-BR", { month: "long" }),
        total,
        atendimentos: monthConcludedCount(jobs, prevRef),
      });
    } else {
      // Nada pra celebrar — marca visto sem interromper, nunca cobra.
      localStorage.setItem(STORAGE_KEY, currentKey);
    }
  }, [jobs]);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, monthKey(new Date()));
    setDismissed(true);
  }

  return (
    <BottomSheet
      open={!!recap && !dismissed}
      onClose={handleClose}
      title="Seu recap do mês"
    >
      {recap && (
        <div className="flex flex-col items-center text-center px-5 py-8">
          <div
            className="flex items-center justify-center rounded-full mb-5"
            style={{
              width: 56,
              height: 56,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <Sparkles size={24} style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Em {recap.label}, você construiu
          </p>
          <p
            className="font-extrabold mb-2"
            style={{
              fontSize: "32px",
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            {formatBRL(recap.total)}
          </p>
          <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
            em {recap.atendimentos}{" "}
            {recap.atendimentos === 1 ? "atendimento" : "atendimentos"} — no seu
            ritmo.
          </p>
          <button
            onClick={handleClose}
            className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Continuar no meu ritmo
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
