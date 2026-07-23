"use client";

import { useState } from "react";
import { Sparkles, Target, CalendarPlus, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { HeroCard } from "@/components/home/HeroCard";
import { PinSetup } from "@/components/pin/PinSetup";
import type { Job, Meta, Usuario } from "@/lib/types";

/**
 * Fluxo guiado do 1º uso (§6 do spec): login → 1ª meta → 1º atendimento →
 * projeção viva (o "aha") → oferta de PIN. Mínimo de passos até o "aha" —
 * cada etapa pode ser pulada (nunca prende a usuária) e a etapa seguinte é
 * derivada dos dados reais (meta/atendimento já existem?), não de um
 * progresso imperativo — sobrevive a qualquer timing de rede.
 */

type Step = "welcome" | "goal" | "job" | "aha";

interface Props {
  usuario: Usuario;
  jobs: Job[];
  metas: Meta[];
  /** Abre o formulário global de atendimento (já montado em page.tsx). */
  onOpenJobForm: () => void;
  /** Dispara o refetch de metas em page.tsx após salvar a meta mensal. */
  onMetaSaved: () => void;
  /** Espelha o pin_hash salvo de volta pro estado de page.tsx. */
  onPinSaved: (hash: string) => void;
  /** Onboarding terminou (com ou sem PIN) — volta pra Home normal. */
  onComplete: () => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  color: "var(--text)",
  fontSize: "15px",
  padding: "12px 14px",
  width: "100%",
  outline: "none",
};

export function OnboardingFlow({
  usuario,
  jobs,
  metas,
  onOpenJobForm,
  onMetaSaved,
  onPinSaved,
  onComplete,
}: Props) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [goalStepDone, setGoalStepDone] = useState(false);
  const [jobStepDone, setJobStepDone] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);

  const [goalValue, setGoalValue] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  const firstName = usuario.nome.split(" ")[0];
  const hasMonthlyGoal = metas.some(
    (m) => m.periodo === "mes" && m.valorAlvo > 0
  );

  let step: Step;
  if (!welcomeDismissed) step = "welcome";
  else if (!hasMonthlyGoal && !goalStepDone) step = "goal";
  else if (jobs.length === 0 && !jobStepDone) step = "job";
  else step = "aha";

  async function handleSaveGoal() {
    const valor = parseFloat(goalValue);
    if (isNaN(valor) || valor <= 0) {
      return setGoalError("Digite um valor válido.");
    }
    setSavingGoal(true);
    setGoalError(null);
    const { error } = await supabase
      .from("metas")
      .upsert(
        { user_id: usuario.id, periodo: "mes", valor_alvo: valor },
        { onConflict: "user_id,periodo" }
      );
    setSavingGoal(false);
    if (error) return setGoalError(error.message);
    onMetaSaved();
    setGoalStepDone(true);
  }

  function handlePinSaved(hash: string) {
    onPinSaved(hash);
    onComplete();
  }

  return (
    <div className="flex flex-col items-center pt-10 pb-6 text-center">
      {step === "welcome" && (
        <>
          <div
            className="flex items-center justify-center rounded-full mb-6"
            style={{
              width: 64,
              height: 64,
              background:
                "linear-gradient(135deg, rgb(var(--accent-rgb) / 0.25), rgb(var(--accent-rgb) / 0.08))",
              border: "1px solid rgb(var(--accent-rgb) / 0.3)",
              boxShadow: "var(--glow-sm)",
            }}
          >
            <Sparkles size={26} style={{ color: "var(--accent)" }} />
          </div>
          <h1
            className="font-extrabold mb-2"
            style={{
              fontSize: "24px",
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            Bom te ver, {firstName}.
          </h1>
          <p
            className="text-sm leading-relaxed mb-8 max-w-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Aqui você organiza seus atendimentos e acompanha, no seu ritmo, o
            quanto já construiu. Duas coisas rápidas antes de começar.
          </p>
          <button
            onClick={() => setWelcomeDismissed(true)}
            className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Vamos começar
          </button>
        </>
      )}

      {step === "goal" && (
        <>
          <div
            className="flex items-center justify-center rounded-full mb-6"
            style={{
              width: 56,
              height: 56,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <Target size={24} style={{ color: "var(--accent)" }} />
          </div>
          <h1
            className="font-extrabold mb-2"
            style={{
              fontSize: "22px",
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            O que você quer construir?
          </h1>
          <p
            className="text-sm leading-relaxed mb-6 max-w-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Uma reserva, uma viagem, o início do seu patrimônio — o que for,
            começa com uma meta mensal.
          </p>
          <div className="w-full max-w-xs text-left mb-5">
            <label
              className="text-xs font-semibold uppercase tracking-wider mb-2 block"
              style={{ color: "var(--text-muted)" }}
            >
              Meta mensal (R$)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              autoFocus
              style={inputStyle}
              placeholder="Ex: 3.000"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
            />
            {goalError && (
              <p className="text-sm mt-2" style={{ color: "var(--danger)" }}>
                {goalError}
              </p>
            )}
          </div>
          <button
            onClick={handleSaveGoal}
            disabled={savingGoal}
            className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {savingGoal ? "Salvando…" : "Definir minha meta"}
          </button>
          <button
            onClick={() => setGoalStepDone(true)}
            className="mt-4 text-sm font-medium active:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            Prefiro fazer isso depois
          </button>
        </>
      )}

      {step === "job" && (
        <>
          <div
            className="flex items-center justify-center rounded-full mb-6"
            style={{
              width: 56,
              height: 56,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <CalendarPlus size={24} style={{ color: "var(--accent)" }} />
          </div>
          <h1
            className="font-extrabold mb-2"
            style={{
              fontSize: "22px",
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            Registre seu primeiro atendimento
          </h1>
          <p
            className="text-sm leading-relaxed mb-8 max-w-xs"
            style={{ color: "var(--text-muted)" }}
          >
            É o primeiro dado real — sua projeção começa a andar a partir dele.
          </p>
          <button
            onClick={onOpenJobForm}
            className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Registrar atendimento
          </button>
          <button
            onClick={() => setJobStepDone(true)}
            className="mt-4 text-sm font-medium active:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            Prefiro fazer isso depois
          </button>
        </>
      )}

      {step === "aha" && (
        <>
          <p
            className="section-label mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Essa é a sua projeção viva
          </p>
          <div className="w-full mb-6">
            <HeroCard jobs={jobs} metas={metas} onGoToFinanceiro={() => {}} />
          </div>
          <p
            className="text-sm leading-relaxed mb-6 max-w-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Ela anda a cada atendimento que você registrar. Agora, se quiser,
            proteja seu espaço.
          </p>
          <GlassCard
            radius="md"
            onClick={() => setPinSetupOpen(true)}
            className="flex items-center gap-3.5 px-4 py-4 w-full max-w-xs mb-3"
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 36,
                height: 36,
                background: "rgb(var(--accent-rgb) / 0.12)",
              }}
            >
              <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div className="text-left">
              <p
                className="font-semibold"
                style={{ fontSize: "14px", color: "var(--text)" }}
              >
                Proteger meu espaço
              </p>
              <p
                className="mt-0.5 font-medium"
                style={{ fontSize: "12px", color: "var(--text-muted)" }}
              >
                Ativa um PIN de 4 dígitos neste aparelho
              </p>
            </div>
          </GlassCard>
          <button
            onClick={onComplete}
            className="text-sm font-medium active:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            Continuar sem PIN por agora
          </button>
        </>
      )}

      <PinSetup
        open={pinSetupOpen}
        userId={usuario.id}
        onClose={() => setPinSetupOpen(false)}
        onSaved={handlePinSaved}
      />
    </div>
  );
}
