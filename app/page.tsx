"use client";

import { useState, useEffect, useMemo, type ReactNode, type CSSProperties } from "react";
import {
  Home,
  Calendar,
  Clock,
  Wallet,
  Target,
  Settings,
  Bell,
  Trash2,
  Plus,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Lock,
  Sun,
  Moon,
  Eye,
  Check,
  CalendarClock,
  Pin,
  Delete,
  Cpu,
  Cloud,
  User,
  ShieldCheck,
  Database,
  RefreshCw,
  KeyRound,
  Palette,
} from "lucide-react";

/* ----------------------------- Tipos ----------------------------- */
interface Note {
  id: number;
  text: string;
  createdAt: number;
  categoria: NoteCat;
  fixado: boolean;
}
interface Appointment {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}
interface Account {
  id: number;
  name: string;
  value: number;
}
interface Debt {
  id: number;
  name: string;
  value: number;
  dueDate: string; // YYYY-MM-DD
}
interface Goal {
  id: number;
  title: string;
  deadline: string; // YYYY-MM-DD
  concluida: boolean;
}
interface HomeBlocks {
  notifications: boolean;
  appointments: boolean;
  debts: boolean;
  goals: boolean;
}
type TabId = "home" | "agenda" | "appointments" | "finance" | "goals" | "settings";
type ApptFilter = "all" | "today" | "upcoming";
type NoteCat = "ideia" | "projeto" | "lembrete";
type AppBg = "black" | "graphite" | "space";
type AppAccent = "violet" | "emerald" | "cyan" | "red";

/* --------------------------- Constantes --------------------------- */
const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "appointments", label: "Compromissos", icon: Clock },
  { id: "finance", label: "Finanças", icon: Wallet },
  { id: "goals", label: "Metas", icon: Target },
  { id: "settings", label: "Ajustes", icon: Settings },
];

const STORAGE_KEY = "brainos_v1";

const BOOT_LINES = [
  "INITIALIZING CORTEX.OS v1.0.0...",
  "LOADING USER DATABASE... DONE",
  "MOUNTING LOCAL STORAGE... DONE",
  "SECURING PROTOCOLS...",
  "CALIBRATING NEURAL CORE... DONE",
  "ALL SYSTEMS NOMINAL",
];

const NOTE_CATS: {
  id: NoteCat;
  label: string;
  emoji: string;
  tag: string; // tag na listagem
  sel: string; // pílula selecionada no formulário
}[] = [
  { id: "ideia", label: "Ideia", emoji: "💡", tag: "bg-[var(--accent-soft)] text-[var(--accent)]", sel: "bg-[var(--accent)] text-white" },
  { id: "projeto", label: "Projeto", emoji: "🚀", tag: "bg-emerald-500/15 text-emerald-400", sel: "bg-emerald-600 text-white" },
  { id: "lembrete", label: "Lembrete", emoji: "📌", tag: "bg-amber-500/15 text-amber-400", sel: "bg-amber-500 text-white" },
];
const catOf = (id: NoteCat) => NOTE_CATS.find((c) => c.id === id) ?? NOTE_CATS[0];

const defaultHomeBlocks: HomeBlocks = {
  notifications: true,
  appointments: true,
  debts: true,
  goals: true,
};

/* ============================================================
 * Camada de persistência do Cortex — Supabase
 * ------------------------------------------------------------
 * Usa o cliente @supabase/supabase-js (anon key pública).
 * Variáveis de ambiente no arquivo .env.local do Next.js:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
 *
 * Tabela esperada no Supabase (SQL em /docs/supabase-setup.sql):
 *   CREATE TABLE cortex_state (
 *     id        TEXT PRIMARY KEY,
 *     payload   JSONB NOT NULL,
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 * ============================================================ */

interface CortexState {
  theme: "dark" | "light";
  appTheme: { bg: AppBg; accent: AppAccent };
  pin: string;
  isPasswordEnabled: boolean;
  isAiEnabled: boolean;
  cloudSyncEnabled: boolean;
  homeBlocks: HomeBlocks;
  notes: Note[];
  appointments: Appointment[];
  accounts: Account[];
  debts: Debt[];
  goals: Goal[];
}

/* ------- Opções do personalizador de visual ------- */
const BG_OPTIONS: {
  id: AppBg;
  label: string;
  app: string;
  card: string;
  nav: string;
  input: string;
  chip: string;
  divide: string;
  swatch: string;
}[] = [
  { id: "black", label: "Preto Puro", app: "bg-black", card: "bg-zinc-900/80 border border-zinc-800/80", nav: "bg-zinc-900/90 border-zinc-800", input: "bg-zinc-800/60 border border-zinc-700 text-zinc-100 placeholder-zinc-500", chip: "bg-zinc-800/70", divide: "divide-zinc-800/80", swatch: "bg-black" },
  { id: "graphite", label: "Grafite Profundo", app: "bg-zinc-950", card: "bg-zinc-900/80 border border-zinc-800/80", nav: "bg-zinc-900/90 border-zinc-800", input: "bg-zinc-800/60 border border-zinc-700 text-zinc-100 placeholder-zinc-500", chip: "bg-zinc-800/70", divide: "divide-zinc-800/80", swatch: "bg-zinc-950" },
  { id: "space", label: "Azul Escuro Espacial", app: "bg-slate-950", card: "bg-slate-900/80 border border-slate-800/80", nav: "bg-slate-900/90 border-slate-800", input: "bg-slate-800/60 border border-slate-700 text-zinc-100 placeholder-zinc-500", chip: "bg-slate-800/70", divide: "divide-slate-800/80", swatch: "bg-slate-950" },
];

const ACCENT_OPTIONS: { id: AppAccent; label: string; hex: string }[] = [
  { id: "violet", label: "Roxo Moderno", hex: "#8B5CF6" },
  { id: "emerald", label: "Verde Menta", hex: "#10B981" },
  { id: "cyan", label: "Azul Ciano", hex: "#06B6D4" },
  { id: "red", label: "Vermelho Pastel", hex: "#F87171" },
];

/* -------- Cliente Supabase (lazy-initialized) -------- */
// Usamos createClient lazily para não quebrar o build se as env vars
// ainda não estiverem configuradas.
type SupabaseLike = {
  from: (table: string) => {
    upsert: (row: object) => Promise<{ error: { message: string } | null }>;
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: { payload: Partial<CortexState> } | null; error: { message: string } | null }>;
      };
    };
  };
};

let _supabase: SupabaseLike | null = null;

function getSupabase(): SupabaseLike | null {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // env vars não configuradas → modo offline
  // Importação síncrona via window para funcionar com o bundle do Next.js.
  // O pacote @supabase/supabase-js já estará no bundle após o npm install.
  if (typeof window === "undefined") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (window as any).__supabaseClient;
    if (mod) { _supabase = mod; return _supabase; }
  } catch { /* segue */ }
  return null; // inicialização adiada para initSupabase() abaixo
}

// Chame esta função uma vez no topo do componente, após os imports do bundle.
// O Next.js garante que o módulo estará disponível client-side.
async function initSupabase(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || _supabase) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    _supabase = createClient(url, key) as unknown as SupabaseLike;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__supabaseClient = _supabase;
  } catch {
    /* pacote não instalado → modo offline */
  }
}

/* -------- Funções de nuvem -------- */
async function cloudUpsert(id: string, payload: CortexState): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("cortex_state").upsert({ id, payload });
  if (error) console.warn("[Cortex] sync error:", error.message);
}

async function cloudFetch(id: string): Promise<Partial<CortexState> | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("cortex_state")
    .select("payload")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data.payload;
}

/* -------- API pública usada pelo componente -------- */
// Grava o estado: sempre persiste local e, se sync ligada, envia à nuvem.
async function persistState(state: CortexState): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* armazenamento cheio/indisponível */
  }
  if (state.cloudSyncEnabled) {
    await cloudUpsert(STORAGE_KEY, state);
  }
}

// Carrega: tenta nuvem primeiro, cai para cache local como fallback.
async function loadState(): Promise<Partial<CortexState> | null> {
  try {
    const remote = await cloudFetch(STORAGE_KEY);
    if (remote) {
      // Atualiza o cache local com o dado da nuvem
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      return remote;
    }
  } catch {
    /* falha de rede → segue para o cache local */
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<CortexState>) : null;
  } catch {
    return null;
  }
}


/* ----------------------------- Helpers ----------------------------- */
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysUntil = (dateStr: string) => {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - startOfToday().getTime()) / 86400000);
};

const apptDate = (a: Appointment) =>
  new Date(`${a.date}T${a.time || "00:00"}:00`);

const within24h = (a: Appointment) => {
  if (!a.date) return false;
  const diff = apptDate(a).getTime() - Date.now();
  return diff >= -60 * 60 * 1000 && diff <= 24 * 60 * 60 * 1000;
};

const fmtDateTime = (a: Appointment) => {
  const d = apptDate(a);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDate = (dateStr: string) => {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

/* =============================================================== */
export default function Page() {
  const [loaded, setLoaded] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [bootFade, setBootFade] = useState(false);
  const [bootLines, setBootLines] = useState(0);
  const [tab, setTab] = useState<TabId>("home");
  const [apptFilter, setApptFilter] = useState<ApptFilter>("all");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [appTheme, setAppTheme] = useState<{ bg: AppBg; accent: AppAccent }>({
    bg: "graphite",
    accent: "violet",
  });
  const [homeBlocks, setHomeBlocks] = useState<HomeBlocks>(defaultHomeBlocks);

  // Segurança (PIN) e visibilidade da IA
  const [pin, setPin] = useState("");
  const [isPasswordEnabled, setIsPasswordEnabled] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [, setNowTick] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [tempPin, setTempPin] = useState("");
  const [lockError, setLockError] = useState(false);
  // Fluxo do painel de segurança em Ajustes
  const [securityMode, setSecurityMode] = useState<
    "idle" | "enable" | "disable" | "changeVerify" | "changeNew"
  >("idle");
  const [pinDraft, setPinDraft] = useState("");
  const [pinError, setPinError] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  /* ----------------------- Boot screen (J.A.R.V.I.S.) ----------------------- */
  useEffect(() => {
    const lineTimers = BOOT_LINES.map((_, i) =>
      setTimeout(() => setBootLines((n) => Math.max(n, i + 1)), 250 + i * 430)
    );
    const fade = setTimeout(() => setBootFade(true), 2500); // inicia fade-out
    const done = setTimeout(() => setIsBooting(false), 3000); // desmonta após 500ms
    return () => {
      lineTimers.forEach(clearTimeout);
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);

  /* ------------------------ Carregar dados ------------------------ */
  useEffect(() => {
    let active = true;
    (async () => {
      await initSupabase(); // inicializa o cliente Supabase antes de carregar
      try {
        const d = await loadState();
        if (active && d) {
          setTheme(d.theme ?? "dark");
          if (d.appTheme) setAppTheme(d.appTheme);
          const savedPin = d.pin ?? "";
          const legacy = d as Partial<CortexState> & { passwordOn?: boolean };
          const enabled =
            (legacy.isPasswordEnabled ?? legacy.passwordOn ?? false) && savedPin.length === 4;
          setPin(savedPin);
          setIsPasswordEnabled(enabled);
          setIsAiEnabled(d.isAiEnabled ?? true);
          setCloudSyncEnabled(d.cloudSyncEnabled ?? true);
          setIsLocked(enabled); // inicia bloqueado se houver PIN ativo
          setHomeBlocks({ ...defaultHomeBlocks, ...(d.homeBlocks ?? {}) });
          setNotes(
            (d.notes ?? []).map((n: Note) => ({
              ...n,
              categoria: n.categoria ?? "ideia",
              fixado: n.fixado ?? false,
            }))
          );
          setAppointments(d.appointments ?? []);
          setAccounts(d.accounts ?? []);
          setDebts(d.debts ?? []);
          setGoals(
            (d.goals ?? []).map((g: Goal) => ({ ...g, concluida: g.concluida ?? false }))
          );
        }
      } catch {
        /* ignora estado corrompido */
      }
      if (active) setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ------------------------- Salvar dados ------------------------- */
  useEffect(() => {
    if (!loaded) return;
    const state: CortexState = {
      theme,
      appTheme,
      pin,
      isPasswordEnabled,
      isAiEnabled,
      cloudSyncEnabled,
      homeBlocks,
      notes,
      appointments,
      accounts,
      debts,
      goals,
    };
    persistState(state)
      .then(() => setLastSync(Date.now()))
      .catch(() => {});
  }, [loaded, theme, appTheme, pin, isPasswordEnabled, isAiEnabled, cloudSyncEnabled, homeBlocks, notes, appointments, accounts, debts, goals]);

  // Atualiza os rótulos de "último backup" a cada 30s.
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  /* ------------------------- Derivados ------------------------- */
  const totalAccounts = useMemo(
    () => accounts.reduce((s, a) => s + a.value, 0),
    [accounts]
  );
  const totalDebts = useMemo(
    () => debts.reduce((s, d) => s + d.value, 0),
    [debts]
  );
  const realBalance = totalAccounts - totalDebts;
  const totalFin = totalAccounts + totalDebts;
  const accPct = totalFin > 0 ? (totalAccounts / totalFin) * 100 : 50;
  const debtPct = totalFin > 0 ? (totalDebts / totalFin) * 100 : 50;

  const upcoming = useMemo(
    () =>
      [...appointments]
        .filter((a) => a.date)
        .sort((a, b) => apptDate(a).getTime() - apptDate(b).getTime())
        .filter(within24h),
    [appointments]
  );

  const criticalDebts = useMemo(
    () => debts.filter((d) => d.dueDate && daysUntil(d.dueDate) <= 0),
    [debts]
  );

  const sortedGoals = useMemo(
    () =>
      [...goals].sort(
        (a, b) => daysUntil(a.deadline) - daysUntil(b.deadline)
      ),
    [goals]
  );

  const pendingCount = upcoming.length + criticalDebts.length;

  /* --------------------------- Tema --------------------------- */
  const isDark = theme === "dark";
  const bgOpt = BG_OPTIONS.find((o) => o.id === appTheme.bg) ?? BG_OPTIONS[1];
  const accentHex =
    (ACCENT_OPTIONS.find((o) => o.id === appTheme.accent) ?? ACCENT_OPTIONS[0]).hex;
  const accentVars = {
    "--accent": accentHex,
    "--accent-soft": accentHex + "26",
    "--accent-line": accentHex + "55",
    "--accent-glow": accentHex + "80",
  } as CSSProperties;
  const t = {
    app: isDark ? `${bgOpt.app} text-zinc-100` : "bg-zinc-100 text-zinc-900",
    card: isDark ? bgOpt.card : "bg-white border border-zinc-200",
    sub: isDark ? "text-zinc-400" : "text-zinc-500",
    faint: isDark ? "text-zinc-500" : "text-zinc-400",
    input: isDark
      ? bgOpt.input
      : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400",
    nav: isDark ? bgOpt.nav : "bg-white/90 border-zinc-200",
    chip: isDark ? bgOpt.chip : "bg-zinc-100",
    accent: "text-[var(--accent)]",
    divide: isDark ? bgOpt.divide : "divide-zinc-200",
  };

  /* ----------------------- Form (estados) ----------------------- */
  const [noteText, setNoteText] = useState("");
  const [noteCat, setNoteCat] = useState<NoteCat>("ideia");
  const [aTitle, setATitle] = useState("");
  const [aDate, setADate] = useState("");
  const [aTime, setATime] = useState("");
  const [accName, setAccName] = useState("");
  const [accValue, setAccValue] = useState("");
  const [dName, setDName] = useState("");
  const [dValue, setDValue] = useState("");
  const [dDate, setDDate] = useState("");
  const [gTitle, setGTitle] = useState("");
  const [gDeadline, setGDeadline] = useState("");

  /* --------------------------- Ações --------------------------- */
  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes((p) => [
      {
        id: Date.now(),
        text: noteText.trim(),
        createdAt: Date.now(),
        categoria: noteCat,
        fixado: false,
      },
      ...p,
    ]);
    setNoteText("");
  };

  const togglePin = (id: number) =>
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, fixado: !n.fixado } : n)));

  const addAppt = () => {
    if (!aTitle.trim() || !aDate) return;
    setAppointments((p) => [
      { id: Date.now(), title: aTitle.trim(), date: aDate, time: aTime || "00:00" },
      ...p,
    ]);
    setATitle("");
    setADate("");
    setATime("");
  };

  const addAccount = () => {
    const v = parseFloat(accValue.replace(",", "."));
    if (!accName.trim() || isNaN(v)) return;
    setAccounts((p) => [...p, { id: Date.now(), name: accName.trim(), value: v }]);
    setAccName("");
    setAccValue("");
  };

  const addDebt = () => {
    const v = parseFloat(dValue.replace(",", "."));
    if (!dName.trim() || isNaN(v)) return;
    setDebts((p) => [
      ...p,
      { id: Date.now(), name: dName.trim(), value: v, dueDate: dDate },
    ]);
    setDName("");
    setDValue("");
    setDDate("");
  };

  const addGoal = () => {
    if (!gTitle.trim()) return;
    setGoals((p) => [
      ...p,
      { id: Date.now(), title: gTitle.trim(), deadline: gDeadline, concluida: false },
    ]);
    setGTitle("");
    setGDeadline("");
  };

  const toggleGoal = (id: number) =>
    setGoals((p) =>
      p.map((g) => (g.id === id ? { ...g, concluida: !g.concluida } : g))
    );

  /* ----------------------- Sub-componentes ----------------------- */
  const Title = ({ children }: { children: ReactNode }) => (
    <h1 className="text-3xl font-bold tracking-tight mb-5">{children}</h1>
  );

  const inputBase =
    "w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-[var(--accent-line)] " +
    t.input;

  const primaryBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition active:scale-95 hover:opacity-90";

  const DeleteBtn = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      aria-label="Excluir"
      className="shrink-0 rounded-lg p-2 text-zinc-500 transition active:scale-90 hover:bg-red-500/10 hover:text-red-400"
    >
      <Trash2 size={18} />
    </button>
  );

  /* --------------------- PIN: lógica e UI --------------------- */
  const flashClear = (
    setErr: (v: boolean) => void,
    clear: () => void
  ) => {
    setErr(true);
    setTimeout(() => {
      setErr(false);
      clear();
    }, 600);
  };

  // Tela de bloqueio
  const pressLockDigit = (dgt: string) => {
    if (tempPin.length >= 4) return;
    const next = tempPin + dgt;
    setTempPin(next);
    if (next.length === 4) {
      if (next === pin) {
        setTimeout(() => {
          setIsLocked(false);
          setTempPin("");
        }, 160);
      } else {
        flashClear(setLockError, () => setTempPin(""));
      }
    }
  };

  // Painel de segurança em Ajustes
  const completeDraft = (next: string) => {
    if (securityMode === "enable") {
      setPin(next);
      setIsPasswordEnabled(true);
      setSecurityMode("idle");
      setPinDraft("");
    } else if (securityMode === "disable") {
      if (next === pin) {
        setIsPasswordEnabled(false);
        setPin("");
        setIsLocked(false);
        setSecurityMode("idle");
        setPinDraft("");
      } else flashClear(setPinError, () => setPinDraft(""));
    } else if (securityMode === "changeVerify") {
      if (next === pin) {
        setSecurityMode("changeNew");
        setPinDraft("");
      } else flashClear(setPinError, () => setPinDraft(""));
    } else if (securityMode === "changeNew") {
      setPin(next);
      setSecurityMode("idle");
      setPinDraft("");
    }
  };

  const pressDraftDigit = (dgt: string) => {
    if (pinDraft.length >= 4) return;
    const next = pinDraft + dgt;
    setPinDraft(next);
    if (next.length === 4) setTimeout(() => completeDraft(next), 130);
  };

  const togglePassword = () => {
    setPinError(false);
    setPinDraft("");
    setSecurityMode(isPasswordEnabled ? "disable" : "enable");
  };

  const closeSecurityPanel = () => {
    setSecurityMode("idle");
    setPinDraft("");
    setPinError(false);
  };

  // Bolinhas do PIN (4 dígitos)
  const pinDots = (count: number, error: boolean, dark: boolean) => (
    <div className="flex gap-4">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full border transition-all duration-200 ${
            error
              ? "border-red-500"
              : i < count
              ? "border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_8px_2px_var(--accent-glow)]"
              : dark
              ? "border-zinc-700"
              : "border-zinc-300"
          }`}
        />
      ))}
    </div>
  );

  // Teclado numérico 3x4
  const pinKeypad = (
    onPress: (d: string) => void,
    onDelete: () => void,
    dark: boolean,
    size: "lg" | "md" = "lg"
  ) => {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
    const dim = size === "lg" ? "h-16 w-16 text-2xl" : "h-14 w-14 text-xl";
    const keyCls = dark
      ? "border border-zinc-800/60 text-zinc-100 active:bg-zinc-800/40"
      : "border border-zinc-300 text-zinc-900 active:bg-zinc-200";
    return (
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k, i) =>
          k === "" ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (k === "del" ? onDelete() : onPress(k))}
              aria-label={k === "del" ? "Apagar" : k}
              className={`flex items-center justify-center rounded-full font-light transition-all duration-150 active:scale-95 ${dim} ${keyCls}`}
            >
              {k === "del" ? <Delete size={22} strokeWidth={1.5} /> : k}
            </button>
          )
        )}
      </div>
    );
  };

  // Overlay de bloqueio
  // Boot / Splash screen estilo J.A.R.V.I.S.
  const bootScreen = () => (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black px-8 transition-opacity duration-500 ${
        bootFade ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <style>{`
        @keyframes bootBar { from { width: 0% } to { width: 100% } }
        .boot-bar { animation: bootBar 2.5s linear forwards; }
        @keyframes briFade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        .bri-fade { animation: briFade .25s ease both; }
      `}</style>

      <h1 className="animate-pulse text-5xl font-bold tracking-tight text-purple-500 drop-shadow-[0_0_25px_rgba(168,85,247,0.45)]">
        Cortex
      </h1>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-purple-300/40">
        Intelligence System
      </p>

      {/* Barra de progresso ultrafina com brilho neon */}
      <div className="mt-8 h-[2px] w-56 rounded-full bg-zinc-800/60">
        <div className="boot-bar h-full rounded-full bg-purple-500 shadow-[0_0_10px_1px_rgba(168,85,247,0.85)]" />
      </div>

      {/* Log de inicialização (terminal Tony Stark) */}
      <div className="absolute bottom-6 left-6 space-y-1.5 font-mono text-[11px] tracking-wide text-zinc-500">
        {BOOT_LINES.slice(0, bootLines).map((line, i) => (
          <p key={i} className="bri-fade">
            <span className="text-purple-500/70">{">"}</span> {line}
          </p>
        ))}
      </div>
    </div>
  );

  const lockScreen = () => (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 px-8 text-zinc-100">
      <div className="mb-6 rounded-2xl bg-zinc-900 p-4">
        <Lock className="text-[var(--accent)]" size={26} />
      </div>
      <p className="mb-8 text-sm text-zinc-400">Digite seu PIN para acessar o Cortex</p>
      <div className={`mb-12 ${lockError ? "animate-pulse" : ""}`}>
        {pinDots(tempPin.length, lockError, true)}
      </div>
      {pinKeypad(pressLockDigit, () => setTempPin((p) => p.slice(0, -1)), true, "lg")}
    </div>
  );

  /* --------------------------- Telas --------------------------- */
  const renderHome = () => {
    const allHidden =
      !homeBlocks.notifications &&
      !homeBlocks.appointments &&
      !homeBlocks.debts &&
      !homeBlocks.goals;

    // Saudação inteligente (prioridade: finanças > compromissos > estável)
    const greeting =
      realBalance < 0
        ? "Protocolo Financeiro Ativo: o orçamento está comprometido. Recomendo conter despesas imediatas."
        : upcoming.length > 0
        ? "Sistemas atualizados. Você possui compromissos importantes nas próximas horas. Cronograma pronto abaixo."
        : "Todos os sistemas operando com estabilidade. Excelente dia para focar nas suas metas.";

    // Insights preditivos — varrem os estados do app em tempo real
    const insights: { text: string; tone: "violet" | "red" | "muted" }[] = [];

    const focusGoal = sortedGoals.find((g) => !g.concluida && g.deadline);
    if (focusGoal) {
      const dd = daysUntil(focusGoal.deadline);
      const ritmo = dd <= 0 ? "Crítico" : dd <= 3 ? "Alto" : dd <= 7 ? "Médio" : "Estável";
      const quando =
        dd < 0 ? "prazo vencido" : dd === 0 ? "vence hoje" : dd === 1 ? "vence amanhã" : `faltam ${dd} dias`;
      insights.push({
        text: `Foco Sugerido: a meta "${focusGoal.title}" está próxima do prazo final (${quando}). Ritmo de execução: ${ritmo}.`,
        tone: "violet",
      });
    }

    debts
      .filter((d) => d.dueDate && daysUntil(d.dueDate) === 0)
      .forEach((d) =>
        insights.push({
          text: `Alerta Crítico: a dívida "${d.name}" (${brl(d.value)}) vence hoje. Liquidação recomendada.`,
          tone: "red",
        })
      );

    if (realBalance < 0)
      insights.push({
        text: `Diagnóstico: saldo real em ${brl(realBalance)}. Conter despesas até estabilizar o fluxo.`,
        tone: "red",
      });

    if (insights.length === 0)
      insights.push({
        text: "Nenhum padrão crítico detectado. Sistemas livres para foco em novos objetivos.",
        tone: "muted",
      });

    const insightColor = (tone: "violet" | "red" | "muted") =>
      tone === "red" ? "text-red-400" : tone === "violet" ? t.accent : t.faint;

    return (
      <div>
        <p className={`text-sm font-medium ${t.accent}`}>Cortex</p>
        <Title>Início</Title>

        {/* Assistente Cortex — central de inteligência */}
        {isAiEnabled && (
          <div
            className={`mb-4 overflow-hidden rounded-3xl border p-5 transition-all duration-300 ${
              isDark
                ? "border-[var(--accent-line)] bg-gradient-to-br from-[var(--accent-soft)] to-zinc-900/80"
                : "border-[var(--accent-line)] bg-gradient-to-br from-[var(--accent-soft)] to-white"
            }`}
          >
          <p className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] ${t.accent}`}>
            Assistente Cortex
          </p>

          <div className="flex items-center gap-4">
            {/* Núcleo (core orb) pulsante */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-soft)]" />
              <span className="absolute inline-flex h-8 w-8 rounded-full bg-[var(--accent-soft)]" />
              <span className="relative inline-flex h-5 w-5 animate-pulse rounded-full bg-[var(--accent)] shadow-lg shadow-[0_0_18px_var(--accent-glow)]" />
            </div>
            <p
              key={greeting}
              className={`bri-fade flex-1 text-sm leading-relaxed ${
                isDark ? "text-zinc-100" : "text-zinc-800"
              }`}
            >
              {greeting}
            </p>
          </div>

          {/* Insights preditivos */}
          <div
            className={`mt-4 rounded-2xl border p-4 font-mono transition-all duration-300 ${
              isDark ? "border-[var(--accent-line)] bg-black/30" : "border-[var(--accent-line)] bg-[var(--accent-soft)]"
            }`}
          >
            <p className={`mb-2 text-[10px] tracking-wider ${t.accent} opacity-80`}>
              [ IA INTERFACE: INSIGHTS PREDITIVOS ]
            </p>
            <div className="space-y-1.5">
              {insights.map((ins, idx) => (
                <p
                  key={idx}
                  className={`text-[11px] leading-relaxed ${insightColor(ins.tone)}`}
                >
                  <span className="opacity-60">{"›"}</span> {ins.text}
                </p>
              ))}
            </div>
          </div>
          </div>
        )}

        {homeBlocks.notifications && (
          <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
            <div className="flex items-center gap-3">
              <div className="relative rounded-2xl bg-[var(--accent-soft)] p-3">
                <Bell className="text-[var(--accent)]" size={22} />
                {pendingCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold">Notificações ativas</p>
                <p className={`text-sm ${t.sub}`}>
                  {pendingCount === 0
                    ? "Tudo em dia, sem pendências"
                    : `${pendingCount} ${pendingCount === 1 ? "pendência" : "pendências"} precisando de atenção`}
                </p>
              </div>
            </div>
          </div>
        )}

        {homeBlocks.debts && criticalDebts.length > 0 && (
          <div className="mb-4 rounded-3xl border border-red-500/20 bg-red-950/40 p-5">
            <div className="mb-3 flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} />
              <p className="font-semibold">Dívidas críticas</p>
            </div>
            <div className="space-y-2">
              {criticalDebts.map((d) => (
                <div key={d.id} className="flex items-center justify-between">
                  <span className="text-sm text-red-200">{d.name}</span>
                  <span className="text-sm font-semibold text-red-300">
                    {brl(d.value)}
                    <span className="ml-2 text-xs text-red-400/80">
                      {daysUntil(d.dueDate) === 0 ? "vence hoje" : "vencida"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {homeBlocks.appointments && (
          <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="text-[var(--accent)]" size={18} />
              <p className="font-semibold">Próximas 24 horas</p>
            </div>
            {upcoming.length === 0 ? (
              <p className={`text-sm ${t.sub}`}>Nenhum compromisso por perto.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((a) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className={`text-xs ${t.sub}`}>{fmtDateTime(a)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {homeBlocks.goals && (
          <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
            <div className="mb-3 flex items-center gap-2">
              <Target className="text-[var(--accent)]" size={18} />
              <p className="font-semibold">Metas no prazo</p>
            </div>
            {sortedGoals.length === 0 ? (
              <p className={`text-sm ${t.sub}`}>Defina sua primeira meta na aba Metas.</p>
            ) : (
              <div className="space-y-3">
                {sortedGoals.slice(0, 3).map((g) => {
                  const d = daysUntil(g.deadline);
                  return (
                    <div key={g.id} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{g.title}</span>
                      <span className={`text-xs ${t.sub}`}>
                        {!g.deadline
                          ? "sem prazo"
                          : d < 0
                          ? "atrasada"
                          : d === 0
                          ? "hoje"
                          : `em ${d} ${d === 1 ? "dia" : "dias"}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {allHidden && (
          <div className={`rounded-3xl p-8 text-center ${t.card}`}>
            <Eye className={`mx-auto mb-2 ${t.faint}`} size={26} />
            <p className={`text-sm ${t.sub}`}>
              Todos os blocos estão ocultos. Reative-os em Ajustes › Editar Início.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderAgenda = () => {
    const pinned = notes.filter((n) => n.fixado);
    const others = notes.filter((n) => !n.fixado);

    const noteCard = (n: Note) => {
      const c = catOf(n.categoria);
      return (
        <div
          key={n.id}
          className={`rounded-2xl p-4 transition-all duration-200 ${
            n.fixado ? "border border-[var(--accent-line)] bg-[var(--accent-soft)]" : t.card
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.tag}`}
            >
              {c.emoji} {c.label}
            </span>
            <div className="flex items-center">
              <button
                onClick={() => togglePin(n.id)}
                aria-label={n.fixado ? "Desafixar" : "Fixar"}
                className={`rounded-lg p-2 transition-all duration-200 active:scale-90 ${
                  n.fixado ? "text-[var(--accent)]" : `${t.faint} hover:text-[var(--accent)]`
                }`}
              >
                <Pin size={16} className={n.fixado ? "fill-current" : ""} />
              </button>
              <DeleteBtn onClick={() => setNotes((p) => p.filter((x) => x.id !== n.id))} />
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.text}</p>
          <p className={`mt-2 text-xs ${t.faint}`}>
            {new Date(n.createdAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      );
    };

    const sectionLabel = (text: string) => (
      <p className={`mb-2 px-1 text-xs font-semibold uppercase tracking-wide ${t.faint}`}>
        {text}
      </p>
    );

    return (
      <div>
        <Title>Agenda</Title>
        <div className={`mb-5 rounded-3xl p-5 ${t.card}`}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Escreva uma ideia, projeto ou lembrete..."
            rows={4}
            className={`${inputBase} resize-none`}
          />

          {/* Seleção de categoria (badges) */}
          <div className="mt-3 flex gap-2">
            {NOTE_CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setNoteCat(c.id)}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition-all duration-200 active:scale-95 ${
                  noteCat === c.id ? c.sel : `${t.chip} ${t.sub}`
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <button onClick={addNote} className={`${primaryBtn} mt-3 w-full`}>
            <Plus size={18} /> Salvar anotação
          </button>
        </div>

        {notes.length === 0 ? (
          <p className={`px-1 text-sm ${t.sub}`}>Nenhuma anotação ainda.</p>
        ) : (
          <div className="space-y-5">
            {pinned.length > 0 && (
              <div>
                {sectionLabel("📌 Fixados")}
                <div className="space-y-3">{pinned.map(noteCard)}</div>
              </div>
            )}
            {others.length > 0 && (
              <div>
                {pinned.length > 0 && sectionLabel("Todas")}
                <div className="space-y-3">{others.map(noteCard)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAppointments = () => {
    const now = Date.now();
    const isPast = (a: Appointment) => apptDate(a).getTime() < now;

    // Ordena: próximos primeiro (mais perto no topo), passados descem ao fim.
    const sorted = [...appointments].sort((a, b) => {
      const ta = apptDate(a).getTime();
      const tb = apptDate(b).getTime();
      const pa = ta < now ? 1 : 0;
      const pb = tb < now ? 1 : 0;
      if (pa !== pb) return pa - pb; // futuros antes de passados
      if (pa === 1) return tb - ta; // ambos passados: mais recente primeiro
      return ta - tb; // ambos futuros: mais próximo primeiro
    });

    const filtered = sorted.filter((a) => {
      if (apptFilter === "today") return daysUntil(a.date) === 0;
      if (apptFilter === "upcoming") return !isPast(a);
      return true;
    });

    const timeTag = (a: Appointment) => {
      const dd = daysUntil(a.date);
      const neutral = isDark
        ? "bg-zinc-700/50 text-zinc-300"
        : "bg-zinc-200 text-zinc-600";
      if (isPast(a))
        return {
          label: "PASSADO",
          cls: isDark ? "bg-zinc-700/40 text-zinc-500" : "bg-zinc-200 text-zinc-400",
        };
      if (dd === 0) return { label: "HOJE", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" };
      if (dd === 1) return { label: "AMANHÃ", cls: neutral };
      return { label: `EM ${dd} DIAS`, cls: neutral };
    };

    const filters: { id: ApptFilter; label: string }[] = [
      { id: "all", label: "Todos" },
      { id: "today", label: "Hoje" },
      { id: "upcoming", label: "Próximos" },
    ];

    const emptyMsg =
      apptFilter === "today"
        ? "Nada agendado para hoje."
        : apptFilter === "upcoming"
        ? "Nenhum compromisso futuro."
        : "Nenhum compromisso registrado.";

    return (
      <div>
        <Title>Compromissos</Title>
        <div className={`mb-5 space-y-3 rounded-3xl p-5 ${t.card}`}>
          <input
            value={aTitle}
            onChange={(e) => setATitle(e.target.value)}
            placeholder="Título do compromisso"
            className={inputBase}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={aDate}
              onChange={(e) => setADate(e.target.value)}
              className={inputBase}
            />
            <input
              type="time"
              value={aTime}
              onChange={(e) => setATime(e.target.value)}
              className={inputBase}
            />
          </div>
          <button onClick={addAppt} className={`${primaryBtn} w-full`}>
            <Plus size={18} /> Registrar compromisso
          </button>
        </div>

        {/* Segmented control (estilo iOS) */}
        <div
          className={`mb-4 flex gap-1 rounded-2xl p-1 ${
            isDark ? "bg-zinc-800/60" : "bg-zinc-200/70"
          }`}
        >
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setApptFilter(f.id)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all duration-300 active:scale-95 ${
                apptFilter === f.id
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : `${t.sub} hover:opacity-80`
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className={`px-1 text-sm ${t.sub}`}>{emptyMsg}</p>
        ) : (
          <div key={apptFilter} className="bri-fade space-y-3">
            {filtered.map((a) => {
              const past = isPast(a);
              const today = !past && daysUntil(a.date) === 0;
              const tag = timeTag(a);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-2xl p-4 transition-all duration-300 ${t.card} ${
                    past ? "opacity-50" : "opacity-100"
                  }`}
                >
                  <div
                    className={`rounded-xl p-2.5 ${
                      today ? "bg-[var(--accent-soft)] text-[var(--accent)]" : `${t.chip} ${t.sub}`
                    }`}
                  >
                    <Clock size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className={`text-xs ${t.sub}`}>{fmtDateTime(a)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${tag.cls}`}
                  >
                    {tag.label}
                  </span>
                  <DeleteBtn
                    onClick={() => setAppointments((p) => p.filter((x) => x.id !== a.id))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFinance = () => (
    <div>
      <Title>Finanças</Title>

      {/* Saldo real */}
      <div
        className={`mb-4 rounded-3xl p-6 ${
          realBalance >= 0
            ? "border border-emerald-500/20 bg-emerald-950/40"
            : "border border-red-500/20 bg-red-950/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <TrendingUp
            size={16}
            className={realBalance >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <p className={`text-sm font-medium ${realBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            Saldo real
          </p>
        </div>
        <p
          className={`mt-1 text-4xl font-bold tracking-tight ${
            realBalance >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {brl(realBalance)}
        </p>
        <p className={`mt-1 text-xs ${t.sub}`}>Contas {brl(totalAccounts)} − Dívidas {brl(totalDebts)}</p>
      </div>

      {/* Mini gráfico de proporção */}
      <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
        <p className="mb-3 text-sm font-semibold">Proporção</p>
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-zinc-700/40">
          <div
            className="h-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${accPct}%` }}
          />
          <div
            className="h-full bg-red-400 transition-all duration-500"
            style={{ width: `${debtPct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Contas {accPct.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Dívidas {debtPct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Contas bancárias */}
      <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
        <p className="mb-3 font-semibold">Contas bancárias</p>
        <div className="mb-3 grid grid-cols-5 gap-2">
          <input
            value={accName}
            onChange={(e) => setAccName(e.target.value)}
            placeholder="Banco"
            className={`${inputBase} col-span-3`}
          />
          <input
            value={accValue}
            onChange={(e) => setAccValue(e.target.value)}
            placeholder="Valor"
            inputMode="decimal"
            className={`${inputBase} col-span-2`}
          />
        </div>
        <button onClick={addAccount} className={`${primaryBtn} w-full`}>
          <Plus size={18} /> Adicionar conta
        </button>

        {accounts.length > 0 && (
          <div className={`mt-4 divide-y ${t.divide}`}>
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{a.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-400">
                    {brl(a.value)}
                  </span>
                  <DeleteBtn
                    onClick={() => setAccounts((p) => p.filter((x) => x.id !== a.id))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dívidas */}
      <div className={`rounded-3xl p-5 ${t.card}`}>
        <p className="mb-3 font-semibold">Dívidas a pagar</p>
        <div className="mb-3 space-y-2">
          <div className="grid grid-cols-5 gap-2">
            <input
              value={dName}
              onChange={(e) => setDName(e.target.value)}
              placeholder="Dívida"
              className={`${inputBase} col-span-3`}
            />
            <input
              value={dValue}
              onChange={(e) => setDValue(e.target.value)}
              placeholder="Valor"
              inputMode="decimal"
              className={`${inputBase} col-span-2`}
            />
          </div>
          <input
            type="date"
            value={dDate}
            onChange={(e) => setDDate(e.target.value)}
            className={inputBase}
          />
        </div>
        <button onClick={addDebt} className={`${primaryBtn} w-full`}>
          <Plus size={18} /> Adicionar dívida
        </button>

        {debts.length > 0 && (
          <div className={`mt-4 divide-y ${t.divide}`}>
            {debts.map((d) => {
              const du = daysUntil(d.dueDate);
              const critical = d.dueDate && du <= 0;
              return (
                <div key={d.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm">{d.name}</p>
                    {d.dueDate && (
                      <p
                        className={`text-xs ${
                          critical ? "text-red-400" : t.faint
                        }`}
                      >
                        vence {fmtDate(d.dueDate)}
                        {critical && (du === 0 ? " · hoje" : " · vencida")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-400">
                      {brl(d.value)}
                    </span>
                    <DeleteBtn
                      onClick={() => setDebts((p) => p.filter((x) => x.id !== d.id))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderGoals = () => {
    const totalGoals = goals.length;
    const doneGoals = goals.filter((g) => g.concluida).length;
    const progress = totalGoals > 0 ? Math.round((doneGoals / totalGoals) * 100) : 0;

    return (
      <div>
        <Title>Metas</Title>

        {/* Progresso (estilo Apple) */}
        <div className={`mb-5 rounded-3xl p-5 ${t.card}`}>
          <div className="flex items-end justify-between">
            <p className={`text-sm ${t.sub}`}>Sua evolução</p>
            <p className="text-2xl font-bold leading-none text-[var(--accent)]">
              {progress}%
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={`mt-2 text-xs ${t.faint}`}>
            {totalGoals === 0
              ? "0% concluído"
              : `${doneGoals} de ${totalGoals} ${
                  doneGoals === 1 ? "meta concluída" : "metas concluídas"
                }`}
          </p>
        </div>

        <div className={`mb-5 space-y-3 rounded-3xl p-5 ${t.card}`}>
          <input
            value={gTitle}
            onChange={(e) => setGTitle(e.target.value)}
            placeholder="Qual é o objetivo?"
            className={inputBase}
          />
          <input
            type="date"
            value={gDeadline}
            onChange={(e) => setGDeadline(e.target.value)}
            className={inputBase}
          />
          <button onClick={addGoal} className={`${primaryBtn} w-full`}>
            <Plus size={18} /> Salvar meta
          </button>
        </div>

        {sortedGoals.length === 0 ? (
          <p className={`px-1 text-sm ${t.sub}`}>Nenhuma meta cadastrada.</p>
        ) : (
          <div className="space-y-3">
            {sortedGoals.map((g, i) => {
              const d = daysUntil(g.deadline);
              const priority = !!g.deadline && i === 0 && d <= 7 && !g.concluida;
              return (
                <div
                  key={g.id}
                  className={`flex items-center gap-3 rounded-2xl p-4 ${
                    priority
                      ? "border border-[var(--accent-line)] bg-[var(--accent-soft)]"
                      : t.card
                  }`}
                >
                  <button
                    onClick={() => toggleGoal(g.id)}
                    aria-label={g.concluida ? "Marcar como pendente" : "Marcar como concluída"}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
                      g.concluida
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : isDark
                        ? "border-zinc-600"
                        : "border-zinc-300"
                    }`}
                  >
                    {g.concluida && <Check size={16} strokeWidth={3} />}
                  </button>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium transition ${
                        g.concluida ? `line-through ${t.faint}` : ""
                      }`}
                    >
                      {g.title}
                    </p>
                    <p className={`text-xs ${t.sub}`}>
                      {g.concluida
                        ? "Concluída"
                        : !g.deadline
                        ? "Sem prazo definido"
                        : d < 0
                        ? `Prazo encerrado (${fmtDate(g.deadline)})`
                        : d === 0
                        ? "Vence hoje"
                        : `Faltam ${d} ${d === 1 ? "dia" : "dias"} · ${fmtDate(g.deadline)}`}
                    </p>
                  </div>
                  {priority && (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                      Prioridade
                    </span>
                  )}
                  <DeleteBtn onClick={() => setGoals((p) => p.filter((x) => x.id !== g.id))} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const Switch = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition active:scale-95 ${
        on ? "bg-[var(--accent)]" : isDark ? "bg-zinc-700" : "bg-zinc-300"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
          on ? "left-6" : "left-1"
        }`}
      />
    </button>
  );

  const renderSettings = () => {
    const blockLabels: { key: keyof HomeBlocks; label: string }[] = [
      { key: "notifications", label: "Notificações ativas" },
      { key: "appointments", label: "Próximos compromissos" },
      { key: "debts", label: "Alertas de dívidas" },
      { key: "goals", label: "Metas no prazo" },
    ];
    const lastSyncLabel = (() => {
      if (!lastSync) return "agora mesmo";
      const secs = Math.floor((Date.now() - lastSync) / 1000);
      if (secs < 60) return "agora mesmo";
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins} min atrás`;
      return `${Math.floor(mins / 60)} h atrás`;
    })();
    return (
      <div>
        <Title>Ajustes</Title>

        <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
          <div className={`mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${t.faint}`}>
            <Lock size={15} /> Segurança e tema
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${t.chip}`}>
                {isDark ? (
                  <Moon size={18} className="text-[var(--accent)]" />
                ) : (
                  <Sun size={18} className="text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Tema {isDark ? "escuro" : "claro"}</p>
                <p className={`text-xs ${t.sub}`}>Alternar aparência do app</p>
              </div>
            </div>
            <Switch on={!isDark} onClick={() => setTheme(isDark ? "light" : "dark")} />
          </div>

          <div className={`my-1 border-t ${t.divide}`} />

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${t.chip}`}>
                <Lock size={18} className={t.sub} />
              </div>
              <div>
                <p className="text-sm font-medium">Ativar senha</p>
                <p className={`text-xs ${t.sub}`}>Bloqueio por PIN ao abrir o app</p>
              </div>
            </div>
            <Switch on={isPasswordEnabled} onClick={togglePassword} />
          </div>

          {securityMode !== "idle" && (
            <div
              className={`mt-2 rounded-2xl p-4 transition-all duration-200 ${
                isDark ? "bg-zinc-800/50" : "bg-zinc-100"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium">
                  {securityMode === "enable"
                    ? "Crie um PIN de 4 dígitos"
                    : securityMode === "disable"
                    ? "Digite o PIN atual para desativar"
                    : securityMode === "changeVerify"
                    ? "Confirme o PIN atual"
                    : "Crie o novo PIN"}
                </p>
                <button
                  onClick={closeSecurityPanel}
                  className={`text-xs transition active:scale-95 hover:opacity-70 ${t.sub}`}
                >
                  Cancelar
                </button>
              </div>
              <div className="mb-5 flex justify-center">
                {pinDots(pinDraft.length, pinError, isDark)}
              </div>
              <div className="flex justify-center">
                {pinKeypad(
                  pressDraftDigit,
                  () => setPinDraft((p) => p.slice(0, -1)),
                  isDark,
                  "md"
                )}
              </div>
            </div>
          )}

          {isPasswordEnabled && securityMode === "idle" && (
            <button
              onClick={() => {
                setPinError(false);
                setPinDraft("");
                setSecurityMode("changeVerify");
              }}
              className={`mt-2 w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-200 active:scale-95 ${t.accent} ${
                isDark ? "bg-zinc-800/50 hover:bg-zinc-800" : "bg-zinc-100 hover:bg-zinc-200"
              }`}
            >
              Alterar PIN de segurança
            </button>
          )}
        </div>

        {/* Customização de Visual */}
        <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
          <div className={`mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${t.faint}`}>
            <Palette size={15} /> Customização de Visual
          </div>

          <p className={`mb-2 text-xs font-medium uppercase tracking-wider ${t.faint}`}>
            Plano de fundo
          </p>
          <div className="mb-5 grid grid-cols-3 gap-2">
            {BG_OPTIONS.map((b) => (
              <button
                key={b.id}
                onClick={() => setAppTheme((p) => ({ ...p, bg: b.id }))}
                className={`rounded-2xl border-2 p-3 text-left transition-all duration-200 active:scale-95 ${t.chip} ${
                  appTheme.bg === b.id
                    ? "border-[var(--accent)]"
                    : isDark
                    ? "border-zinc-800/60"
                    : "border-zinc-200"
                }`}
              >
                <span className={`block h-8 w-full rounded-lg ${b.swatch} ring-1 ring-white/10`} />
                <span className="mt-2 block text-[11px] font-medium">{b.label}</span>
              </button>
            ))}
          </div>

          <p className={`mb-2 text-xs font-medium uppercase tracking-wider ${t.faint}`}>
            Cor de destaque
          </p>
          <div className="flex gap-3">
            {ACCENT_OPTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAppTheme((p) => ({ ...p, accent: a.id }))}
                aria-label={a.label}
                className={`h-9 w-9 rounded-full transition-all duration-200 active:scale-90 ${
                  appTheme.accent === a.id ? "scale-110 ring-2 ring-white/50" : "opacity-70"
                }`}
                style={{ backgroundColor: a.hex }}
              />
            ))}
          </div>
        </div>

        {/* Nuvem e Sincronização */}
        <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
          <div className={`mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${t.faint}`}>
            <Cloud size={15} /> Nuvem e Sincronização
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${t.chip}`}>
                <RefreshCw size={18} className={t.sub} />
              </div>
              <div>
                <p className="text-sm font-medium">Sincronização na Nuvem</p>
                <p className={`text-xs ${t.sub}`}>Mantém seus dados salvos em todos os dispositivos</p>
              </div>
            </div>
            <Switch on={cloudSyncEnabled} onClick={() => setCloudSyncEnabled((v) => !v)} />
          </div>

          <div className={`my-1 border-t ${t.divide}`} />

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${t.chip}`}>
                <Database size={18} className={t.sub} />
              </div>
              <p className="text-sm font-medium">Status do Banco de Dados</p>
            </div>
            <span
              className={`flex items-center gap-2 text-xs font-medium ${
                cloudSyncEnabled ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {cloudSyncEnabled && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    cloudSyncEnabled ? "bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.8)]" : "bg-amber-400"
                  }`}
                />
              </span>
              {cloudSyncEnabled ? "Conectado (SQL Cloud)" : "Pausado (local)"}
            </span>
          </div>

          <div className="flex items-center gap-3 py-2.5">
            <div className={`rounded-xl p-2.5 ${t.chip}`}>
              <User size={18} className={t.sub} />
            </div>
            <div>
              <p className="text-sm font-medium">Conta Cortex</p>
              <p className={`text-xs ${t.sub}`}>usuario@cortex.io</p>
            </div>
          </div>
        </div>

        {/* Integridade e Proteção */}
        <div className={`mb-4 rounded-3xl p-5 ${t.card}`}>
          <div className={`mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${t.faint}`}>
            <ShieldCheck size={15} /> Integridade e Proteção
          </div>

          <div className="flex items-center gap-3 py-2.5">
            <div className={`rounded-xl p-2.5 ${t.chip}`}>
              <KeyRound size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Chave de Criptografia AES-256</p>
              <p className={`text-xs ${t.sub}`}>Ativa · Dados protegidos</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-2.5">
            <div className={`rounded-xl p-2.5 ${t.chip}`}>
              <Database size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Backup Automático e Persistente</p>
              <p className={`text-xs ${t.sub}`}>
                Habilitado · Local+Nuvem · Último backup: {lastSyncLabel}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-3xl p-5 ${t.card}`}>
          <div className={`mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${t.faint}`}>
            <Eye size={15} /> Editar Início
          </div>
          <p className={`mb-3 text-xs ${t.sub}`}>Controle o que aparece na tela inicial.</p>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${t.chip}`}>
                <Cpu size={18} className="text-[var(--accent)]" />
              </div>
              <div>
                <p className="text-sm font-medium">Assistente de IA</p>
                <p className={`text-xs ${t.sub}`}>Briefing inteligente no topo da Home</p>
              </div>
            </div>
            <Switch on={isAiEnabled} onClick={() => setIsAiEnabled((v) => !v)} />
          </div>

          <div className={`my-2 border-t ${t.divide}`} />

          {blockLabels.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between py-2.5"
            >
              <span className="text-sm">{label}</span>
              <button
                onClick={() =>
                  setHomeBlocks((p) => ({ ...p, [key]: !p[key] }))
                }
                className={`flex h-6 w-6 items-center justify-center rounded-md transition active:scale-90 ${
                  homeBlocks[key]
                    ? "bg-[var(--accent)] text-white"
                    : isDark
                    ? "border border-zinc-600"
                    : "border border-zinc-300"
                }`}
              >
                {homeBlocks[key] && <CheckCircle2 size={16} />}
              </button>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const screens: Record<TabId, () => ReactNode> = {
    home: renderHome,
    agenda: renderAgenda,
    appointments: renderAppointments,
    finance: renderFinance,
    goals: renderGoals,
    settings: renderSettings,
  };

  /* ----------------------- Splash / loading ----------------------- */
  if (!loaded) {
    return bootScreen();
  }

  /* ---------------------------- Layout ---------------------------- */
  return (
    <div
      className={`min-h-screen ${t.app} transition-colors duration-300`}
      style={accentVars}
    >
      <style>{`
        @keyframes briFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .bri-fade { animation: briFade .25s ease both; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: ${isDark ? "invert(1) opacity(.5)" : "opacity(.5)"}; }
      `}</style>

      {isBooting && bootScreen()}
      {isLocked && lockScreen()}

      <main className="mx-auto max-w-md px-5 pb-28 pt-12">
        <div key={tab} className="bri-fade transition-opacity duration-200">
          {screens[tab]()}
        </div>
      </main>

      {/* Barra de navegação inferior */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-xl ${t.nav}`}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)] pt-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition active:scale-90"
              >
                <Icon
                  size={22}
                  className={active ? "text-[var(--accent)]" : t.faint}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                <span
                  className={`w-full truncate text-center text-[10px] font-medium leading-none ${
                    active ? "text-[var(--accent)]" : t.faint
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
