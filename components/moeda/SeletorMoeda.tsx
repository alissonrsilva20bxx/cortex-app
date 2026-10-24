"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MOEDAS, salvarMoeda, simboloMoeda, type Moeda } from "@/lib/moeda";
import { TEXTOS_MOEDA } from "@/lib/textosMoeda";
import { useMoeda } from "@/lib/useMoeda";

/**
 * Euro ou dólar, salvo neste aparelho. Só muda a exibição e o preço dos
 * planos: nenhum valor digitado é convertido (a frase embaixo avisa).
 */
export function SeletorMoeda() {
  const moeda = useMoeda();
  return (
    <div role="group" aria-label={TEXTOS_MOEDA.rotuloDoSeletor}>
      <SegmentedControl<Moeda>
        value={moeda}
        onChange={salvarMoeda}
        options={MOEDAS.map((id) => ({
          id,
          label: `${TEXTOS_MOEDA.nome[id]} (${simboloMoeda(id)})`,
        }))}
      />
      <p
        style={{
          fontSize: 12.5,
          lineHeight: 1.45,
          color: "var(--text-muted)",
          marginTop: 8,
        }}
      >
        {TEXTOS_MOEDA.aviso}
      </p>
    </div>
  );
}
