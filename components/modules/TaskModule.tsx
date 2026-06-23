import { ModuleCard } from './ModuleCard';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { Task } from '@/lib/types';

interface TaskModuleProps {
  tasks: Task[];
  loading: boolean;
}

export function TaskModule({ tasks, loading }: TaskModuleProps) {
  return (
    <ModuleCard title="Tarefas" description="Gerencie compromissos e prioridades com clareza e foco.">
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-3xl bg-slate-900/80 text-slate-500">Carregando tarefas...</div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-3xl border border-white/5 bg-slate-900/80 p-4">
              <div>
                <h4 className="text-sm font-semibold text-white">{task.title}</h4>
                <p className="mt-1 text-xs text-slate-400">{task.project} · {task.due}</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {task.status}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 pt-2 text-sm text-slate-300">
        <CalendarDays className="h-4 w-4 text-cyan-300" />
        <span>{loading ? '...' : `${tasks.length} tarefas com prazo definido`}</span>
      </div>
    </ModuleCard>
  );
}
