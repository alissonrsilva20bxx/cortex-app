/**
 * "Lembrar cliente" — o cartão de agenda (proposta 2 escolhida pelo
 * operador, /Desktop/lembrar-cliente.html) e a mensagem curta do WhatsApp.
 *
 * Tudo aqui é puro (sem DOM): recebe o agendamento e a profissional e
 * devolve o SVG do cartão e o texto. A imagem é renderizada no próprio
 * celular (components/jobs/LembrarClienteSheet.tsx); nada vai para
 * servidor, Storage ou terceiros, e o app nunca envia sozinho: ela escolhe
 * o contato na folha de compartilhar.
 *
 * O agendamento não guarda serviço nem duração, e a profissional pode não
 * ter telefone salvo: cada campo que falta some do cartão e da mensagem em
 * vez de aparecer vazio ou inventado.
 */
import { STATUS_META } from "@/components/jobs/status";
import { formatHora, localDoAtendimento } from "@/components/jobs/agendaSemana";
import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";

export interface Profissional {
  nome: string;
  telefone?: string | null;
}

export interface DadosLembrete {
  cliente: string;
  /** "Atendimento", "Atendimento online" ou o serviço, quando existir. */
  servico: string;
  /** "Sexta" (sem "-feira") — vai em maiúsculas no topo do calendário. */
  semana: string;
  dia: number;
  /** "outubro" */
  mes: string;
  /** "10/10" */
  data: string;
  /** "14h30" */
  hora: string;
  h: number;
  m: number;
  /** Duração em minutos; null = não informada (sem arco, sem "– fim"). */
  duracaoMin: number | null;
  /** "15h30", só com duração. */
  fim: string | null;
  local: string | null;
  profissional: string;
  telefone: string | null;
  valor: string;
  /** Rótulo de STATUS_META ("Confirmado", "Agendado"). */
  status: string;
  confirmado: boolean;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const dois = (n: number) => String(n).padStart(2, "0");
const limpo = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : null;
};

/** Junta o agendamento real e a profissional nos dados do cartão. */
export function dadosDoLembrete(
  job: Job,
  profissional: Profissional,
  extra: { servico?: string | null; duracaoMin?: number | null } = {}
): DadosLembrete {
  const [ano, mesN, diaN] = job.data.split("-").map(Number);
  const data = new Date(ano, (mesN || 1) - 1, diaN || 1);
  const [h, m] = job.hora.split(":").map((n) => Number(n) || 0);
  const dur =
    extra.duracaoMin && extra.duracaoMin > 0
      ? Math.round(extra.duracaoMin)
      : null;
  const fimMin = dur ? h * 60 + m + dur : null;
  return {
    cliente: limpo(job.clienteNome) ?? "Cliente",
    servico:
      limpo(extra.servico) ??
      (job.modalidade === "online" ? "Atendimento online" : "Atendimento"),
    semana: SEMANA[data.getDay()],
    dia: data.getDate(),
    mes: MESES[data.getMonth()],
    data: `${dois(data.getDate())}/${dois(data.getMonth() + 1)}`,
    hora: formatHora(`${dois(h)}:${dois(m)}`),
    h,
    m,
    duracaoMin: dur,
    fim:
      fimMin === null
        ? null
        : formatHora(
            `${dois(Math.floor(fimMin / 60) % 24)}:${dois(fimMin % 60)}`
          ),
    local: localDoAtendimento(job),
    profissional: limpo(profissional.nome) ?? "",
    telefone: limpo(profissional.telefone),
    valor: formatBRL(job.valor, 2),
    status: STATUS_META[job.status].label,
    confirmado: job.status === "confirmado",
  };
}

/** Só agendamentos que ainda vão acontecer pedem lembrete. */
export function podeLembrar(job: Job): boolean {
  return job.status === "agendado" || job.status === "confirmado";
}

/* ---------------- Mensagem do WhatsApp ---------------- */

/** A mensagem curta da proposta 2, só com os dados que existem. O local é
 * livre ("Studio Miguel", "Rua das Flores 120"), por isso "em" e não "na". */
export function mensagemDoLembrete(d: DadosLembrete): string {
  const quando = [
    d.semana.toLowerCase(),
    d.data,
    `às ${d.hora}${d.duracaoMin ? ` (${d.duracaoMin} min)` : ""}`,
  ].join(", ");
  const onde = d.local
    ? d.local === "Online"
      ? ", online"
      : `, em ${d.local}`
    : "";
  const abertura = d.confirmado
    ? "Seu horário está confirmado"
    : "Seu horário está marcado";
  const linhas = [
    `Olá, ${d.cliente}, tudo bem? ${abertura}: ${quando}${onde}.`,
    "Para remarcar ou cancelar, responda a esta mensagem com 24h de antecedência. Até lá!",
  ];
  if (d.profissional) linhas.push(d.profissional);
  return linhas.join("\n");
}

/** Link do WhatsApp só com o texto (ela escolhe o contato lá). */
export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

/* ---------------- O cartão (SVG 600×750) ---------------- */

export type ModoCartao = "claro" | "escuro";

/** As cores do cartão (as mesmas da proposta 2). */
export function coresDoCartao(modo: ModoCartao) {
  return modo === "escuro"
    ? {
        bg: "#141015",
        card: "#241c21",
        ink: "#f5eef2",
        mut: "#9a8f96",
        line: "#33282f",
        acc: "#ff2d78",
        deep: "#ff528f",
        ok: "#50dc78",
        okS: "#1d2e22",
        neutro: "#b9adb4",
        neutroS: "#2c2329",
      }
    : {
        bg: "#ffffff",
        card: "#f4f4f6",
        ink: "#111114",
        mut: "#6b6b74",
        line: "#e6e6ea",
        acc: "#ff2d78",
        deep: "#d6105c",
        ok: "#0f8a52",
        okS: "#e3f6ec",
        neutro: "#4a4a52",
        neutroS: "#ececf0",
      };
}

export const LARGURA_CARTAO = 600;
export const ALTURA_CARTAO = 750;
const FONT = `font-family="Plus Jakarta Sans, Segoe UI, Roboto, Helvetica, Arial, sans-serif"`;
export const POLITICA = "Remarcar ou cancelar: responda a esta mensagem.";
export const POLITICA_24H = "Pedimos aviso com 24h de antecedência.";

/** Escapa texto para dentro do SVG. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const corta = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

const IC = {
  pin: '<path d="M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const ic = (
  n: keyof typeof IC,
  x: number,
  y: number,
  s: number,
  cor: string,
  sw = 2
) =>
  `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="${cor}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</g>`;
const jIcon = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y})"><rect width="${s}" height="${s}" rx="${s * 0.24}" fill="#0a0007"/><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.34}" fill="#ff2d78" opacity=".16"/><text x="${s / 2}" y="${s * 0.74}" text-anchor="middle" ${FONT} font-weight="800" font-size="${s * 0.6}" fill="#ff2d78">J</text></g>`;

/** O cartão de agenda: data grande, relógio com o tempo do atendimento e o
 * resto em ordem embaixo (proposta 2). */
export function cartaoAgendaSvg(d: DadosLembrete, modo: ModoCartao): string {
  const t = coresDoCartao(modo);
  const cx = 434;
  const cy = 272;
  const R = 104;
  const pt = (a: number, r: number) => [
    cx + r * Math.sin((a * Math.PI) / 180),
    cy - r * Math.cos((a * Math.PI) / 180),
  ];
  const a0 = ((d.h % 12) + d.m / 60) * 30;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const [a, b] = pt(i * 30, R - 2);
    const [c, e] = pt(i * 30, R - (i % 3 ? 10 : 18));
    return `<line x1="${a}" y1="${b}" x2="${c}" y2="${e}" stroke="${t.mut}" stroke-width="${i % 3 ? 2 : 3.5}" stroke-linecap="round"/>`;
  }).join("");
  // O arco do tempo do atendimento só existe com duração.
  let arco = "";
  if (d.duracaoMin) {
    const a1 = a0 + (Math.min(d.duracaoMin, 690) / 60) * 30;
    const [x0, y0] = pt(a0, R - 10);
    const [x1, y1] = pt(a1, R - 10);
    arco = `<path data-arco="1" d="M${x0} ${y0} A${R - 10} ${R - 10} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}" fill="none" stroke="${t.acc}" stroke-width="12" stroke-linecap="round" opacity=".9"/>`;
  }
  const [hx, hy] = pt(a0, 54);
  const [mx, my] = pt(d.m * 6, 80);
  const pilula = d.confirmado
    ? { cor: t.ok, fundo: t.okS }
    : { cor: t.neutro, fundo: t.neutroS };
  const cabecalho = d.telefone
    ? `<text x="100" y="66" ${FONT} font-size="19" font-weight="800" fill="${t.ink}">${esc(corta(d.profissional, 22))}</text>
    <text x="100" y="86" ${FONT} font-size="14" font-weight="600" fill="${t.mut}" data-telefone="1">${esc(d.telefone)}</text>`
    : `<text x="100" y="75" ${FONT} font-size="19" font-weight="800" fill="${t.ink}">${esc(corta(d.profissional, 22))}</text>`;
  const horario = d.fim ? `${d.hora} – ${d.fim}` : d.hora;
  const local = d.local
    ? `${ic("pin", 48, 614, 22, t.deep)}<text x="80" y="632" ${FONT} font-size="19" font-weight="700" fill="${t.ink}">${esc(corta(d.local, 36))}</text>`
    : "";
  const corpo = `<rect width="600" height="750" fill="${t.bg}"/>
    ${jIcon(48, 48, 40)}
    ${cabecalho}
    <rect x="376" y="48" width="176" height="38" rx="19" fill="${pilula.fundo}"/>${d.confirmado ? ic("check", 390, 57, 20, pilula.cor, 2.6) : ic("clock", 390, 57, 20, pilula.cor, 2.4)}<text x="418" y="73" ${FONT} font-size="16" font-weight="800" fill="${pilula.cor}">${esc(d.status)}</text>
    <rect x="48" y="130" width="240" height="284" rx="26" fill="${t.card}"/>
    <path d="M48 156 a26 26 0 0 1 26 -26 h188 a26 26 0 0 1 26 26 v32 h-240 z" fill="${t.ink}"/>
    <text x="168" y="169" text-anchor="middle" ${FONT} font-size="17" font-weight="800" fill="${t.bg}" letter-spacing="5">${esc(d.semana.toUpperCase())}</text>
    <text x="168" y="334" text-anchor="middle" ${FONT} font-size="136" font-weight="800" fill="${t.ink}" letter-spacing="-6">${d.dia}</text>
    <text x="168" y="384" text-anchor="middle" ${FONT} font-size="19" font-weight="700" fill="${t.mut}" letter-spacing="3">${esc(d.mes.toUpperCase())}</text>
    <circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="${t.card}"/>
    ${ticks}
    ${arco}
    <line x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}" stroke="${t.ink}" stroke-width="7" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}" stroke="${t.ink}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="${t.acc}"/>
    <text x="48" y="482" ${FONT} font-size="44" font-weight="800" fill="${t.ink}" letter-spacing="-1">${esc(horario)}</text>
    ${d.duracaoMin ? `<text x="552" y="480" text-anchor="end" ${FONT} font-size="20" font-weight="700" fill="${t.mut}">${d.duracaoMin} min</text>` : ""}
    <line x1="48" y1="512" x2="552" y2="512" stroke="${t.line}" stroke-width="2"/>
    <text x="48" y="560" ${FONT} font-size="30" font-weight="800" fill="${t.ink}">${esc(corta(d.servico, 22))}</text>
    <text x="552" y="560" text-anchor="end" ${FONT} font-size="30" font-weight="800" fill="${t.ink}">${esc(d.valor)}</text>
    <text x="48" y="590" ${FONT} font-size="17" font-weight="600" fill="${t.mut}">para ${esc(corta(d.cliente, 40))}</text>
    ${local}
    <rect x="48" y="666" width="504" height="54" rx="14" fill="${t.card}"/>
    <text x="66" y="689" ${FONT} font-size="14" font-weight="700" fill="${t.ink}">${POLITICA}</text>
    <text x="66" y="708" ${FONT} font-size="14" font-weight="600" fill="${t.mut}">${POLITICA_24H}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA_CARTAO} ${ALTURA_CARTAO}" width="${LARGURA_CARTAO}" height="${ALTURA_CARTAO}">${corpo}</svg>`;
}

/** Nome do arquivo da imagem: "lembrete-carla-10-10.png". */
export function nomeDoArquivo(d: DadosLembrete): string {
  const base = d.cliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `lembrete-${base || "cliente"}-${d.data.replace("/", "-")}.png`;
}
