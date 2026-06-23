'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MindMapModule } from '@/components/modules/MindMapModule';
import { MobileNav } from '@/components/MobileNav';
import { QuickCreatePanel } from '@/components/QuickCreatePanel';
import { DashboardData, Idea, Project, Task } from '@/lib/types';
import { initialDashboardData } from '@/lib/data';

type DashboardView = 'overview' | 'tasks' | 'ideas' | 'finance' | 'mindmap';
type CreateType = 'idea' | 'task' | 'project';

export default function MindMapPage() {
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboardData);
  const [loading, setLoading] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<CreateType>('idea');

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = (await response.json()) as DashboardData;
          setDashboard(data);
        }
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const handleSave = (
    payload:
      | { type: 'idea'; title: string; description: string; category: string }
      | { type: 'task'; title: string; project: string; due: string; status: string }
      | { type: 'project'; title: string; stage: string; progress: number }
  ) => {
    setDashboard((prev) => {
      if (payload.type === 'idea') {
        return {
          ...prev,
          ideas: [
            {
              id: `idea-${prev.ideas.length + 1}`,
              title: payload.title,
              description: payload.description,
              category: payload.category,
            },
            ...prev.ideas,
          ],
        };
      }

      if (payload.type === 'task') {
        return {
          ...prev,
          tasks: [
            {
              id: `task-${prev.tasks.length + 1}`,
              title: payload.title,
              status: payload.status,
              due: payload.due,
              project: payload.project,
            },
            ...prev.tasks,
          ],
        };
      }

      return {
        ...prev,
        projects: [
          {
            id: `project-${prev.projects.length + 1}`,
            title: payload.title,
            stage: payload.stage,
            progress: payload.progress,
          },
          ...prev.projects,
        ],
      };
    });
  };

  const openQuickCreate = (type: CreateType) => {
    setQuickCreateType(type);
    setIsQuickCreateOpen(true);
  };

  const router = useRouter();

  const handleViewChange = (nextView: DashboardView) => {
    if (nextView !== 'mindmap') {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/5 bg-panel/90 p-6 shadow-glow backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300/80">Mapa mental</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Tela exclusiva do Mapa</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Um mural investigativo que organiza automaticamente seus nós de ideias em um ecossistema visual.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/" className="inline-flex items-center gap-2 rounded-3xl border border-white/10 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" /> Voltar para o dashboard
            </Link>
            <button
              type="button"
              onClick={() => openQuickCreate('idea')}
              className="inline-flex items-center gap-2 rounded-3xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              + Nova Ideia
            </button>
          </div>
        </header>

        <main className="grow">
          <MindMapModule
            ideas={dashboard.ideas}
            tasks={dashboard.tasks}
            projects={dashboard.projects}
            loading={loading}
            fullScreen
            onCreateIdea={() => openQuickCreate('idea')}
          />
        </main>
      </div>

      <MobileNav activeView="mindmap" onChangeView={handleViewChange} />

      <QuickCreatePanel
        open={isQuickCreateOpen}
        defaultType={quickCreateType}
        editTarget={null}
        onClose={() => setIsQuickCreateOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
