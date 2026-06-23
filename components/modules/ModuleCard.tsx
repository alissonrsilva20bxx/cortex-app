'use client';

import { ReactNode } from 'react';

interface ModuleCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function ModuleCard({ title, description, children }: ModuleCardProps) {
  return (
    <section className="rounded-[2rem] border border-white/5 bg-slate-950/75 p-6 shadow-glow backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-slate-900/90">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
