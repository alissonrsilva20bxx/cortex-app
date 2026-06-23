import { ModuleCard } from './ModuleCard';
import { Clock3, Zap } from 'lucide-react';
import { ActivityEvent } from '@/lib/types';

interface ActivityModuleProps {
  activity: ActivityEvent[];
  loading: boolean;
}

export function ActivityModule({ activity, loading }: ActivityModuleProps) {
  return (
    <ModuleCard title="Atividade" description="Resumo das ações recentes e insights rápidos para seguir adiante.">
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-3xl bg-slate-900/80 text-slate-500">Carregando atividades...</div>
      ) : (
        <ul className="space-y-3">
          {activity.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-3xl border border-white/5 bg-slate-900/80 p-4 text-sm text-slate-300">
              <div>
                <p className="font-medium text-white">{item.event}</p>
                <p className="mt-1 text-xs text-slate-500">{item.time}</p>
              </div>
              <Zap className="h-4 w-4 text-cyan-300" />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Clock3 className="h-4 w-4 text-cyan-300" />
        <span>Visão contínua das ações recentes.</span>
      </div>
    </ModuleCard>
  );
}
