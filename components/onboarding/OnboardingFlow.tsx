"use client";

import { useState } from "react";
import { Target, CalendarPlus, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { HeroCard } from "@/components/home/HeroCard";
import { PinSetup } from "@/components/pin/PinSetup";
import { hasNoRealGoal } from "@/lib/onboarding";
import { AVISO_FALTAM_DIAS, TRIAL_DIAS } from "@/lib/assinatura";
import { formatarEuro, menorPrecoPorMes } from "@/lib/planos";
import type { Job, Meta, Usuario } from "@/lib/types";
import styles from "./linhaDoTempo.module.css";
import { Icone } from "./obIcones";

/**
 * Fluxo guiado do 1º uso (§6 do spec): boas-vindas do teste grátis → 1ª
 * meta → 1º atendimento → projeção viva (o "aha") → oferta de PIN. Mínimo
 * de passos até o "aha" — cada etapa pode ser pulada (nunca prende a
 * usuária) e a etapa seguinte é derivada dos dados reais (meta/atendimento
 * já existem?), não de um progresso imperativo — sobrevive a qualquer
 * timing de rede.
 *
 * As boas-vindas são as 3 primeiras telas do onboarding "Linha do tempo"
 * (desenho aprovado em onboarding-linha-do-tempo.html): os 7 dias grátis,
 * o que está incluso e como funciona a cobrança. "Pular" leva direto ao
 * Início, como no desenho; "Começar grátis" segue para as etapas de
 * sempre. A pílula do contador e a escolha de plano moram em
 * components/assinatura.
 */

type Step = "boasVindas" | "incluso" | "linha" | "goal" | "job" | "aha";

/** As 3 telas de boas-vindas, na ordem. */
const INTRO: Step[] = ["boasVindas", "incluso", "linha"];

function Topo({ i, onPular }: { i: number; onPular: () => void }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.prog} aria-hidden="true">
        {[0, 1, 2].map((k) => (
          <i key={k} className={k <= i ? styles.on : undefined} />
        ))}
      </div>
      <button
        type="button"
        className={styles.skipx}
        onClick={onPular}
        data-onboarding-pular
      >
        Pular
      </button>
    </div>
  );
}

/** Telas 1-3 do desenho "Linha do tempo". */
function BoasVindasTeste({
  passo,
  onAvancar,
  onPular,
}: {
  passo: number;
  onAvancar: () => void;
  onPular: () => void;
}) {
  return (
    <div className={styles.ob} data-onboarding-tela={INTRO[passo]}>
      <section
        key={passo}
        className={styles.tela}
        aria-label={
          ["Boas-vindas", "O que está incluso", "Linha do tempo"][passo]
        }
      >
        <Topo i={passo} onPular={onPular} />
        {passo === 0 && (
          <>
            <div className={styles.welcome}>
              <div className={styles.bigj} aria-hidden="true">
                <b>J</b>
              </div>
              <div className={styles.free}>
                <b>{TRIAL_DIAS}</b>
                <span>
                  dias
                  <br />
                  grátis
                </span>
              </div>
              <h1 className={styles.ttl}>
                Sua semana <em>por nossa conta</em>
              </h1>
              <p className={styles.txt}>
                Use o JobApp inteiro por {TRIAL_DIAS} dias, sem pagar nada.
                Depois, você escolhe se quer continuar.
              </p>
            </div>
            <div className={styles.grow} />
            <button type="button" className={styles.cta} onClick={onAvancar}>
              Começar meus {TRIAL_DIAS} dias
            </button>
            <p className={styles.fine}>Não pedimos cartão agora.</p>
          </>
        )}
        {passo === 1 && (
          <>
            <h1 className={styles.ttl} style={{ marginTop: 14 }}>
              Tudo isso é <em>seu</em> nos {TRIAL_DIAS} dias
            </h1>
            <div className={styles.inc}>
              <div>
                <span className={styles.ic}>
                  <Icone n="cal" />
                </span>
                <b>Agenda</b>
                <small>quem vem, quando e quanto</small>
              </div>
              <div>
                <span className={styles.ic}>
                  <Icone n="wallet" />
                </span>
                <b>Financeiro</b>
                <small>o que entrou, o que saiu e suas metas</small>
              </div>
              <div>
                <span className={styles.ic}>
                  <Icone n="shield" />
                </span>
                <b>Cofre</b>
                <small>recibos e documentos com PIN</small>
              </div>
              <div>
                <span className={styles.ic}>
                  <Icone n="users" />
                </span>
                <b>Rede</b>
                <small>outras profissionais como você</small>
              </div>
              <div className={styles.wide}>
                <span className={styles.ic}>
                  <Icone n="pulse" />
                </span>
                <span>
                  <b style={{ display: "block" }}>Jornada</b>
                  <small>
                    Glow e selos a cada passo, e metas como juntar para viajar
                  </small>
                </span>
              </div>
            </div>
            <div className={styles.grow} />
            <button type="button" className={styles.cta} onClick={onAvancar}>
              Continuar
            </button>
          </>
        )}
        {passo === 2 && (
          <>
            <h1 className={styles.ttl} style={{ marginTop: 14 }}>
              Como funciona, <em>sem surpresa</em>
            </h1>
            <ul className={styles.tl}>
              <li>
                <span className={styles.k}>
                  <Icone n="gift" s={20} />
                </span>
                <span>
                  <span className={styles.d}>Hoje</span>
                  <b>Tudo liberado</b>
                  <small>Use o app inteiro, sem limite.</small>
                </span>
              </li>
              <li>
                <span className={styles.k}>
                  <Icone n="bell" s={20} />
                </span>
                <span>
                  {/* O dia em que a pílula mostra "Faltam 2" e o aviso
                      aparece no app (AssinaturaNoApp): o dia 6. */}
                  <span className={styles.d}>
                    Dia {TRIAL_DIAS + 1 - AVISO_FALTAM_DIAS}
                  </span>
                  <b>A gente te avisa</b>
                  <small>
                    Um lembrete de que faltam {AVISO_FALTAM_DIAS} dias.
                  </small>
                </span>
              </li>
              <li>
                <span className={styles.k}>
                  <Icone n="card" s={20} />
                </span>
                <span>
                  <span className={styles.d}>Dia {TRIAL_DIAS}</span>
                  <b>O teste termina</b>
                  <small>
                    Para continuar, você escolhe um plano, a partir de{" "}
                    {formatarEuro(menorPrecoPorMes())} por mês.
                  </small>
                </span>
              </li>
            </ul>
            <div className={styles.ok}>
              <i>✓</i>
              <span>
                <b>Não pedimos cartão agora.</b>
              </span>
            </div>
            <div className={styles.ok}>
              <i>✓</i>
              <span>
                <b>Cancela quando quiser,</b> nos Ajustes.
              </span>
            </div>
            <div className={styles.grow} />
            <button type="button" className={styles.cta} onClick={onAvancar}>
              Começar grátis
            </button>
          </>
        )}
      </section>
    </div>
  );
}

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
  // 0-2: as 3 telas de boas-vindas; 3: já passou por elas.
  const [introPasso, setIntroPasso] = useState(0);
  const [goalStepDone, setGoalStepDone] = useState(false);
  const [jobStepDone, setJobStepDone] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);

  const [goalValue, setGoalValue] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  // `metas` chega pré-semeada (mes: 3000) pelo trigger de criação de
  // conta — sem isso, hasMonthlyGoal seria sempre true e a etapa nunca
  // apareceria pra ninguém (T17/#70). hasNoRealGoal trata os valores-
  // semente como "ainda não definida".
  const hasMonthlyGoal = !hasNoRealGoal(metas);

  let step: Step;
  if (introPasso < INTRO.length) step = INTRO[introPasso];
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
      {introPasso < INTRO.length && (
        <BoasVindasTeste
          passo={introPasso}
          onAvancar={() => setIntroPasso((n) => n + 1)}
          // "Pular" leva direto ao Início (desenho): o mesmo fim de sempre.
          onPular={onComplete}
        />
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
