/**
 * Partículas e confete da comemoração (J13), portados do protótipo
 * aprovado (`burst`, `confetti`, `loop` em
 * docs/jornada/referencias/prototipo-sua-jornada.html): mesma física,
 * mesmas quantidades, mesmas cores (o acento do tema, uma versão funda
 * dele, dourado, branco e rosa claro). Desenha num <canvas> que cobre a
 * tela e não recebe toque.
 */

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  c: string;
  sh: "rect" | "star" | "dot";
  life: number;
}

export interface Particulas {
  /** Estouro em volta de um ponto (aviso: 16 pequenas; selo: 34 grandes). */
  estouro(x: number, y: number, n: number, grande: boolean): void;
  /** Confete do palco: 170 dos cantos + 70 caindo do alto em .45s. */
  confete(): void;
  parar(): void;
}

function estrela(c: CanvasRenderingContext2D, r: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.38 : r;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

function cores(el: HTMLElement): string[] {
  const css = getComputedStyle(el);
  const acc = css.getPropertyValue("--accent").trim() || "#ff2d78";
  const deep =
    css.getPropertyValue("--accent-deep").trim() ||
    css.getPropertyValue("--accent-soft").trim() ||
    acc;
  return [acc, deep, "#ffd36b", "#ffffff", "#f7b6c8", acc];
}

export function criarParticulas(canvas: HTMLCanvasElement): Particulas {
  const ctx = canvas.getContext("2d");
  const parts: Particula[] = [];
  let rodando = false;
  let quadro = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = () => canvas.clientWidth || window.innerWidth;
  const H = () => canvas.clientHeight || window.innerHeight;

  function dimensionar() {
    canvas.width = Math.round(W() * dpr);
    canvas.height = Math.round(H() * dpr);
  }

  function laco() {
    if (!ctx) return;
    rodando = true;
    let ultimo = performance.now();
    const f = (agora: number) => {
      const dt = Math.min(40, agora - ultimo);
      ultimo = agora;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W(), H());
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0 || p.y > H() + 40) {
          parts.splice(i, 1);
          continue;
        }
        const k = dt / 16.7;
        p.vy += p.g * k;
        p.vx *= Math.pow(p.drag, k);
        p.vy *= Math.pow(p.drag, k);
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.rot += p.vr * k;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 350);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.sh === "rect") {
          ctx.scale(1, Math.cos(p.rot * 3));
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else if (p.sh === "star") estrela(ctx, p.w);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w, 0, 6.283);
          ctx.fill();
        }
        ctx.restore();
      }
      if (parts.length) quadro = requestAnimationFrame(f);
      else {
        ctx.clearRect(0, 0, W(), H());
        rodando = false;
      }
    };
    quadro = requestAnimationFrame(f);
  }

  function soltar(p: Particula) {
    parts.push(p);
    if (!rodando) {
      dimensionar();
      laco();
    }
  }

  return {
    estouro(x, y, n, grande) {
      const cs = cores(canvas);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283;
        const sp = (grande ? 3 : 2) + Math.random() * (grande ? 6 : 3.5);
        soltar({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1,
          g: 0.09,
          drag: 0.94,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.3,
          w: 2 + Math.random() * (grande ? 5 : 3.5),
          h: 0,
          c: cs[i % cs.length],
          sh: i % 3 ? "star" : "dot",
          life: 600 + Math.random() * 500,
        });
      }
    },
    confete() {
      const cs = cores(canvas);
      const w = W();
      const h = H();
      for (let i = 0; i < 170; i++) {
        const esq = i % 2 === 0;
        const a = (esq ? -1.05 : -2.09) + (Math.random() - 0.5) * 0.6;
        const sp = 11 + Math.random() * 9;
        soltar({
          x: esq ? -10 : w + 10,
          y: h * 0.78,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          g: 0.24,
          drag: 0.975,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.35,
          w: 6 + Math.random() * 5,
          h: 9 + Math.random() * 6,
          c: cs[i % cs.length],
          sh: i % 7 === 0 ? "star" : "rect",
          life: 3400 + Math.random() * 900,
        });
      }
      timers.push(
        setTimeout(() => {
          for (let j = 0; j < 70; j++)
            soltar({
              x: Math.random() * w,
              y: -20 - Math.random() * 120,
              vx: (Math.random() - 0.5) * 2,
              vy: 2 + Math.random() * 3,
              g: 0.06,
              drag: 0.99,
              rot: Math.random() * 6,
              vr: (Math.random() - 0.5) * 0.25,
              w: 6,
              h: 10,
              c: cs[j % cs.length],
              sh: "rect",
              life: 4200,
            });
        }, 450)
      );
    },
    parar() {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(quadro);
      parts.length = 0;
      rodando = false;
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
