import { Search, Sparkles, Layers, ListChecks } from 'lucide-react';

interface TopBarProps {
  totalIdeas: number;
  totalTasks: number;
  totalProjects: number;
  loading: boolean;
}

const summaries = [
  { label: 'Ideias', description: 'Fluxo criativo', icon: Sparkles },
  { label: 'Tarefas', description: 'Próximas ações', icon: ListChecks },
  { label: 'Projetos', description: 'Acionando resultados', icon: Layers },
];

export function TopBar({ totalIdeas, totalTasks, totalProjects, loading }: TopBarProps) {
  return (
    <header className="mb-6 space-y-6 rounded-[2rem] border border-white/5 bg-panel/90 p-6 shadow-glow backdrop-blur-xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-cyan-300/80">Olá, bem-vindo ao BrainOS</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Organize seu mundo com clareza e ritmo.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Um único espaço para vida, empresa, projetos e finanças, com navegação suave e foco no que importa.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-3 rounded-3xl bg-slate-950/80 p-4 text-slate-300 shadow-inner shadow-black/20 sm:max-w-md">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Search className="h-5 w-5 text-cyan-300" />
            <input
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              placeholder="Busque tarefas, ideias ou finanças..."
              aria-label="Pesquisar"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-900/90 p-4 text-white shadow-[0_20px_120px_-80px_rgba(56,189,248,0.45)]">
              <p className="text-2xl font-semibold">{loading ? '...' : totalIdeas}</p>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Ideias em aberto</p>
            </div>
            <div className="rounded-3xl bg-slate-900/90 p-4 text-white shadow-[0_20px_120px_-80px_rgba(56,189,248,0.35)]">
              <p className="text-2xl font-semibold">{loading ? '...' : totalTasks}</p>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Tarefas ativas</p>
            </div>
            <div className="rounded-3xl bg-slate-900/90 p-4 text-white shadow-[0_20px_120px_-80px_rgba(56,189,248,0.25)]">
              <p className="text-2xl font-semibold">{loading ? '...' : totalProjects}</p>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Projetos ativos</p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {summaries.map((summary) => (
          <div key={summary.label} className="rounded-3xl border border-white/5 bg-slate-900/80 p-4 text-slate-200 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-cyan-300">
              <summary.icon className="h-5 w-5" />
              <span className="text-sm font-semibold">{summary.label}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{summary.description}</p>
          </div>
        ))}
      </div>
    </header>
  );
}
