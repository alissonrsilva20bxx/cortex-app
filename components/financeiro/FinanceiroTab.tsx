"use client";

import { useState, useEffect, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { calcEarnings } from "@/lib/finance";
import { DEFAULT_METAS } from "./constants";
import { FinanceiroHeroCard } from "./FinanceiroHeroCard";
import { VisaoTab } from "./VisaoTab";
import { EntradasTab } from "./EntradasTab";
import { SaidasTab } from "./SaidasTab";
import { MetasTab } from "./MetasTab";
import type {
  Job,
  Meta,
  Despesa,
  ReceitaAvulsa,
  Objetivo,
  PeriodoMeta,
} from "@/lib/types";

type InnerTab = "visao" | "entradas" | "saidas" | "metas";

/**
 * "Agosto de 2026" — mês/ano corrente por extenso, capitalizado. O
 * laboratório mostra uma pílula de período ("Maio de 2025 ⌄") como
 * seletor decorativo (sem função real, nunca muda o mês de referência
 * dos cálculos). Não portamos o seletor (exigiria lógica nova, fora do
 * escopo visual deste ticket) — só o rótulo de contexto, calculado a
 * partir da data real, sem seta/chevron (não é clicável).
 */
function getMonthYearLabel(): string {
  const label = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const TABS: { id: InnerTab; label: string }[] = [
  { id: "visao", label: "Visão" },
  { id: "entradas", label: "Entradas" },
  { id: "saidas", label: "Saídas" },
  { id: "metas", label: "Metas" },
];

interface Props {
  userId: string;
  refreshTrigger: number;
  chartType?: "bar" | "area";
  onInnerTabChange?: (tab: string) => void;
  onAddDespesa?: () => void;
  onAddReceita?: () => void;
  objetivos: Objetivo[];
  onObjetivoAdded: () => void;
  onToggleObjetivo: (id: string, done: boolean) => Promise<void>;
  /**
   * Pulso de navegação (não estado controlado): a Início precisa abrir
   * diretamente na sub-aba Metas ao vir de "Ver todos"/"objetivos"
   * (contrato de paridade, seção Início — "acesso à aba Metas"), não só
   * no Financeiro em si. Como `FinanceiroTab` fica sempre montada
   * (TabPanel usa display:none, não desmonta — ver TabPanel.tsx), um
   * valor inicial de useState só valeria na 1ª visita; um pulso que o
   * componente-pai zera logo depois (via `onFocusTabHandled`) funciona
   * em qualquer visita seguinte sem brigar com clique manual da usuária
   * na SegmentedControl depois.
   */
  focusTab?: InnerTab | null;
  onFocusTabHandled?: () => void;
}

export function FinanceiroTab({
  userId,
  refreshTrigger,
  chartType = "bar",
  onInnerTabChange,
  onAddDespesa,
  onAddReceita,
  objetivos,
  onObjetivoAdded,
  onToggleObjetivo,
  focusTab,
  onFocusTabHandled,
}: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metas, setMetas] = useState<Meta[]>(DEFAULT_METAS);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<ReceitaAvulsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<InnerTab>("visao");
  const monthYearLabel = useMemo(getMonthYearLabel, []);

  // Estado de erro (issue #136, mesmo padrão já estabelecido em
  // JobsTab.tsx/Agenda #135 — RedeTab.tsx antes disso): distingue "falha
  // ao carregar" de "carregou e não tem nada". `loadError` marca a
  // última tentativa como falha; `hasLoadedOnce` marca se já existe uma
  // leitura completa e bem-sucedida nesta sessão; `retryNonce` é o pulso
  // que "Tentar novamente" usa pra redisparar o efeito abaixo.
  const [loadError, setLoadError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  function changeTab(t: InnerTab) {
    setTab(t);
    onInnerTabChange?.(t);
  }

  useEffect(() => {
    if (!focusTab) return;
    changeTab(focusTab);
    onFocusTabHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTab]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .order("data", { ascending: false })
        .order("hora", { ascending: false }),
      supabase.from("metas").select("*").eq("user_id", userId),
      supabase
        .from("despesas")
        .select("*")
        .eq("user_id", userId)
        .order("data", { ascending: false }),
      supabase
        .from("receitas_avulsas")
        .select("*")
        .eq("user_id", userId)
        .order("data", { ascending: false }),
    ]).then(([jobsRes, metasRes, despRes, recRes]) => {
      if (!ativo) return;

      // Qualquer uma das 4 falhando é tratado como falha do conjunto —
      // nunca aplicar as 3 que deram certo e deixar a 4ª intacta: saldo/
      // gráfico misturariam dado fresco com dado velho de períodos
      // diferentes, uma inconsistência silenciosa pior que só mostrar o
      // erro. Não zera nenhum dos 4 estados — preserva o que já estava
      // carregado (revalidação segura).
      const anyError =
        jobsRes.error || metasRes.error || despRes.error || recRes.error;
      if (anyError) {
        console.error(
          "[FinanceiroTab] falha ao carregar dados financeiros:",
          anyError.message
        );
        setLoadError(true);
        setLoading(false);
        return;
      }

      if (jobsRes.data) {
        setJobs(
          jobsRes.data.map((r) => ({
            id: r.id,
            clienteNome: r.cliente_nome,
            data: r.data,
            hora: r.hora,
            valor: r.valor,
            modalidade: r.modalidade,
            local: r.local ?? undefined,
            status: r.status,
            observacoes: r.observacoes ?? undefined,
            criadoEm: r.criado_em,
          }))
        );
      }
      if (metasRes.data && metasRes.data.length > 0) {
        setMetas(
          metasRes.data.map((r) => ({
            periodo: r.periodo as PeriodoMeta,
            valorAlvo: r.valor_alvo,
          }))
        );
      }
      if (despRes.data) {
        setDespesas(
          despRes.data.map((r) => ({
            id: r.id,
            descricao: r.descricao,
            valor: r.valor,
            categoria: r.categoria,
            data: r.data,
            criadoEm: r.criado_em,
          }))
        );
      }
      if (recRes.data) {
        setReceitas(
          recRes.data.map((r) => ({
            id: r.id,
            descricao: r.descricao,
            valor: r.valor,
            categoria: r.categoria,
            data: r.data,
            criadoEm: r.criado_em,
          }))
        );
      }
      setHasLoadedOnce(true);
      setLoadError(false);
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [userId, refreshTrigger, retryNonce]);

  function retryLoadFinanceiro() {
    setRetryNonce((n) => n + 1);
  }

  // `loading` sozinho não decide o que mostrar — mesma lição de
  // JobsTab.tsx (#135): durante uma revalidação em segundo plano (retry
  // com dado já carregado), a UI continua mostrando o que já tinha, não
  // volta pro spinner nem esconde o hero/sub-abas. `blockingError` é
  // quando não há nem dado nem carga em andamento pra mostrar.
  const initialLoading = loading && !hasLoadedOnce;
  const blockingError = loadError && !hasLoadedOnce;

  const now = new Date();
  const despMes = despesas.filter((d) => {
    const dd = new Date(d.data + "T00:00:00");
    return (
      dd.getMonth() === now.getMonth() && dd.getFullYear() === now.getFullYear()
    );
  });
  const totalDespMes = despMes.reduce((s, d) => s + d.valor, 0);
  const totalEntradaMes = calcEarnings(jobs, receitas, "mes");
  const saldo = totalEntradaMes - totalDespMes;

  async function deleteDespesa(id: string) {
    await supabase.from("despesas").delete().eq("id", id);
    setDespesas((prev) => prev.filter((d) => d.id !== id));
  }

  async function deleteReceita(id: string) {
    await supabase.from("receitas_avulsas").delete().eq("id", id);
    setReceitas((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="pb-4">
      {/* Cabeçalho — 22px/semibold/-0.055em, como o `ScreenTitle` do
          laboratório (LaunchScreens.tsx:677-704, mesmo usado por
          AgendaScreen). Rótulo de mês/ano abaixo é dado real (data
          atual), não a pílula decorativa do laboratório. */}
      <h1
        className="font-semibold"
        style={{
          fontSize: "22px",
          letterSpacing: "-0.055em",
          color: "var(--text)",
        }}
      >
        Financeiro
      </h1>
      <p
        className="mt-1 mb-4"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        {monthYearLabel}
      </p>

      {/* Falha ao revalidar com dado já carregado — mesmo padrão visual
          já estabelecido em JobsTab.tsx (#135, que por sua vez seguiu o
          banner `offline` de ChatListScreen.tsx/Rede): não-bloqueante,
          hero/sub-abas continuam abaixo com o dado preservado. */}
      {loadError && hasLoadedOnce && (
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 mb-4 text-xs font-medium"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-2)",
          }}
        >
          <AlertCircle
            size={14}
            className="shrink-0"
            style={{ color: "var(--danger)" }}
          />
          <span className="flex-1">
            Não foi possível atualizar. Mostrando dados já carregados.
          </span>
          <button
            onClick={retryLoadFinanceiro}
            disabled={loading}
            className="font-bold shrink-0 active:opacity-70 disabled:opacity-50"
            style={{ color: "var(--accent)" }}
          >
            {loading ? "Tentando…" : "Tentar novamente"}
          </button>
        </div>
      )}

      {blockingError ? (
        // 1ª carga falhou, sem nenhum dado confirmado ainda — distinto
        // de qualquer estado "vazio de verdade" das sub-abas (que só são
        // alcançáveis depois de uma carga bem-sucedida). Sem
        // hero/sub-abas aqui: não há dado nenhum pra calcular saldo,
        // filtrar ou listar ainda.
        <GlassCard
          radius="md"
          className="flex flex-col items-center justify-center px-6 text-center"
          style={{
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
            border: "1px solid var(--danger)",
            minHeight: "160px",
          }}
        >
          <AlertCircle size={22} style={{ color: "var(--danger)" }} />
          <p
            className="font-semibold mt-3"
            style={{ fontSize: "12px", color: "var(--text)" }}
          >
            Não foi possível carregar seu financeiro
          </p>
          <p
            className="mt-1"
            style={{ fontSize: "10px", color: "var(--text-muted)" }}
          >
            Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={retryLoadFinanceiro}
            disabled={loading}
            className="mt-4 px-4 rounded-xl text-xs font-bold active:opacity-70 disabled:opacity-50"
            style={{
              minHeight: "44px",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            {loading ? "Tentando…" : "Tentar novamente"}
          </button>
        </GlassCard>
      ) : initialLoading ? (
        <div className="flex justify-center pt-12">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)" }}
          />
        </div>
      ) : (
        <>
          {/* Card-herói de saldo — sempre visível acima das 4 sub-abas,
              como /dev-preview/ios (issue #136): o `balanceCard` do
              protótipo fica fora do bloco condicional por sub-aba. */}
          <FinanceiroHeroCard
            jobs={jobs}
            receitas={receitas}
            despesas={despesas}
            totalEntradaMes={totalEntradaMes}
            totalDespMes={totalDespMes}
            saldo={saldo}
            chartType={chartType}
          />

          <SegmentedControl
            className="mb-5"
            options={TABS}
            value={tab}
            onChange={changeTab}
          />

          {tab === "visao" && (
            <VisaoTab jobs={jobs} despesas={despesas} receitas={receitas} />
          )}
          {tab === "entradas" && (
            <EntradasTab
              jobs={jobs}
              receitas={receitas}
              totalEntradaMes={totalEntradaMes}
              onAddReceita={onAddReceita}
              onDeleteReceita={deleteReceita}
            />
          )}
          {tab === "saidas" && (
            <SaidasTab
              despesas={despesas}
              despMes={despMes}
              totalDespMes={totalDespMes}
              onAddDespesa={onAddDespesa}
              onDeleteDespesa={deleteDespesa}
            />
          )}
          {tab === "metas" && (
            <MetasTab
              jobs={jobs}
              receitas={receitas}
              metas={metas}
              objetivos={objetivos}
              userId={userId}
              onObjetivoAdded={onObjetivoAdded}
              onToggleObjetivo={onToggleObjetivo}
            />
          )}
        </>
      )}
    </div>
  );
}
