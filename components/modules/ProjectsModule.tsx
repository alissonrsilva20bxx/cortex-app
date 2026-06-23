import { ModuleCard } from './ModuleCard';
import { Briefcase, Layers } from 'lucide-react';
import { Project } from '@/lib/types';

interface ProjectsModuleProps {
  projects: Project[];
  loading: boolean;
}

export function ProjectsModule({ projects, loading }: ProjectsModuleProps) {
  return (
    <ModuleCard title="Projetos" description="Acompanhe entregas, marcos e resultados em cada projeto ativo.">
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-3xl bg-slate-900/80 text-slate-500">Carregando projetos...</div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="rounded-3xl border border-white/5 bg-slate-900/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{project.title}</h4>
                  <p className="mt-1 text-xs text-slate-400">{project.stage}</p>
                </div>
                <Briefcase className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${project.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{project.progress}% concluído</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Layers className="h-4 w-4 text-cyan-300" />
        <span>{loading ? '...' : `${projects.length} projetos ativos`}</span>
      </div>
    </ModuleCard>
  );
}
