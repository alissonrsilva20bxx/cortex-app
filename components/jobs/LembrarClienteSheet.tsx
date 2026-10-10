"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  cartaoAgendaSvg,
  dadosDoLembrete,
  linkWhatsApp,
  mensagemDoLembrete,
  nomeDoArquivo,
  type ModoCartao,
  type Profissional,
} from "@/lib/lembrete/cartaoAgenda";
import {
  baixarImagem,
  compartilharLembrete,
  svgParaPng,
} from "@/lib/lembrete/imagem";
import type { Job } from "@/lib/types";

interface Props {
  /** O agendamento a lembrar; `null` fecha a folha. */
  job: Job | null;
  profissional: Profissional;
  onClose: () => void;
}

/** O cartão segue o modo do app (claro/escuro). */
function modoDoApp(): ModoCartao {
  if (typeof document === "undefined") return "escuro";
  return document.documentElement.getAttribute("data-mode") === "light"
    ? "claro"
    : "escuro";
}

/**
 * "Lembrar cliente" (proposta 2, cartão de agenda). É opcional: criar o
 * agendamento não envia nada. Aqui ela vê o cartão e a mensagem e toca em
 * Compartilhar: a folha do celular abre com a imagem e o texto, e ela
 * escolhe o contato no WhatsApp. O app nunca envia sozinho.
 *
 * O cartão é refeito na hora a partir do agendamento atual: se ele mudar
 * (outro dia, outra hora, outro local), a prévia e a imagem mudam junto.
 */
export function LembrarClienteSheet({ job, profissional, onClose }: Props) {
  const [modo, setModo] = useState<ModoCartao>("escuro");
  const [png, setPng] = useState<Blob | null>(null);
  const [planoB, setPlanoB] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (job) setModo(modoDoApp());
    setPlanoB(false);
    setCopiado(false);
  }, [job]);

  const dados = useMemo(
    () => (job ? dadosDoLembrete(job, profissional) : null),
    [job, profissional]
  );
  const svg = useMemo(
    () => (dados ? cartaoAgendaSvg(dados, modo) : null),
    [dados, modo]
  );
  const texto = useMemo(
    () => (dados ? mensagemDoLembrete(dados) : ""),
    [dados]
  );

  // O PNG fica pronto ANTES do toque: o Safari do iPhone só abre a folha de
  // compartilhar dentro do próprio toque.
  useEffect(() => {
    setPng(null);
    if (!svg) return;
    let vivo = true;
    svgParaPng(svg)
      .then((b) => vivo && setPng(b))
      .catch(() => vivo && setPng(null));
    return () => {
      vivo = false;
    };
  }, [svg]);

  async function compartilhar() {
    if (!png || !dados) return;
    const r = await compartilharLembrete(png, nomeDoArquivo(dados), texto);
    if (r === "sem-suporte") {
      baixarImagem(png, nomeDoArquivo(dados));
      setPlanoB(true);
    }
  }

  async function copiarMensagem() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  const botao = {
    minHeight: "48px",
    borderRadius: "999px",
    fontWeight: 800,
    fontSize: "15px",
  } as const;

  return (
    <BottomSheet
      open={Boolean(job)}
      onClose={onClose}
      title="Lembrar cliente"
      largeCloseTarget
      footer={
        <div className="flex flex-col" style={{ gap: "8px" }}>
          <button
            type="button"
            onClick={() => void compartilhar()}
            disabled={!png}
            className="w-full active:opacity-80 disabled:opacity-50"
            style={{
              ...botao,
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            {png ? "Compartilhar" : "Preparando o cartão…"}
          </button>
          {planoB && (
            <div
              className="flex flex-col"
              style={{ gap: "8px" }}
              data-lembrete-plano-b
            >
              <p
                style={{
                  fontSize: "12.5px",
                  color: "var(--text-muted)",
                  lineHeight: 1.45,
                }}
              >
                Este aparelho não compartilha imagem direto. A imagem foi salva:
                abra o WhatsApp com a mensagem e anexe a imagem na conversa.
              </p>
              <a
                href={linkWhatsApp(texto)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full active:opacity-80"
                style={{
                  ...botao,
                  background: "var(--surface-sub)",
                  color: "var(--text)",
                }}
              >
                Abrir WhatsApp com a mensagem
              </a>
              <button
                type="button"
                onClick={() => void copiarMensagem()}
                className="w-full active:opacity-80"
                style={{ ...botao, color: "var(--text-muted)" }}
              >
                {copiado ? "Mensagem copiada" : "Copiar mensagem"}
              </button>
            </div>
          )}
        </div>
      }
    >
      {svg && dados && (
        <div
          className="flex flex-col"
          style={{ gap: "14px", padding: "4px 20px 12px" }}
        >
          {/* Prévia: a mesma imagem que vai no compartilhamento. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
            alt={`Cartão do agendamento de ${dados.cliente}`}
            data-lembrete-previa
            style={{
              width: "100%",
              maxWidth: "320px",
              aspectRatio: "600 / 750",
              alignSelf: "center",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px var(--card-border)",
            }}
          />
          <div
            style={{
              background: "var(--surface-sub)",
              borderRadius: "14px",
              padding: "12px 14px",
              fontSize: "13.5px",
              lineHeight: 1.5,
              whiteSpace: "pre-line",
              color: "var(--text)",
            }}
            data-lembrete-texto
          >
            {texto}
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              lineHeight: 1.45,
            }}
          >
            Nada é enviado sozinho: você escolhe o contato no WhatsApp.
          </p>
        </div>
      )}
    </BottomSheet>
  );
}
