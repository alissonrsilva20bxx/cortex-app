/**
 * A imagem do lembrete, feita no próprio celular: o SVG do cartão vira PNG
 * num <canvas> (sem servidor, sem Storage). Depois a folha de compartilhar
 * do sistema (navigator.share com o arquivo) — ela escolhe o contato; o app
 * nunca envia sozinho. Sem suporte a compartilhar arquivo, a imagem é
 * baixada e o texto vai pelo wa.me.
 */
import { ALTURA_CARTAO, LARGURA_CARTAO } from "./cartaoAgenda";

/** SVG (texto) → PNG (Blob), em `escala`× para ficar nítido no chat. */
export async function svgParaPng(svg: string, escala = 2): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  );
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, falha) => {
      img.onload = () => ok();
      img.onerror = () => falha(new Error("lembrete: svg ilegível"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = LARGURA_CARTAO * escala;
    canvas.height = ALTURA_CARTAO * escala;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("lembrete: sem canvas");
    ctx.scale(escala, escala);
    ctx.drawImage(img, 0, 0, LARGURA_CARTAO, ALTURA_CARTAO);
    return await new Promise<Blob>((ok, falha) =>
      canvas.toBlob(
        (b) => (b ? ok(b) : falha(new Error("lembrete: png vazio"))),
        "image/png"
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ResultadoCompartilhar =
  | "compartilhado"
  | "cancelado"
  | "sem-suporte";

type NavegadorComShare = Navigator & {
  canShare?: (dados: ShareData) => boolean;
};

/**
 * Abre a folha de compartilhar do celular com a imagem e o texto. Precisa
 * ser chamada direto no toque (o Safari do iPhone exige): por isso o PNG
 * chega pronto, gerado antes.
 */
export async function compartilharLembrete(
  png: Blob,
  nomeArquivo: string,
  texto: string,
  nav: NavegadorComShare = navigator
): Promise<ResultadoCompartilhar> {
  const arquivo = new File([png], nomeArquivo, { type: "image/png" });
  const dados: ShareData = { files: [arquivo], text: texto };
  if (typeof nav.share !== "function" || !nav.canShare?.(dados))
    return "sem-suporte";
  try {
    await nav.share(dados);
    return "compartilhado";
  } catch (e) {
    // Ela fechou a folha sem escolher ninguém: não é erro.
    if (e instanceof DOMException && e.name === "AbortError")
      return "cancelado";
    return "sem-suporte";
  }
}

/** Plano B: baixa a imagem (o texto vai pelo wa.me). */
export function baixarImagem(png: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(png);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
