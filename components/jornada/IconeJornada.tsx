"use client";

/**
 * Os ícones do protótipo aprovado da Jornada
 * (docs/jornada/referencias/prototipo-sua-jornada.html, `var P` e as
 * funções `ic`/`icf`): mesmos traços, copiados de lá sem mudar nada
 * (tests/wiring/pixel-jornada.test.ts confere caminho a caminho). Texto
 * fixo, nunca dado da usuária, por isso o `dangerouslySetInnerHTML`.
 */
export { TRACOS, type NomeIcone } from "./tracos";
import { TRACOS, type NomeIcone } from "./tracos";

/** `ic(n, s, sw, c)` do protótipo: ícone de traço. */
export function Ic({
  n,
  s = 22,
  sw = 2,
  c = "currentColor",
}: {
  n: NomeIcone;
  s?: number;
  sw?: number;
  c?: string;
}) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: TRACOS[n] }}
    />
  );
}

/** `icf(n, s)` do protótipo: ícone preenchido (a faísca). */
export function Icf({ n, s }: { n: NomeIcone; s: number }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: TRACOS[n] }}
    />
  );
}
