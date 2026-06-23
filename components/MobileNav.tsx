import type { ComponentType } from 'react';
import { Compass, FileText, ListChecks, PieChart, Sparkles } from 'lucide-react';

type DashboardView = 'overview' | 'tasks' | 'ideas' | 'finance' | 'mindmap';

const navItems: Array<{ id: DashboardView; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Visão geral', icon: Sparkles },
  { id: 'tasks', label: 'Tarefas', icon: ListChecks },
  { id: 'ideas', label: 'Ideias', icon: FileText },
  { id: 'finance', label: 'Finanças', icon: PieChart },
  { id: 'mindmap', label: 'Mapa', icon: Compass },
];

interface MobileNavProps {
  activeView: DashboardView;
  onChangeView: (view: DashboardView) => void;
}

export function MobileNav({ activeView, onChangeView }: MobileNavProps) {
  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center justify-between gap-2 rounded-3xl border border-white/10 bg-slate-950/95 px-4 py-3 shadow-glow backdrop-blur-xl lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeView(item.id)}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              active ? 'bg-cyan-400 text-slate-950 shadow-cyan-400/20' : 'text-slate-300 hover:bg-slate-900/90 hover:text-cyan-200'
            }`}
            aria-label={item.label}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </nav>
  );
}
