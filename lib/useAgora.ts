import { useEffect, useState } from "react";
import { agoraSeMudouDeMinuto, assinarRelogio } from "@/lib/relogio";

/** A hora de agora, renovada a cada minuto e quando o foco da aba volta.
 * Só redesenha quem usa o hook, e só quando o minuto muda. `ativo = false`
 * não deixa relógio nenhum rodando. */
export function useAgora(ativo = true): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!ativo) return;
    const renovar = () =>
      setAgora((anterior) => agoraSeMudouDeMinuto(anterior, new Date()));
    renovar();
    return assinarRelogio(renovar);
  }, [ativo]);
  return agora;
}
