import { ModuleCard } from './ModuleCard';
import { DollarSign, TrendingUp } from 'lucide-react';
import { FinanceMetric } from '@/lib/types';

interface FinanceModuleProps {
  finance: FinanceMetric[];
  loading: boolean;
}

export function FinanceModule({ finance, loading }: FinanceModuleProps) {
  return (
    <ModuleCard title="Finanças" description="Visualize resultados, fluxo de caixa e decisões financeiras chave.">
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-3xl bg-slate-900/80 text-slate-500">Carregando finanças...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {finance.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/5 bg-slate-900/80 p-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
              <p className="mt-2 text-sm text-slate-400">{item.trend} no último mês</p>
              <p className="mt-3 text-xs text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <TrendingUp className="h-4 w-4 text-cyan-300" />
        <span>Visão financeira integrada.</span>
      </div>
    </ModuleCard>
  );
}
