'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, PlusCircle, X } from 'lucide-react';
import { Idea, Project, Task } from '@/lib/types';

export type DashboardCreatePayload =
  | { type: 'idea'; title: string; description: string; category: string }
  | { type: 'task'; title: string; project: string; due: string; status: string }
  | { type: 'project'; title: string; stage: string; progress: number };

interface QuickCreatePanelProps {
  open: boolean;
  defaultType?: 'idea' | 'task' | 'project';
  editTarget: { type: 'idea' | 'task' | 'project'; item: Idea | Task | Project } | null;
  onClose: () => void;
  onSave: (payload: DashboardCreatePayload) => void;
}

export function QuickCreatePanel({ open, defaultType = 'idea', editTarget, onClose, onSave }: QuickCreatePanelProps) {
  const [type, setType] = useState<'idea' | 'task' | 'project'>(editTarget?.type ?? defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Pessoal');
  const [project, setProject] = useState('');
  const [due, setDue] = useState('Hoje');
  const [status, setStatus] = useState('Planejado');
  const [stage, setStage] = useState('Ideação');
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (editTarget) {
      setType(editTarget.type);
      setTitle(editTarget.item.title);

      if (editTarget.type === 'idea') {
        const current = editTarget.item as Idea;
        setDescription(current.description);
        setCategory(current.category);
      }

      if (editTarget.type === 'task') {
        const current = editTarget.item as Task;
        setProject(current.project);
        setDue(current.due);
        setStatus(current.status);
        setDescription('');
      }

      if (editTarget.type === 'project') {
        const current = editTarget.item as Project;
        setStage(current.stage);
        setProgress(current.progress);
        setDescription('');
      }
    } else {
      setType(defaultType);
      setTitle('');
      setDescription('');
      setCategory('Pessoal');
      setProject('Operações');
      setDue('Hoje');
      setStatus('Planejado');
      setStage('Ideação');
      setProgress(10);
    }
  }, [open, editTarget, defaultType]);

  const handleSubmit = () => {
    if (!title.trim()) {
      return;
    }

    if (type === 'idea') {
      onSave({ type, title: title.trim(), description: description.trim() || 'Sem descrição', category });
    }

    if (type === 'task') {
      onSave({ type, title: title.trim(), project: project.trim() || 'Geral', due, status });
    }

    if (type === 'project') {
      onSave({ type, title: title.trim(), stage, progress });
    }

    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <section className="relative z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 translate-y-0 opacity-100">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Ação rápida</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {editTarget ? 'Editar item' : 'Criar novo item'}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-slate-900/80 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {(['idea', 'task', 'project'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={`rounded-3xl border px-4 py-3 text-left transition ${type === option ? 'border-cyan-300 bg-cyan-400/10 text-white' : 'border-white/10 bg-slate-900/80 text-slate-300 hover:border-cyan-400/30 hover:bg-slate-900/90'}`}
              >
                <span className="block text-sm font-semibold capitalize">{option}</span>
                <span className="mt-1 block text-xs text-slate-500">{option === 'idea' ? 'Inspiração' : option === 'task' ? 'Ação' : 'Objetivo'}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-slate-900/90 p-5 shadow-inner shadow-black/10">
            <label className="block text-sm text-slate-300">
              Título
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                placeholder="Digite um título impactante"
              />
            </label>

            {type === 'idea' && (
              <>
                <label className="block text-sm text-slate-300">
                  Descrição
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-2 min-h-[120px] w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    placeholder="Escreva o conceito rápido"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Categoria
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  >
                    <option>Pessoal</option>
                    <option>Negócios</option>
                    <option>Criatividade</option>
                    <option>Resumo</option>
                  </select>
                </label>
              </>
            )}

            {type === 'task' && (
              <>
                <label className="block text-sm text-slate-300">
                  Projeto
                  <input
                    value={project}
                    onChange={(event) => setProject(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    placeholder="Conecte ao projeto"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Prazo
                    <input
                      value={due}
                      onChange={(event) => setDue(event.target.value)}
                      className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                      placeholder="Hoje"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Status
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    >
                      <option>Planejado</option>
                      <option>Em andamento</option>
                      <option>Concluído</option>
                    </select>
                  </label>
                </div>
              </>
            )}

            {type === 'project' && (
              <>
                <label className="block text-sm text-slate-300">
                  Estágio
                  <input
                    value={stage}
                    onChange={(event) => setStage(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                    placeholder="Design, Construção, lançamento"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Progresso
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(event) => setProgress(Number(event.target.value))}
                    className="mt-2 w-full accent-cyan-300"
                  />
                  <span className="mt-2 block text-sm text-slate-400">{progress}% concluído</span>
                </label>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-3xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            <CheckCircle2 className="h-5 w-5" />
            {editTarget ? 'Salvar alterações' : 'Adicionar ao BrainOS'}
          </button>
        </div>
      </section>
    </div>
  );
}
