"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquareText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/finance";
import { GlassCard } from "@/components/ui/GlassCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { JobCard } from "./JobCard";
import { JobDetailSheet } from "./JobDetailSheet";
import { AgendaResumoSheet } from "./AgendaResumoSheet";
import { NotasSection } from "./NotasSection";
import { STATUS_META } from "./status";
import type { Job, JobStatus } from "@/lib/types";

type Filter = "todos" | JobStatus;
export type Period = "sem" | "mes" | "ano";
type RatchetDirection = "forward" | "backward";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "agendado", label: "Agendado" },
  { id: "confirmado", label: "Confirmado" },
  { id: "concluído", label: "Concluído" },
  { id: "cancelado", label: "Cancelado" },
];

/** D S T Q Q S S — domingo a sábado, mesma ordem/rótulos do laboratório. */
const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Lacuna entre dois atendimentos consecutivos só ganha uma nota de
 * "próximo atendimento" (issue #135, revisão pós-fechamento) se for
 * grande o suficiente pra não virar ruído — 60min é só um limiar de
 * legibilidade da UI, NÃO uma regra de agendamento/duração de
 * atendimento (ver nota completa em `buildTimelineItems` abaixo).
 */
const NEXT_JOB_NOTE_THRESHOLD_MIN = 60;

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

/** "15h30" — mesma convenção já usada em NextJobCard/lib/notificacoes.ts. */
function formatHora(hora: string): string {
  const [h, m] = hora.split(":");
  return `${h}h${m}`;
}

function timeToMinutes(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
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

/**
 * Itens da timeline do dia selecionado (issue #135, revisão
 * pós-fechamento): cada atendimento real, intercalado com uma nota
 * neutra "Próximo atendimento às HHhMM" quando a lacuna até o próximo
 * atendimento passa do limiar de legibilidade.
 *
 * **Nunca alega que o espaço entre dois atendimentos está livre.** A
 * revisão original mostrava um selo entre os horários de início de A e
 * de B, dando a entender que aquele intervalo estava aberto pra marcar
 * algo novo. Isso não é comprovável: o tipo `Job` real não tem campo de
 * duração/hora de término, então a diferença entre o início de A e o
 * início de B **não prova** que o tempo entre eles está vago (o
 * atendimento A pode muito bem ocupar boa parte dele). Sem um dado real
 * de início E término livres — que não existe hoje — aquele selo era uma
 * promessa que o app não pode cumprir. A nota agora só descreve o que já
 * é comprovadamente real (a hora do próximo atendimento), sem
 * reivindicar nada sobre o espaço entre os dois. Continua um `<div>` sem
 * `onClick`: nunca uma função, nunca clicável.
 */
type TimelineItem =
  | { kind: "job"; job: Job }
  | { kind: "next-note"; nextLabel: string };

function buildTimelineItems(dayJobs: Job[]): TimelineItem[] {
  const sorted = [...dayJobs].sort((a, b) => a.hora.localeCompare(b.hora));
  const items: TimelineItem[] = [];
  sorted.forEach((job, i) => {
    items.push({ kind: "job", job });
    const next = sorted[i + 1];
    if (next) {
      const gapMin = timeToMinutes(next.hora) - timeToMinutes(job.hora);
      if (gapMin >= NEXT_JOB_NOTE_THRESHOLD_MIN) {
        items.push({
          kind: "next-note",
          nextLabel: formatHora(next.hora),
        });
      }
    }
  });
  return items;
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
  const [period, setPeriod] = useState<Period>("sem");

  // Estado de erro (issue #135, revisão pós-fechamento) — distinto de
  // "carregou e não tem nada" (achado: antes, `data ? ... : []` tratava
  // falha de rede/consulta exatamente como agenda vazia, um silêncio que
  // engana a usuária). `hasLoadedOnce` marca se já existe uma leitura
  // bem-sucedida nesta sessão; `loadError` marca a última tentativa como
  // falha. `retryNonce` é o pulso que o botão "Tentar novamente" usa pra
  // redisparar o efeito abaixo sem duplicar a lógica de fetch numa função
  // solta fora dele — mesmo padrão já usado em RedeTab.tsx
  // (`conversationsReloadKey`/`retryLoadConversations`).
  const [loadError, setLoadError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // Semana visível (calendário) e dia selecionado — não têm equivalente
  // real hoje (achado P0 #1 do relatório de paridade visual da Agenda);
  // `selectedDate` nasce em "hoje", igual ao padrão já usado em
  // GreetingHeader (useState lazy initializer, calculado uma vez).
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [ratchetDirection, setRatchetDirection] =
    useState<RatchetDirection>("forward");

  // "Abrir atendimento" (sheet só-leitura) e os dois sheets de
  // Resumo/Anotações — composição aprovada de /dev-preview/ios (issue
  // #135), substitui o card colapsável único de antes.
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [resumoOpen, setResumoOpen] = useState(false);
  const [anotacoesOpen, setAnotacoesOpen] = useState(false);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase
      .from("jobs")
      .select("*")
      .order("data", { ascending: true })
      .order("hora", { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          // Não zera `jobs` pra [] — preserva o que já estava carregado
          // (revalidação segura, pedido explícito da revisão). Numa 1ª
          // carga sem dado nenhum ainda, `jobs` já é [] mesmo, então o
          // painel de erro abaixo assume sozinho (ver `hasLoadedOnce`).
          console.error("[JobsTab] falha ao carregar jobs:", error.message);
          setLoadError(true);
        } else {
          setJobs(data ? data.map(dbRowToJob) : []);
          setHasLoadedOnce(true);
          setLoadError(false);
        }
        setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [refreshTrigger, retryNonce]);

  function retryLoadJobs() {
    setRetryNonce((n) => n + 1);
  }

  // `loading` sozinho não basta pra decidir o que mostrar: durante uma
  // revalidação em segundo plano (retry com `jobs` já preenchido), a UI
  // deve continuar mostrando os dados existentes, não voltar pro spinner
  // nem sumir com a timeline — só a 1ª carga (sem nada ainda) trava a
  // tela toda. `blockingError` é quando não há nem dado nem carga em
  // andamento pra mostrar: aí sim vira o painel de erro cheio, nunca o
  // "Nenhum compromisso" de dia vazio.
  const initialLoading = loading && !hasLoadedOnce;
  const blockingError = loadError && !hasLoadedOnce;

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
  // a lista mostrada abaixo dele) + qual é hoje de verdade (indicação do
  // dia atual, distinta da seleção — contrato de paridade, seção Agenda).
  const today = toISODate(new Date());
  const days = Array.from({ length: 7 }, (_, i) =>
    toISODate(addDays(weekStart, i))
  );
  const datesWithJobs = new Set(filtered.map((j) => j.data));
  const selectedDayJobs = filtered.filter((j) => j.data === selectedDate);
  const isViewingToday = selectedDate === today;
  const timelineItems = buildTimelineItems(selectedDayJobs);
  const dayTotal = selectedDayJobs.reduce((s, j) => s + j.valor, 0);

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
          animation: agenda-ratchet-tick 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
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
        {!initialLoading && !blockingError && (
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
          Três marcas independentes por dia: selecionado (fundo cheio),
          hoje-mas-não-selecionado (anel de contorno — indicação do dia
          atual, contrato de paridade da Agenda, sem equivalente no
          laboratório) e ponto de compromisso (dias com atendimento). */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((iso) => {
          const d = new Date(iso + "T00:00:00");
          const selected = iso === selectedDate;
          const isToday = iso === today;
          const hasJobs = datesWithJobs.has(iso);
          return (
            <button
              key={iso}
              onClick={() => selectDay(iso)}
              aria-label={`Dia ${d.getDate()}${isToday ? " (hoje)" : ""}`}
              aria-pressed={selected}
              data-selected={selected}
              className="agenda-ratchet-day flex flex-col items-center justify-center"
              style={{
                height: "58px",
                borderRadius: "var(--radius-sm)",
                background: selected ? "var(--accent)" : "transparent",
                color: selected ? "white" : "var(--text-muted)",
                boxShadow: selected ? "var(--glow-sm)" : "none",
                border:
                  isToday && !selected ? "1px solid var(--accent)" : "none",
              }}
            >
              <span className="font-semibold" style={{ fontSize: "10px" }}>
                {WEEKDAY_LETTERS[d.getDay()]}
              </span>
              <strong
                className="agenda-ratchet-number font-semibold"
                style={{
                  fontSize: "15px",
                  marginTop: "8px",
                  color: isToday && !selected ? "var(--accent)" : undefined,
                }}
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

      {/* Painel do dia selecionado — data por extenso + contagem real +
          filtro de status (dado real preservado, escopado ao dia) +
          timeline/estado vazio. Remonta a cada troca de dia (`key`) pra
          tocar a animação. */}
      <div
        key={selectedDate}
        data-direction={ratchetDirection}
        className="agenda-ratchet-panel mt-5"
      >
        <div className="mb-2.5">
          <div
            className="flex items-center gap-2"
            style={{ color: "var(--text-muted)" }}
          >
            <CalendarDays size={14} />
            <h2 className="font-medium" style={{ fontSize: "11px" }}>
              {formatSelectedDateLabel(selectedDate)}
            </h2>
          </div>
          {!initialLoading && !blockingError && (
            <p
              className="mt-1"
              style={{ fontSize: "11px", color: "var(--text-muted)" }}
            >
              {selectedDayJobs.length === 0
                ? "Nenhum atendimento"
                : selectedDayJobs.length === 1
                  ? "1 atendimento"
                  : `${selectedDayJobs.length} atendimentos`}
            </p>
          )}
        </div>

        {/* Falha ao revalidar com dado já carregado (issue #135, revisão
            pós-fechamento) — os dados antigos continuam abaixo intactos
            (`jobs` nunca é zerado em erro, ver o efeito de fetch), só um
            aviso não-bloqueante + "Tentar novamente". Mesmo padrão visual
            do banner `offline` de ChatListScreen.tsx (Rede) — reaproveita
            a linguagem já estabelecida no app pra esse tipo de aviso, em
            vez de inventar uma nova. */}
        {loadError && hasLoadedOnce && (
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 mb-3 text-xs font-medium"
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
              onClick={retryLoadJobs}
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
          // de "carregou e o dia está vazio de verdade" (achado real da
          // revisão: antes, `data ? ... : []` tratava as duas situações
          // como idênticas, um silêncio que engana a usuária). Sem
          // filtros/timeline/total aqui: não há dado nenhum pra filtrar
          // ou somar ainda.
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
              Não foi possível carregar sua agenda
            </p>
            <p
              className="mt-1"
              style={{ fontSize: "10px", color: "var(--text-muted)" }}
            >
              Verifique sua conexão e tente novamente.
            </p>
            <button
              onClick={retryLoadJobs}
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
        ) : (
          <>
            {/* Filtro de status — reimplementado localmente (não o
                componente compartilhado `FilterChips`, usado também no
                Cofre): o relatório de paridade encontrou que
                `FilterChips` renderiza ~28px de altura, abaixo do alvo
                mínimo de 44px, mas é compartilhado fora do escopo deste
                ticket (mudar o componente afetaria o Cofre, "não amplie
                para... outras abas"). Mesmo visual, só com alvo de toque
                corrigido. */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar mb-3 mt-2.5">
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

            {initialLoading ? (
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
                <CalendarDays
                  size={22}
                  style={{ color: "var(--text-muted)" }}
                />
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
              // Timeline por horário (issue #135, composição de
              // /dev-preview/ios) — substitui a lista plana anterior. Linha
              // vertical contínua + um ponto por atendimento + o card
              // (JobCard, já sem a própria coluna de hora — ela mora aqui,
              // fora do card) + indicador decorativo de lacuna entre
              // atendimentos (ver `buildTimelineItems`).
              <div className="relative">
                <div
                  className="absolute"
                  style={{
                    left: "40px",
                    top: "6px",
                    bottom: "6px",
                    width: "1px",
                    background: "var(--border-color)",
                  }}
                />
                <div className="space-y-4">
                  {timelineItems.map((item, i) =>
                    item.kind === "job" ? (
                      <div
                        key={item.job.id}
                        className="relative grid items-start gap-3"
                        style={{ gridTemplateColumns: "34px 1fr" }}
                      >
                        <span
                          className="font-semibold tabular-nums text-right"
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            paddingTop: "14px",
                          }}
                        >
                          {formatHora(item.job.hora)}
                        </span>
                        <span
                          className="absolute rounded-full"
                          style={{
                            // Centralizado na linha vertical (left: 40px, o
                            // meio dos 12px de gap entre a coluna de hora e o
                            // card — gap-3), nunca em cima da própria coluna
                            // de hora (0–34px): sobrepor o texto era um bug
                            // real, achado na validação visual desta ticket
                            // (o "0" de "14h00" ficava escondido atrás do
                            // ponto).
                            left: "35px",
                            top: "16px",
                            width: "10px",
                            height: "10px",
                            background: "var(--accent)",
                            boxShadow: "0 0 8px rgb(var(--accent-rgb) / 0.5)",
                          }}
                        />
                        <GlassCard
                          radius="md"
                          className="p-3.5"
                          style={SOLID_SURFACE_STYLE}
                        >
                          <JobCard job={item.job} onClick={setDetailJob} />
                        </GlassCard>
                      </div>
                    ) : (
                      // Nota neutra, sem caixa/borda tracejada (que sugeriria
                      // um slot reservável) — só uma linha de texto discreta
                      // no fluxo: separação puramente visual, sem nenhuma
                      // alegação sobre o espaço entre os dois atendimentos.
                      <div
                        key={`next-note-${i}`}
                        className="flex items-center gap-2"
                        style={{
                          paddingLeft: "46px",
                          color: "var(--text-muted)",
                        }}
                      >
                        <Clock3 size={12} className="shrink-0" />
                        <span style={{ fontSize: "11px" }}>
                          Próximo atendimento às {item.nextLabel}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Total do dia — soma real dos atendimentos visíveis
                (respeita o filtro ativo, mesmo dado que a timeline acima
                mostra; nunca um valor de "previsão" separado que
                incluiria atendimentos escondidos pelo filtro). Rótulo
                muda conforme o dia selecionado seja hoje ou não —
                "previsto hoje" só faz sentido pra hoje. */}
            {!initialLoading && selectedDayJobs.length > 0 && (
              <div
                className="flex items-center justify-between mt-5 pt-4"
                style={{ borderTop: "1px solid var(--border-color)" }}
              >
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {isViewingToday ? "Total de hoje" : "Total do dia"}
                </span>
                <strong
                  className="font-bold tabular-nums"
                  style={{ fontSize: "20px", color: "var(--accent)" }}
                >
                  {formatBRL(dayTotal, 2)}
                </strong>
              </div>
            )}
          </>
        )}
      </div>

      {/* Resumo/Anotações — antes um card colapsável único no fim da
          página (T3/#30); agora dois botões que abrem sheets, como
          /dev-preview/ios (.profileActions). Decisão de #30 marcada
          superseded pelo usuário (issue #122, Notes 2026-09-22).
          "Resumo" só aparece se existir algum atendimento em toda a
          história (mesmo gate que o card colapsável antigo já tinha,
          preservado); "Anotações" sempre aparece (nunca teve esse gate). */}
      <div
        className="grid gap-2 mt-5"
        style={{
          gridTemplateColumns:
            !initialLoading && jobs.length > 0 ? "1fr 1fr" : "1fr",
        }}
      >
        {!initialLoading && jobs.length > 0 && (
          <button
            onClick={() => setResumoOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl font-bold"
            style={{
              minHeight: "44px",
              fontSize: "13px",
              color: "var(--text)",
              ...SOLID_SURFACE_STYLE,
            }}
          >
            <BarChart3 size={16} style={{ color: "var(--text-muted)" }} />
            Resumo
          </button>
        )}
        <button
          onClick={() => setAnotacoesOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl font-bold"
          style={{
            minHeight: "44px",
            fontSize: "13px",
            color: "var(--text)",
            ...SOLID_SURFACE_STYLE,
          }}
        >
          <MessageSquareText size={16} style={{ color: "var(--text-muted)" }} />
          Anotações
        </button>
      </div>

      <JobDetailSheet
        job={detailJob}
        onClose={() => setDetailJob(null)}
        onEdit={(job) => {
          setDetailJob(null);
          onEditJob(job);
        }}
      />

      <AgendaResumoSheet
        open={resumoOpen}
        onClose={() => setResumoOpen(false)}
        chartType={chartType}
        period={period}
        onPeriodChange={setPeriod}
        periodData={periodData}
        donutSegments={donutSegments}
        totalJobs={jobs.length}
      />

      <BottomSheet
        open={anotacoesOpen}
        onClose={() => setAnotacoesOpen(false)}
        title="Anotações"
      >
        <NotasSection userId={userId} />
      </BottomSheet>
    </div>
  );
}
