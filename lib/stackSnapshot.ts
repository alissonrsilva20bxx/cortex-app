/**
 * "Fotografia" estática de uma tela da pilha da Rede, usada só durante as
 * transições de push/pop/arraste (lib/useStackNav.ts).
 *
 * Por que um clone do DOM e não animar a tela viva: a tela viva mora no
 * fluxo normal do documento (quem rola é o window), e várias telas têm
 * descendentes `position: fixed` (composer e pílula "Nova mensagem" do
 * chat). Um `transform` na tela viva vira o bloco de contenção desses
 * `fixed` e eles saltam ~160px pra cima no meio da animação. O clone vai
 * numa camada `fixed inset:0` própria, com `transform` sempre ligado — os
 * `fixed` do clone se posicionam pela camada, que tem o tamanho exato da
 * viewport, então ficam onde a pessoa os via.
 *
 * O clone é inerte (`inert` + `aria-hidden` + `pointer-events:none`), sem
 * `id` duplicado, e copia o que `cloneNode` não copia: valor digitado em
 * campos e rolagem de elementos internos (carrossel de fotos).
 */

export interface SnapshotLayer {
  el: HTMLElement;
  /** Anexa ao body (se ainda não estiver) e reaplica rolagens internas. */
  mount: (zIndex: number) => void;
  unmount: () => void;
}

export function createSnapshotLayer(
  page: HTMLElement,
  opaque: boolean
): SnapshotLayer {
  const rect = page.getBoundingClientRect();
  const clone = page.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");

  const scrollFixups: Array<() => void> = [];
  const src = page.querySelectorAll<HTMLElement>("*");
  const dst = clone.querySelectorAll<HTMLElement>("*");
  for (let i = 0; i < src.length && i < dst.length; i++) {
    const a = src[i];
    const b = dst[i];
    if (b.id) b.removeAttribute("id");
    if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) {
      (b as HTMLInputElement | HTMLTextAreaElement).value = a.value;
    } else if (
      a instanceof HTMLVideoElement ||
      a instanceof HTMLIFrameElement
    ) {
      // Mídia "viva" no clone recarregaria/tocaria de novo — vira um bloco
      // vazio do mesmo tamanho.
      const r = a.getBoundingClientRect();
      const ph = document.createElement("div");
      ph.style.width = `${r.width}px`;
      ph.style.height = `${r.height}px`;
      b.replaceWith(ph);
      continue;
    }
    if (a.scrollLeft || a.scrollTop) {
      const left = a.scrollLeft;
      const top = a.scrollTop;
      scrollFixups.push(() => {
        b.scrollLeft = left;
        b.scrollTop = top;
      });
    }
  }

  clone.style.position = "absolute";
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.margin = "0";
  clone.style.visibility = "visible";

  const el = document.createElement("div");
  el.className = opaque
    ? "stack-snapshot stack-snapshot--opaque"
    : "stack-snapshot";
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("inert", "");
  el.style.transform = "translate3d(0, 0, 0)";
  if (opaque) {
    // Mesmo fundo do body (gradiente/glow do tema), alinhado com a
    // rolagem atual — o body pinta o gradiente na altura do documento
    // inteiro e ele rola junto, então a camada recorta a mesma faixa.
    const body = document.body.getBoundingClientRect();
    el.style.backgroundSize = `100% ${body.height}px`;
    el.style.backgroundPosition = `0 ${body.top}px`;
  }
  el.appendChild(clone);

  return {
    el,
    mount(zIndex: number) {
      el.style.zIndex = String(zIndex);
      if (!el.isConnected) document.body.appendChild(el);
      scrollFixups.forEach((fix) => fix());
    },
    unmount() {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = "translate3d(0, 0, 0)";
      el.remove();
    },
  };
}

/** Véu escuro entre a tela de baixo e a de cima (o "escurecer" do iOS). */
export function createDimLayer(zIndex: number): HTMLElement {
  const dim = document.createElement("div");
  dim.className = "stack-snapshot-dim";
  dim.setAttribute("aria-hidden", "true");
  dim.style.zIndex = String(zIndex);
  dim.style.opacity = "0";
  document.body.appendChild(dim);
  return dim;
}
