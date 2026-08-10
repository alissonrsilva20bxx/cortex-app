"use client";

import { useState, useEffect } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GlassCard } from "@/components/ui/GlassCard";
import { JobCard } from "./JobCard";
import { NotasSection } from "./NotasSection";
import { STATUS_META } from "./status";
import type { Job, JobStatus } from "@/lib/types";

type Filter = "todos" | JobStatus;
type Period = "sem" | "mes" | "ano";
type RatchetDirection = "forward" | "backward";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "agendado", label: "Agendado" },
  { id: "confirmado", label: "Confirmado" },
  { id: "concluído", label: "Concluído" },
  { id: "cancelado", label: "Cancelado" },
];

const PERIOD_OPTS: { id: Period; label: string }[] = [
  { id: "sem", label: "S" },
  { id: "mes", label: "M" },
  { id: "ano", label: "A" },
];

/** D S T Q Q S S — domingo a sábado, mesma ordem/rótulos do laboratório. */
const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Superfície sólida (sem blur), mesmo princípio já aplicado em Início
 * (T2): "conteúdo sólido, vidro só pra navegação/sheets". Repetido aqui
 * (não extraído pra `components/ui/`) porque o escopo deste ticket é só
 * os arquivos de `components/jobs/`.
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / 0.035), 0 10px 30px rgb(0 0 0 / 0.18)",
} as const;

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function startOfWeek(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function formatWeekRangeLabel(start: Date): string {
  const end = addDays(start, 6);
  const startMonth = start
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  const endMonth = end
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  if (startMonth === endMonth) {
    return `${start.getDate()}–${end.getDate()} de ${startMonth}`;
  }
  return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
}

function formatSelectedDateLabel(iso: string): string {
  const label = new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dbRowToJob(row: {
  id: string;
  cliente_nome: string;
  data: string;
  hora: string;
  valor: number;
  modalidade: "presencial" | "online";
  local: string | null;
  status: JobStatus;
  observacoes: string | null;
  criado_em: string;
}): Job {
  return {
    id: row.id,
    clienteNome: row.cliente_nome,
    data: row.data,
    hora: row.hora,
    valor: row.valor,
    modalidade: row.modalidade,
    local: row.local ?? undefined,
    status: row.status,
    observacoes: row.observacoes ?? undefined,
    criadoEm: row.criado_em,
  };
}

function buildPeriodData(
  jobs: Job[],
  period: Period
): { label: string; value: number }[] {
  const done = jobs.filter((j) => j.status === "concluído");

  if (period === "sem") {
    return Array.from({ length: 8 }, (_, i) => {
      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const value = done
        .filter((j) => {
          const d = new Date(j.data + "T00:00:00");
          return d >= start && d <= end;
        })
        .reduce((s, j) => s + j.valor, 0);
      return { label: `S${8 - i}`, value };
    }).reverse();
  }

  if (period === "mes") {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const m = (now.getMonth() - 11 + i + 12) % 12;
      const y = now.getFullYear() - (now.getMonth() - 11 + i < 0 ? 1 : 0);
      const label = new Date(y, m, 1).toLocaleDateString("pt-BR", {
        month: "short",
      });
      const value = done
        .filter((j) => {
          const d = new Date(j.data + "T00:00:00");
          return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((s, j) => s + j.valor, 0);
      return { label, value };
    });
  }

  // ano
  const nowY = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = nowY - 4 + i;
    const value = done
      .filter((j) => new Date(j.data + "T00:00:00").getFullYear() === y)
      .reduce((s, j) => s + j.valor, 0);
    return { label: String(y), value };
  });
}

interface Props {
  userId: string;
  refreshTrigger: number;
  onEditJob: (job: Job) => void;
  chartType?: "bar" | "donut";
}

export function JobsTab({
  userId,
  refreshTrigger,
  onEditJob,
  chartType = "bar",
}: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>("todos");
  const [loading, setLoading] = useState(true);
  const [chartOpen, setChartOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("sem");

  // Semana visível (calendário) e dia selecionado — não têm equivalente
  // real hoje (achado P0 #1 do relatório de paridade visual da Agenda);
  // `selectedDate` nasce em "hoje", igual ao padrão já usado em
  // GreetingHeader (useState lazy initializer, calculado uma vez).
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() =>
    toISODate(new Date())
  );
  const [ratchetDirection, setRatchetDirection] =
    useState<RatchetDirection>("forward");

  useEffect(() => {
    setLoading(true);
    supabase
      .from("jobs")
      .select("*")
      .order("data", { ascending: true })
      .order("hora", { ascending: true })
      .then(({ data }) => {
        setJobs(data ? data.map(dbRowToJob) : []);
        setLoading(false);
      });
  }, [refreshTrigger]);

  const filtered =
    filter === "todos" ? jobs : jobs.filter((j) => j.status === filter);

  const periodData = buildPeriodData(jobs, period);
  const donutSegments = (
    ["agendado", "confirmado", "concluído", "cancelado"] as JobStatus[]
  )
    .map((s) => ({
      label: STATUS_META[s].label,
      value: jobs.filter((j) => j.status === s).length,
      color: STATUS_META[s].color,
    }))
    .filter((s) => s.value > 0);

  // Dias da semana visível + quais têm compromisso (respeitando o filtro
  // de status ativo, pra o indicador do calendário ficar consistente com
  // a lista mostrada abaixo dele).
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const datesWithJobs = new Set(filtered.map((j) => j.data));
  const selectedDayJobs = filtered.filter((j) => j.data === selectedDate);

  function selectDay(iso: string) {
    if (iso === selectedDate) return;
    const oldIndex = days.indexOf(selectedDate);
    const newIndex = days.indexOf(iso);
    setRatchetDirection(newIndex >= oldIndex ? "forward" : "backward");
    setSelectedDate(iso);
  }

  // Troca de semana — sem equivalente no laboratório (ele mostra uma
  // única semana fixa, 18-24 de maio, hardcoded). Necessário no app real,
  // já que atendimentos reais existem em qualquer data, não só numa
  // semana fixa. Mantém a posição relativa (dia da semana) do que estava
  // selecionado, pra sempre apontar pra um dia visível na nova semana.
  function goToWeek(deltaWeeks: number) {
    const currentIndex = days.indexOf(selectedDate);
    const idx = currentIndex === -1 ? 0 : currentIndex;
    const nextStart = addDays(weekStart, deltaWeeks * 7);
    const nextSelected = toISODate(addDays(nextStart, idx));
    setRatchetDirection(deltaWeeks > 0 ? "forward" : "backward");
    setWeekStart(nextStart);
    setSelectedDate(nextSelected);
  }

  return (
    <div className="pb-4">
      {/* Animação "catraca" — transportada do laboratório
          (AgendaScreen, LaunchScreens.tsx + styles/globals.css:578-638)
          de forma isolada via styled-jsx (escopada só a este componente,
          sem editar styles/globals.css). Duas diferenças deliberadas
          frente ao original, ambas do relatório de paridade visual:
          (1) sem o prefixo `.launch-preview` — assim a regra global e
          desescopada de `prefers-reduced-motion` que o app real já tem
          (styles/globals.css:571-580) cobre esta animação automaticamente,
          sem duplicar a regra nem replicar o escopo isolado que deixava a
          catraca do laboratório fora do alcance de reduced-motion; (2)
          `--jobapp-ease-spring` não existe em lugar nenhum do laboratório
          (variável referenciada mas nunca definida — cai em "ease" por
          padrão do CSS) — usamos aqui uma curva de mola explícita
          (cubic-bezier(0.34,1.56,0.64,1)) em vez de herdar essa referência
          quebrada. */}
      <style jsx>{`
        .agenda-ratchet-day {
          transform-origin: center 72%;
          transition:
            color 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
            background-color 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
            box-shadow 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
            transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .agenda-ratchet-day[data-selected="true"] {
          transform: translateY(-3px) scale(1.035);
        }
        .agenda-ratchet-day[data-selected="true"] .agenda-ratchet-number {
          animation: agenda-ratchet-tick 220ms
            cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .agenda-ratchet-panel {
          transform-origin: 50% 0;
          animation: agenda-ratchet-panel-forward 220ms
            cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .agenda-ratchet-panel[data-direction="backward"] {
          animation-name: agenda-ratchet-panel-backward;
        }
        @keyframes agenda-ratchet-tick {
          0% {
            opacity: 0.45;
            transform: translateY(-7px) rotateX(-68deg);
          }
          65% {
            opacity: 1;
            transform: translateY(1px) rotateX(8deg);
          }
          100% {
            transform: translateY(0) rotateX(0);
          }
        }
        @keyframes agenda-ratchet-panel-forward {
          0% {
            opacity: 0.4;
            transform: translateX(10px) rotateY(-3deg);
          }
          100% {
            opacity: 1;
            transform: translateX(0) rotateY(0);
          }
        }
        @keyframes agenda-ratchet-panel-backward {
          0% {
            opacity: 0.4;
            transform: translateX(-10px) rotateY(3deg);
          }
          100% {
            opacity: 1;
            transform: translateX(0) rotateY(0);
          }
        }
      `}</style>

      {/* Cabeçalho — "Agenda", 22px/semibold/-0.055em, como o laboratório
          (ScreenTitle, LaunchScreens.tsx:677-704). O "+" do laboratório
          não foi portado: a criação de atendimento já tem um gatilho real
          (FAB contextual, fora do escopo de arquivos deste ticket) —
          adicionar um segundo botão de criação aqui duplicaria a ação sem
          estar de fato fiado a nada (JobsTab não recebe callback de
          criação). Contador preservado do componente anterior (dado
          real, não existe no laboratório). */}
      <div className="flex items-baseline gap-2 mb-5">
        <h1
          className="font-semibold"
          style={{
            fontSize: "22px",
            letterSpacing: "-0.055em",
            color: "var(--text)",
          }}
        >
          Agenda
        </h1>
        {!loading && (
          <span
            className="text-xs font-bold tabular-nums px-2 py-px rounded-full"
            style={{
              background: "rgb(var(--accent-rgb) / 0.12)",
              color: "var(--accent)",
            }}
          >
            {filtered.length}
          </span>
        )}
      </div>

      {/* Navegação de semana — sem equivalente no laboratório (ver
          comentário de `goToWeek` acima). Setas 44×44px. */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => goToWeek(-1)}
          aria-label="Semana anterior"
          className="flex items-center justify-center active:opacity-70"
          style={{ minWidth: "44px", minHeight: "44px" }}
        >
          <ChevronLeft size={18} style={{ color: "var(--text-muted)" }} />
        </button>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {formatWeekRangeLabel(weekStart)}
        </span>
        <button
          onClick={() => goToWeek(1)}
          aria-label="Próxima semana"
          className="flex items-center justify-center active:opacity-70"
          style={{ minWidth: "44px", minHeight: "44px" }}
        >
          <ChevronRight size={18} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* Semana horizontal — grade de 7 dias, como o laboratório
          (grid-cols-7, células 58px, raio 12px = var(--radius-sm), mais
          perto do design system real que os 13px literais do laboratório).
          Ponto indicado (dia selecionado, branco) e ponto de compromisso
          (dias não selecionados com atendimento, cor de destaque) — o
          segundo não existe no laboratório; adicionado porque a missão
          exige "indicação visual clara de dias com compromissos". */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((iso) => {
          const d = new Date(iso + "T00:00:00");
          const selected = iso === selectedDate;
          const hasJobs = datesWithJobs.has(iso);
          return (
            <button
              key={iso}
              onClick={() => selectDay(iso)}
              aria-label={`Dia ${d.getDate()}`}
              aria-pressed={selected}
              data-selected={selected}
              className="agenda-ratchet-day flex flex-col items-center justify-center"
              style={{
                height: "58px",
                borderRadius: "var(--radius-sm)",
                background: selected ? "var(--accent)" : "transparent",
                color: selected ? "white" : "var(--text-muted)",
                boxShadow: selected ? "var(--glow-sm)" : "none",
              }}
            >
              <span
                className="font-semibold"
                style={{ fontSize: "10px" }}
              >
                {WEEKDAY_LETTERS[d.getDay()]}
              </span>
              <strong
                className="agenda-ratchet-number font-semibold"
                style={{ fontSize: "15px", marginTop: "8px" }}
              >
                {d.getDate()}
              </strong>
              <span
                className="rounded-full"
                style={{
                  marginTop: "4px",
                  width: "4px",
                  height: "4px",
                  background: selected
                    ? "white"
                    : hasJobs
                      ? "var(--accent)"
                      : "transparent",
                  opacity: selected ? 1 : 0.6,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Painel do dia selecionado — data por extenso + filtro de status
          (dado real preservado, escopado ao dia) + lista/estado vazio.
          Remonta a cada troca de dia (`key`) pra tocar a animação. */}
      <div
        key={selectedDate}
        data-direction={ratchetDirection}
        className="agenda-ratchet-panel mt-5"
      >
        <div
          className="flex items-center gap-2 mb-2.5"
          style={{ color: "var(--text-muted)" }}
        >
          <CalendarDays size={14} />
          <h2 className="font-medium" style={{ fontSize: "11px" }}>
            {formatSelectedDateLabel(selectedDate)}
          </h2>
        </div>

        {/* Filtro de status — reimplementado localmente (não o componente
            compartilhado `FilterChips`, usado também no Cofre): o
            relatório de paridade encontrou que `FilterChips` renderiza
            ~28px de altura, abaixo do alvo mínimo de 44px, mas é
            compartilhado fora do escopo deste ticket (mudar o componente
            afetaria o Cofre, "não amplie para... outras abas"). Mesmo
            visual, só com alvo de toque corrigido. */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar mb-3">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                aria-pressed={active}
                className="shrink-0 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center"
                style={{
                  minHeight: "44px",
                  background: active
                    ? "rgb(var(--accent-rgb) / 0.18)"
                    : "var(--surface)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  boxShadow: active ? "var(--glow-sm)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center pt-8">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : selectedDayJobs.length === 0 ? (
          <GlassCard
            radius="md"
            className="flex flex-col items-center justify-center px-6 text-center"
            style={{ ...SOLID_SURFACE_STYLE, minHeight: "118px" }}
          >
            <CalendarDays size={22} style={{ color: "var(--text-muted)" }} />
            <p
              className="font-semibold mt-3"
              style={{ fontSize: "12px", color: "var(--text)" }}
            >
              Nenhum compromisso neste dia
            </p>
            <p
              className="mt-1"
              style={{ fontSize: "10px", color: "var(--text-muted)" }}
            >
              {filter === "todos"
                ? "Toque no + para adicionar um atendimento."
                : `Nenhum atendimento "${filter}" neste dia.`}
            </p>
          </GlassCard>
        ) : (
          <GlassCard
            radius="md"
            className="divide-y divide-[var(--border-color)] overflow-hidden"
            style={SOLID_SURFACE_STYLE}
          >
            {selectedDayJobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={onEditJob} />
            ))}
          </GlassCard>
        )}
      </div>

      {/* Gráfico colapsável — preservado (dado real, preferência real via
          `chartType`), só com a mesma superfície sólida do resto da tela
          e o alvo de toque do cabeçalho corrigido (~40px → 44px, achado
          P2 #7 do relatório de paridade). */}
      {!loading && jobs.length > 0 && (
        <div
          className="rounded-2xl mt-5 overflow-hidden"
          style={SOLID_SURFACE_STYLE}
        >
          <button
            className="flex items-center justify-between w-full px-4"
            style={{ minHeight: "44px" }}
            onClick={() => setChartOpen((v) => !v)}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {chartType === "donut" ? "Distribuição por status" : "Receitas"}
            </span>
            <ChevronDown
              size={14}
              style={{
                color: "var(--text-muted)",
                transform: chartOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.25s ease",
              }}
            />
          </button>
          <div
            style={{
              maxHeight: chartOpen ? "320px" : 0,
              overflow: "hidden",
              transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div className="px-4 pb-4">
              {chartType === "donut" ? (
                <div className="flex justify-center pt-2">
                  <DonutChart
                    segments={donutSegments}
                    size={130}
                    centerValue={String(jobs.length)}
                    centerLabel="atend."
                  />
                </div>
              ) : (
                <>
                  {/* Period selector */}
                  <div className="flex justify-end mb-3">
                    <SegmentedControl
                      size="sm"
                      options={PERIOD_OPTS}
                      value={period}
                      onChange={setPeriod}
                    />
                  </div>
                  <MiniBarChart data={periodData} height={100} id="jobs-bar" />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <NotasSection userId={userId} />
    </div>
  );
}
