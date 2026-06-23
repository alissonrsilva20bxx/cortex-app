'use client';

import type { ComponentType } from 'react';
import { Compass, FileText, Layers, ListChecks, PieChart, Sparkles } from 'lucide-react';

type DashboardView = 'overview' | 'tasks' | 'ideas' | 'finance' | 'mindmap';

const navItems: Array<{ id: DashboardView; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Visão geral', icon: Sparkles },
  { id: 'tasks', label: 'Tarefas', icon: ListChecks },
  { id: 'ideas', label: 'Ideias', icon: FileText },
  { id: 'finance', label: 'Finanças', icon: PieChart },
  { id: 'mindmap', label: 'Mapa mental', icon: Compass },
];

interface SidebarProps {
  activeView: DashboardView;
  onChangeView: (view: DashboardView) => void;
}

export function Sidebar({ activeView, onChangeView }: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:w-[320px] lg:flex-col lg:gap-6 lg:rounded-[2.5rem] lg:border lg:border-white/5 lg:bg-panel/85 lg:p-6 lg:shadow-glow lg:sticky lg:top-6">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5">
        <span className="mb-3 inline-block text-xs uppercase tracking-[0.32em] text-slate-400">Minha vida digital</span>
        <h1 className="text-4xl font-semibold text-white">BrainOS</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Um ecossistema visual para conectar ideias, trabalho, finanças e bem-estar.
        </p>
      </div>

      <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/80 px-3 py-2 text-slate-200">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          Criatividade ativa
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/80 px-3 py-2 text-slate-200">
          <Layers className="h-4 w-4 text-emerald-300" />
          Projetos em andamento
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/80 px-3 py-2 text-slate-200">
          <PieChart className="h-4 w-4 text-violet-300" />
          Finanças sob controle
        </span>
      </div>

      <nav className="space-y-3">
        {navItems.map((item) => {
          const isActive = item.id === activeView;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`flex w-full items-center gap-3 rounded-[1.5rem] px-4 py-3 text-left transition ${
                isActive ? 'bg-cyan-400/10 text-white shadow-[0_15px_40px_-25px_rgba(56,189,248,0.6)]' : 'text-slate-300 hover:bg-slate-900/80 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 text-sm text-slate-300">
        <p className="font-semibold text-white">Mapa mental</p>
        <p className="mt-2 text-sm leading-6">Navegue seu trabalho e sua vida como mapas conectados e priorizados.</p>
      </div>
    </aside>
  );
}
