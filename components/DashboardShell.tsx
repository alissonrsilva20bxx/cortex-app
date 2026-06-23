'use client';

import { useEffect, useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { ActivityModule } from '@/components/modules/ActivityModule';
import { FinanceModule } from '@/components/modules/FinanceModule';
import { IdeasModule } from '@/components/modules/IdeasModule';
import { MindMapModule } from '@/components/modules/MindMapModule';
import { ProjectsModule } from '@/components/modules/ProjectsModule';
import { TaskModule } from '@/components/modules/TaskModule';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { MobileNav } from '@/components/MobileNav';
import { QuickCreatePanel } from '@/components/QuickCreatePanel';
import { DashboardData, Idea, Project, Task } from '@/lib/types';
import { initialDashboardData } from '@/lib/data';

type DashboardView = 'overview' | 'tasks' | 'ideas' | 'finance' | 'mindmap';

type CreateType = 'idea' | 'task' | 'project';

interface DashboardShellProps {
  hideMobileNav?: boolean;
}

export function DashboardShell({ hideMobileNav }: DashboardShellProps) {
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboardData);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<DashboardView>('overview');
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<CreateType>('idea');
  const [editTarget, setEditTarget] = useState<
    | { type: 'idea'; item: Idea }
    | { type: 'task'; item: Task }
    | { type: 'project'; item: Project }
    | null
  >(null);

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
    setEditTarget(null);
    setIsQuickCreateOpen(true);
  };

  const handleViewChange = (nextView: DashboardView) => {
    setView(nextView);
  };

  const renderView = () => {
    switch (view) {
      case 'ideas':
        return <IdeasModule ideas={dashboard.ideas} loading={loading} />;
      case 'tasks':
        return <TaskModule tasks={dashboard.tasks} loading={loading} />;
      case 'finance':
        return <FinanceModule finance={dashboard.finance} loading={loading} />;
      case 'mindmap':
        return <MindMapModule ideas={dashboard.ideas} tasks={dashboard.tasks} projects={dashboard.projects} loading={loading} />;
      default:
        return (
          <section className="grid gap-6 xl:grid-cols-[420px_minmax(520px,1fr)]">
            <div className="space-y-6">
              <IdeasModule ideas={dashboard.ideas} loading={loading} />
              <TaskModule tasks={dashboard.tasks} loading={loading} />
              <MindMapModule ideas={dashboard.ideas} tasks={dashboard.tasks} projects={dashboard.projects} loading={loading} />
            </div>
            <div className="space-y-6">
              <ProjectsModule projects={dashboard.projects} loading={loading} />
              <FinanceModule finance={dashboard.finance} loading={loading} />
              <ActivityModule activity={dashboard.activity} loading={loading} />
            </div>
          </section>
        );
    }
  };

  const totalIdeas = useMemo(() => dashboard.ideas.length, [dashboard.ideas]);
  const totalTasks = useMemo(() => dashboard.tasks.length, [dashboard.tasks]);
  const totalProjects = useMemo(() => dashboard.projects.length, [dashboard.projects]);

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-6 lg:px-8">
        <Sidebar activeView={view} onChangeView={handleViewChange} />
        <main className="flex-1 pb-28 lg:pb-0">
          <TopBar totalIdeas={totalIdeas} totalTasks={totalTasks} totalProjects={totalProjects} loading={loading} />
          {renderView()}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => openQuickCreate('idea')}
              className="inline-flex items-center rounded-3xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Criar ideia
            </button>
            <button
              onClick={() => openQuickCreate('task')}
              className="inline-flex items-center rounded-3xl bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Criar tarefa
            </button>
            <button
              onClick={() => openQuickCreate('project')}
              className="inline-flex items-center rounded-3xl bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Criar projeto
            </button>
          </div>
        </main>
      </div>
      <button
        type="button"
        onClick={() => openQuickCreate('idea')}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-[0_25px_80px_-40px_rgba(16,185,129,0.8)] transition hover:scale-105 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        aria-label="Nova ideia"
      >
        <PlusCircle className="h-7 w-7" />
      </button>
      <MobileNav activeView={view} onChangeView={handleViewChange} />
      <QuickCreatePanel
        open={isQuickCreateOpen}
        defaultType={quickCreateType}
        editTarget={editTarget}
        onClose={() => setIsQuickCreateOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
