"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  economia,
  formatarEuro,
  percentualDesconto,
  precoPorMes,
  type Plano,
} from "@/lib/planos";
import {
  cenarioDaCobranca,
  formatarDDMM,
  inicioDaCobranca,
  nomeDoPeriodo,
  renovaEm,
  type CenarioDaCobranca,
} from "@/lib/pagamento/regras";
import {
  motivoDaRecusa,
  pagamentoAtual,
  type ErroDoStripeJs,
  type InicioDoPagamento,
  type StripeElements,
  type StripeJs,
} from "@/lib/pagamento/cliente";
import { aparenciaDoApp, FONTES_DO_STRIPE } from "@/lib/pagamento/aparencia";
import styles from "./pagamento.module.css";

/**
 * Pagamento "C Transparente" (desenho aprovado, variante A): o Stripe
 * embutido no app (Payment Element). Chega aqui pelo `onEscolherPlano` do
 * onboarding, com o plano marcado.
 *
 *  - Tela 2, Pagamento: o resumo do plano em euro, o aviso do teste (quem
 *    assina com o teste correndo não paga hoje: "Seu teste continua até
 *    DD/MM; a primeira cobrança é nessa data") e o formulário do Stripe.
 *    Sem teste grátis na tela, sem Pix (só cartão). O cartão vai direto do
 *    aparelho para o Stripe: o JobApp não vê nem guarda.
 *  - Tela 3, Confirmação; tela 4, Erro (a mensagem do Stripe, traduzida).
 *
 * Sem a chave do Stripe (o operador ainda não tem): o bloco do Stripe vira
 * "pagamento ainda não disponível" e o botão fica desativado; nada quebra.
 * Quem muda `assinatura_status` é o webhook do Stripe, no servidor.
 */

const ICONE = {
  voltar: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  cadeado: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  info: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </svg>
  ),
  brilho: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
    </svg>
  ),
  x: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  escudo: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
};

type Tela = "pagamento" | "confirmado" | "erro";
type EstadoDoStripe = "carregando" | "pronto" | "indisponivel" | "falhou";

interface Props {
  plano: Plano;
  /** Para buscar o teste da conta (configuracoes). */
  userId: string;
  /** Primeiro nome: "Tudo certo, Miguel!". */
  nome: string;
  /** Volta à escolha do plano. */
  onVoltar: () => void;
  /** Volta para o app (confirmado, ou "Agora não" no erro). */
  onConcluir: () => void;
  /** Laboratório: o cenário da cobrança sem ler o banco. */
  cenarioForcado?: CenarioDaCobranca;
}

export function PagamentoTela({
  plano,
  userId,
  nome,
  onVoltar,
  onConcluir,
  cenarioForcado,
}: Props) {
  const [cenario, setCenario] = useState<CenarioDaCobranca | null>(
    cenarioForcado ?? null
  );
  const [tela, setTela] = useState<Tela>("pagamento");
  const [estado, setEstado] = useState<EstadoDoStripe>("carregando");
  const [falha, setFalha] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [erro, setErro] = useState<ErroDoStripeJs | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const alvoRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<{
    stripe: StripeJs;
    elements: StripeElements;
    inicio: InicioDoPagamento;
  } | null>(null);

  // O teste da conta, para o resumo e o aviso (o servidor confere de novo
  // ao criar a assinatura; não confia no aparelho).
  useEffect(() => {
    if (cenarioForcado) {
      setCenario(cenarioForcado);
      return;
    }
    let vivo = true;
    supabase
      .from("configuracoes")
      .select("trial_started_at")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (vivo) setCenario(cenarioDaCobranca(data?.trial_started_at));
      });
    return () => {
      vivo = false;
    };
  }, [userId, cenarioForcado]);

  // O Stripe: sem chave, "indisponível"; com chave, cria a assinatura no
  // servidor e monta o Payment Element com as cores do app.
  useEffect(() => {
    if (!cenario) return;
    const adaptador = pagamentoAtual();
    const chave = adaptador.chave();
    if (!chave) {
      setEstado("indisponivel");
      return;
    }
    let vivo = true;
    let desmontar: (() => void) | null = null;
    void (async () => {
      const r = await adaptador.iniciar(plano);
      if (!vivo) return;
      if (!r.ok) {
        setEstado(r.indisponivel ? "indisponivel" : "falhou");
        setFalha(r.erro);
        return;
      }
      try {
        const stripe = await adaptador.carregarStripe(chave);
        if (!vivo || !raizRef.current || !alvoRef.current) return;
        const escuro =
          document.documentElement.getAttribute("data-mode") !== "light";
        const elements = stripe.elements({
          clientSecret: r.inicio.clientSecret,
          appearance: aparenciaDoApp(raizRef.current, escuro),
          fonts: FONTES_DO_STRIPE,
          locale: "pt-BR",
        });
        const pe = elements.create("payment", {
          layout: "tabs",
          paymentMethodOrder: ["card"],
        });
        pe.on("ready", () => vivo && setEstado("pronto"));
        pe.mount(alvoRef.current);
        stripeRef.current = { stripe, elements, inicio: r.inicio };
        desmontar = () => pe.destroy();
      } catch {
        if (vivo) {
          setEstado("falhou");
          setFalha("Não foi possível abrir o pagamento agora.");
        }
      }
    })();
    return () => {
      vivo = false;
      desmontar?.();
      stripeRef.current = null;
    };
  }, [cenario, plano]);

  async function pagar() {
    const s = stripeRef.current;
    if (!s || estado !== "pronto" || pagando) return;
    setPagando(true);
    const opcoes = {
      elements: s.elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/?pagamento=retorno`,
      },
    };
    const r =
      s.inicio.tipo === "setup"
        ? await s.stripe.confirmSetup(opcoes)
        : await s.stripe.confirmPayment(opcoes);
    setPagando(false);
    if (r.error) {
      // Campo incompleto ou inválido: o próprio Stripe mostra no formulário.
      if (r.error.type === "validation_error") return;
      setErro(r.error);
      setTela("erro");
      return;
    }
    setTela("confirmado");
  }

  const fimDoTeste = cenario?.tipo === "fimDoTeste";
  const inicio = cenario ? inicioDaCobranca(cenario) : new Date();
  const renova = renovaEm(inicio, plano.meses);
  const periodo = nomeDoPeriodo(plano.meses);
  const aviso = fimDoTeste ? (
    <div className={styles.notice} data-aviso-teste>
      {ICONE.info}
      <span>
        Seu teste continua até <b>{formatarDDMM(inicio)}</b>; a primeira
        cobrança é nessa data.
      </span>
    </div>
  ) : null;

  return (
    <div
      ref={raizRef}
      className={styles.ob}
      role="dialog"
      aria-modal="true"
      aria-label="Pagamento"
      data-pagamento={tela}
      data-stripe={estado}
    >
      {/* ── Tela 2: Pagamento ── */}
      <div className={styles.screen} hidden={tela !== "pagamento"}>
        <div className={styles.top}>
          <button type="button" className={styles.back} onClick={onVoltar}>
            {ICONE.voltar}Voltar
          </button>
          <span />
        </div>
        <div className={`${styles.coluna} ${styles.entra}`}>
          <h3 className={styles.titulo}>Pagamento</h3>
          {aviso}
          <div className={styles.sum} data-resumo>
            <div className={styles.linha}>
              <span>Plano de {periodo}</span>
              <span>
                {plano.cheio != null && (
                  <>
                    <span className={styles.strike}>
                      {formatarEuro(plano.cheio)}
                    </span>{" "}
                  </>
                )}
                {formatarEuro(plano.preco)}
              </span>
            </div>
            {plano.cheio != null && (
              <div className={styles.linha}>
                <span>Desconto ({percentualDesconto(plano)}%)</span>
                <span className={styles.save}>
                  − {formatarEuro(economia(plano))}
                </span>
              </div>
            )}
            <div className={styles.linha}>
              <span>Equivale a</span>
              <span>{formatarEuro(precoPorMes(plano))}/mês</span>
            </div>
            <div className={`${styles.linha} ${styles.total}`}>
              <span>{fimDoTeste ? "Hoje" : "Total hoje"}</span>
              <span>{formatarEuro(fimDoTeste ? 0 : plano.preco)}</span>
            </div>
            {fimDoTeste && (
              <div className={styles.linha}>
                <span>Em {formatarDDMM(inicio)}</span>
                <span>{formatarEuro(plano.preco)}</span>
              </div>
            )}
            <div className={`${styles.linha} ${styles.mut}`}>
              <span>Renova em {formatarDDMM(renova)}</span>
              <span>{formatarEuro(plano.preco)}</span>
            </div>
          </div>

          <div className={styles.stripeBloco} data-bloco-stripe>
            <div className={styles.stripeHead}>
              <span>{ICONE.cadeado} Pagamento seguro por Stripe</span>
              <span className={styles.moeda}>€ · EUR</span>
            </div>
            {estado === "indisponivel" ? (
              <p className={styles.indisponivel} data-indisponivel>
                <b>Pagamento ainda não disponível</b>
                Assim que estiver, você assina por aqui. Nada foi cobrado, e o
                app continua funcionando.
              </p>
            ) : estado === "falhou" ? (
              <p className={styles.indisponivel} data-falhou>
                <b>Não deu para abrir o pagamento</b>
                {falha ?? "Tente de novo em instantes."}
              </p>
            ) : (
              <>
                {estado === "carregando" && (
                  <div className={styles.carregando}>Carregando…</div>
                )}
                {/* O Payment Element (iframe do Stripe) é montado aqui. */}
                <div
                  ref={alvoRef}
                  data-payment-element
                  hidden={estado === "carregando"}
                />
              </>
            )}
            <div className={styles.powered}>
              Os dados do cartão vão direto para o Stripe; o JobApp não vê nem
              guarda.
            </div>
          </div>

          <div className={styles.push}>
            <button
              type="button"
              className={styles.cta}
              onClick={() => void pagar()}
              disabled={estado !== "pronto" || pagando}
              data-pagar
            >
              {pagando ? (
                <>
                  <span className={styles.spinner} /> Confirmando…
                </>
              ) : estado === "indisponivel" ? (
                "Pagamento em breve"
              ) : fimDoTeste ? (
                `Assinar · cobrança em ${formatarDDMM(inicio)}`
              ) : (
                `Pagar ${formatarEuro(plano.preco)}`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tela 3: Confirmação ── */}
      {tela === "confirmado" && (
        <div className={styles.screen}>
          <div className={`${styles.win} ${styles.entra}`} data-confirmado>
            <div className={styles.medal}>{ICONE.brilho}</div>
            <h3>Tudo certo, {nome}!</h3>
            <p>
              {fimDoTeste
                ? `Seu plano de ${periodo} começa em ${formatarDDMM(inicio)}, no fim do seu teste. Até lá, nada muda.`
                : `Seu plano de ${periodo} está ativo. Tudo continua como você deixou.`}
            </p>
            <p style={{ fontSize: 12, marginTop: 14 }}>
              {fimDoTeste
                ? `Primeira cobrança em ${formatarDDMM(inicio)}: ${formatarEuro(plano.preco)} · depois a cada ${periodo}.`
                : `O Stripe enviou o recibo para o seu e-mail · próxima cobrança em ${formatarDDMM(renova)}: ${formatarEuro(plano.preco)}`}
            </p>
            <div className={styles.pushWin}>
              <button
                type="button"
                className={styles.cta}
                onClick={onConcluir}
                data-voltar-app
              >
                Voltar para o app
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tela 4: Erro ── */}
      {tela === "erro" && (
        <div className={styles.screen}>
          <div className={styles.top}>
            <button
              type="button"
              className={styles.back}
              onClick={() => setTela("pagamento")}
            >
              {ICONE.voltar}Voltar
            </button>
            <span />
          </div>
          <div className={`${styles.coluna} ${styles.entra}`} data-erro>
            <div className={styles.errIc}>{ICONE.x}</div>
            <h3 className={`${styles.titulo} ${styles.centro}`}>
              O pagamento não foi aprovado
            </h3>
            <p className={`${styles.lead} ${styles.centro}`}>
              O banco recusou o cartão
              {erro?.payment_method?.card?.last4
                ? ` terminado em ${erro.payment_method.card.last4}`
                : ""}
              : <b style={{ color: "var(--t-ink)" }}>{motivoDaRecusa(erro)}</b>.
              Nada foi cobrado.
            </p>
            <div className={styles.stripeMsg}>
              Mensagem do Stripe, traduzida:{" "}
              <b>
                &quot;{erro?.message ?? "O pagamento não foi aprovado."}&quot;
              </b>
              {erro?.code && (
                <>
                  {" "}
                  (código <code>{erro.code}</code>
                  {erro.decline_code && (
                    <>
                      {" "}
                      · <code>{erro.decline_code}</code>
                    </>
                  )}
                  )
                </>
              )}
            </div>
            <div className={styles.safe}>
              {ICONE.escudo}
              <span>
                {fimDoTeste
                  ? `Seu teste continua normalmente até ${formatarDDMM(inicio)}.`
                  : "Seus dados continuam guardados. Pode tentar de novo agora ou depois."}
              </span>
            </div>
            <div className={styles.push}>
              <button
                type="button"
                className={styles.cta}
                onClick={() => setTela("pagamento")}
                data-tentar-de-novo
              >
                Tentar de novo
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => setTela("pagamento")}
              >
                Usar outro cartão
              </button>
              <button
                type="button"
                className={styles.link}
                onClick={onConcluir}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
