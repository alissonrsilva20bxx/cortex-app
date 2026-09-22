"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Period } from "./JobsTab";

const PERIOD_OPTS: { id: Period; label: string }[] = [
  { id: "sem", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Preferência real de gráfico (Ajustes) — mesma prop que JobsTab já recebia. */
  chartType: "bar" | "donut";
  period: Period;
  onPeriodChange: (p: Period) => void;
  periodData: { label: string; value: number }[];
  donutSegments: { label: string; value: number; color: string }[];
  totalJobs: number;
}

/**
 * "Resumo" — antes um card colapsável no fim da página (T3/#30); agora um
 * sheet aberto por botão, como `/dev-preview/ios` (`kind === "grafico-agenda"`,
 * segmentado Semana/Mês/Ano + gráfico). Decisão de #30 (colapsável) marcada
 * superseded pelo usuário nesta etapa de replanejamento (issue #122, Notes
 * 2026-09-22) — não é regrillada aqui.
 *
 * Mesmo dado real de antes (`buildPeriodData`/`donutSegments`, calculados em
 * `JobsTab.tsx` e só passados como props) — este componente não recalcula
 * nada, só reapresenta. Rótulos "Semana/Mês/Ano" por extenso (em vez de
 * "S/M/A" da versão colapsada) porque agora há espaço de sobra no sheet,
 * e bate literalmente com os rótulos do protótipo aprovado.
 */
export function AgendaResumoSheet({
  open,
  onClose,
  chartType,
  period,
  onPeriodChange,
  periodData,
  donutSegments,
  totalJobs,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Resumo">
      <div className="px-5 py-6">
        {chartType === "donut" ? (
          <div className="flex justify-center py-2">
            <DonutChart
              segments={donutSegments}
              size={150}
              centerValue={String(totalJobs)}
              centerLabel="atend."
            />
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-5">
              <SegmentedControl
                size="sm"
                options={PERIOD_OPTS}
                value={period}
                onChange={onPeriodChange}
              />
            </div>
            <MiniBarChart
              data={periodData}
              height={140}
              id="agenda-resumo-bar"
            />
          </>
        )}
      </div>
    </BottomSheet>
  );
}
