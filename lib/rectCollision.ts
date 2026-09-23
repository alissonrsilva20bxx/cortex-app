/**
 * Colisão de retângulos — extraído pra ser testável de verdade (mesma
 * razão de lib/proximoAtendimento.ts: o projeto não roda RTL/JSX no
 * Vitest, então lógica pura de DOM/layout só ganha teste real fora de um
 * componente). Usado pelo FAB (achado da revisão visual #131: o FAB
 * fixo podia cobrir "Ver todos" de Objetivos, ou qualquer outra ação,
 * dependendo de quanto conteúdo real havia acima na página) pra saber se
 * o próprio retângulo colide com algum elemento marcado como "evitar".
 */

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * True se os dois retângulos se sobrepõem em algum grau (não só
 * tocando a borda). Sem margem: um retângulo colado exatamente na borda
 * do outro (right === left) não conta como sobreposição.
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

/**
 * True se `subject` colide com QUALQUER retângulo de `avoid`.
 */
export function collidesWithAny(subject: Rect, avoid: Rect[]): boolean {
  return avoid.some((r) => rectsOverlap(subject, r));
}
