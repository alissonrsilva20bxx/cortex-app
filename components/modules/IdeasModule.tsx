import { ModuleCard } from './ModuleCard';
import { Lightbulb, Sparkles } from 'lucide-react';
import { Idea } from '@/lib/types';

interface IdeasModuleProps {
  ideas: Idea[];
  loading: boolean;
}

export function IdeasModule({ ideas, loading }: IdeasModuleProps) {
  return (
    <ModuleCard title="Ideias" description="Capture, refine e conecte pensamentos de forma visual e rápida.">
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-3xl bg-slate-900/80 text-slate-500">Carregando ideias...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ideas.map((idea) => (
            <div key={idea.id} className="rounded-3xl border border-white/5 bg-slate-900/80 p-4 text-sm text-slate-200">
              <div className="mb-2 flex items-center gap-2 text-cyan-300">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">{idea.title}</span>
              </div>
              <p className="text-slate-400">{idea.description}</p>
              <span className="mt-3 inline-flex rounded-full bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-200">
                {idea.category}
              </span>
            </div>
          ))}
        </div>
      )}
      <button className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400/15 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/25">
        <Lightbulb className="h-4 w-4" />
        Adicionar nova ideia
      </button>
    </ModuleCard>
  );
}
