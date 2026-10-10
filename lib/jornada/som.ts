/**
 * Os sons da Jornada (J13). Sintetizados com Web Audio, sem arquivo de
 * áudio: são os MESMOS do protótipo aprovado ("gostei"), portados nota a
 * nota de `docs/jornada/referencias/prototipo-sua-jornada.html` (bloco
 * "som (sintetizado, sem arquivos)": `tone`, `noise` e `SFX`).
 *
 * Garantias:
 *  - **Nunca lança.** Sem Web Audio, com o áudio bloqueado pelo navegador
 *    antes do primeiro toque, ou com qualquer erro do contexto, `tocarSom`
 *    devolve `false` e a comemoração segue sem som.
 *  - **Respeita o silencioso do aparelho.** Web Audio já segue o volume do
 *    sistema. No iPhone, a sessão de áudio é marcada como "ambient" (quando
 *    o Safari oferece `navigator.audioSession`), que é a categoria que
 *    OBEDECE a chave do silencioso -- o som da Jornada nunca fura o modo
 *    silencioso nem interrompe a música de outro app.
 *  - **Quem decide se toca é quem chama** (`ligado` = som ligado e Modo
 *    discreto desligado). Este módulo não lê preferência.
 */

export type NomeSom =
  | "plim"
  | "tick"
  | "pop"
  | "check"
  | "stamp"
  | "stage"
  | "swish";

type CtorAudio = new () => AudioContext;

interface Motor {
  ac: AudioContext;
  master: GainNode;
  ruido: AudioBuffer | null;
}

let motor: Motor | null = null;
let ctorDeTeste: CtorAudio | null | undefined;
let ultimoTick = 0;

function ctorAudio(): CtorAudio | null {
  if (ctorDeTeste !== undefined) return ctorDeTeste;
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: CtorAudio;
    webkitAudioContext?: CtorAudio;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** iPhone: categoria que obedece a chave do silencioso (Safari 16.4+). */
function sessaoAmbiente(): void {
  try {
    const nav = (typeof navigator !== "undefined"
      ? navigator
      : undefined) as unknown as
      | { audioSession?: { type: string } }
      | undefined;
    if (nav?.audioSession) nav.audioSession.type = "ambient";
  } catch {
    /* sem audioSession: segue o comportamento padrão do navegador */
  }
}

function obterMotor(): Motor | null {
  try {
    if (!motor) {
      const C = ctorAudio();
      if (!C) return null;
      sessaoAmbiente();
      const ac = new C();
      const master = ac.createGain();
      master.gain.value = 0.6;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ac.destination);
      motor = { ac, master, ruido: null };
    }
    if (motor.ac.state === "suspended") {
      // Bloqueado até o primeiro toque: tenta, sem esperar nem falhar.
      void motor.ac.resume().catch(() => undefined);
    }
    return motor;
  } catch {
    return null;
  }
}

/**
 * Chame num gesto da usuária (toque) pra liberar o áudio: os navegadores
 * só deixam tocar depois de uma interação. O host da comemoração faz isso
 * sozinho no primeiro `pointerdown`.
 */
export function liberarAudio(): void {
  obterMotor();
}

interface OpTom {
  type?: OscillatorType;
  glide?: number;
  gdur?: number;
  gain?: number;
  att?: number;
}

function tom(m: Motor, f: number, t0: number, dur: number, o: OpTom = {}) {
  const osc = m.ac.createOscillator();
  const g = m.ac.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(f, t0);
  if (o.glide)
    osc.frequency.exponentialRampToValueAtTime(o.glide, t0 + (o.gdur ?? dur));
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + (o.att ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(m.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

interface OpRuido {
  f?: number;
  to?: number;
  q?: number;
  gain?: number;
  att?: number;
}

function ruido(m: Motor, t0: number, dur: number, o: OpRuido = {}) {
  if (!m.ruido) {
    const buf = m.ac.createBuffer(1, m.ac.sampleRate * 2, m.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    m.ruido = buf;
  }
  const s = m.ac.createBufferSource();
  const f = m.ac.createBiquadFilter();
  const g = m.ac.createGain();
  s.buffer = m.ruido;
  f.type = "bandpass";
  f.Q.value = o.q ?? 1.2;
  f.frequency.setValueAtTime(o.f ?? 1000, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.15, t0 + (o.att ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f);
  f.connect(g);
  g.connect(m.master);
  s.start(t0);
  s.stop(t0 + dur + 0.05);
}

const DO_MAIOR = [523.25, 659.25, 783.99];

/** Os efeitos do protótipo, iguais (frequências, tempos e ganhos). */
const EFEITOS: Record<NomeSom, (m: Motor, t: number) => void> = {
  plim(m, t) {
    tom(m, 1318.5, t, 0.32, { gain: 0.2 });
    tom(m, 1975.5, t + 0.075, 0.55, { gain: 0.17 });
    tom(m, 2637, t + 0.075, 0.3, { type: "triangle", gain: 0.035 });
  },
  tick(m, t) {
    tom(m, 2400, t, 0.035, { type: "triangle", gain: 0.025 });
  },
  pop(m, t) {
    tom(m, 520, t, 0.14, { glide: 980, gdur: 0.08, gain: 0.22 });
    tom(m, 1560, t + 0.06, 0.25, { gain: 0.06 });
  },
  check(m, t) {
    tom(m, 880, t, 0.09, { gain: 0.05 });
  },
  stamp(m, t) {
    tom(m, 150, t, 0.3, { glide: 55, gdur: 0.25, gain: 0.55 });
    ruido(m, t, 0.09, { f: 700, q: 0.8, gain: 0.3 });
    DO_MAIOR.forEach((f, i) => {
      tom(m, f, t + 0.05 + i * 0.03, 1.3, { gain: 0.08 });
      tom(m, f * 2, t + 0.05 + i * 0.03, 0.9, {
        type: "triangle",
        gain: 0.025,
      });
    });
    tom(m, 2093, t + 0.28, 0.5, { gain: 0.05 });
    tom(m, 2637, t + 0.38, 0.6, { gain: 0.045 });
    tom(m, 3136, t + 0.48, 0.7, { gain: 0.04 });
  },
  stage(m, t) {
    ruido(m, t, 1.15, { f: 300, to: 4000, q: 0.9, gain: 0.12, att: 0.9 });
    tom(m, 220, t + 0.1, 1.05, {
      glide: 880,
      gdur: 1.05,
      type: "triangle",
      gain: 0.05,
      att: 0.8,
    });
    const b = t + 1.12;
    tom(m, 110, b, 0.5, { glide: 45, gdur: 0.4, gain: 0.5 });
    ruido(m, b, 0.2, { f: 2500, q: 0.6, gain: 0.18 });
    [...DO_MAIOR, 1046.5].forEach((f, i) =>
      tom(m, f, b + i * 0.09, 0.45, { type: "triangle", gain: 0.13 })
    );
    [...DO_MAIOR, 1046.5, 1318.5].forEach((f) => {
      tom(m, f, b + 0.4, 2.2, { gain: 0.06, att: 0.05 });
      tom(m, f / 2, b + 0.4, 2.2, { type: "triangle", gain: 0.02, att: 0.05 });
    });
    for (let k = 0; k < 9; k++)
      tom(m, 2000 + Math.random() * 2400, b + 0.5 + k * 0.11, 0.25, {
        gain: 0.03,
      });
  },
  swish(m, t) {
    ruido(m, t, 0.25, { f: 1500, to: 5000, q: 0.7, gain: 0.06, att: 0.08 });
  },
};

/**
 * Toca um efeito. Devolve `true` se agendou o som, `false` se não tocou
 * (desligado, sem Web Audio, bloqueado ou erro) -- nunca lança.
 */
export function tocarSom(
  nome: NomeSom,
  opcoes: { ligado: boolean; atrasoSeg?: number }
): boolean {
  if (!opcoes.ligado) return false;
  try {
    if (nome === "tick") {
      const agora = Date.now();
      if (agora - ultimoTick < 55) return false;
      ultimoTick = agora;
    }
    const m = obterMotor();
    if (!m || m.ac.state !== "running") return false;
    EFEITOS[nome](m, m.ac.currentTime + 0.01 + (opcoes.atrasoSeg ?? 0));
    return true;
  } catch {
    return false;
  }
}

/** Vibração curta do protótipo (`buzz`). Nunca lança. */
export function vibrar(padrao: number | number[], ligado: boolean): void {
  if (!ligado) return;
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate)
      navigator.vibrate(padrao);
  } catch {
    /* sem vibração: nada a fazer */
  }
}

/** Só testes: troca o construtor do AudioContext (null = sem Web Audio). */
export function _usarAudioParaTeste(ctor: CtorAudio | null | undefined): void {
  ctorDeTeste = ctor;
  motor = null;
  ultimoTick = 0;
}
