/**
 * A lógica da comemoração (J13), pura e sem DOM -- o host só executa o que
 * sai daqui. Três decisões:
 *
 *  1. **Qual a próxima** (`proximaParaTocar`): a primeira da fila, NA ORDEM
 *     QUE O SERVIDOR MANDOU (pequena → selo → estágio → meta). O cliente não
 *     reordena nem junta. A única que é pulada é a `adiada` que chegou nesta
 *     abertura do app: ela veio do registro de atendimento e fica pra
 *     próxima abertura (spec, decisão 10). A fila persistente é a da J11;
 *     aqui nada é criado, só não é tocado ainda.
 *  2. **Como** (`planoDaComemoracao`): a intensidade "na medida" do
 *     protótipo aprovado, reduzida pelo Modo discreto e pelo
 *     `prefers-reduced-motion`.
 *  3. **Com que texto** (`textosDaComemoracao`): só o que está em
 *     `lib/jornada/textos.ts`. Nenhuma palavra visível nasce aqui.
 */

import type { Comemoracao } from "@/lib/jornada/estado";
import type { NomeSom } from "@/lib/jornada/som";
import {
  LIMITE_DO_DIA,
  ROTULO_ACAO,
  SELO,
  COMEMORACAO,
  TITULO_COMEMORACAO,
  subEstagio,
  glowGanho,
  nomeEnfeite,
  nomeEstagio,
  nomeSeloComNivel,
  textoMarco,
  tituloCapitulo,
} from "@/lib/jornada/textos";

// ───────────────────────────── 1. a próxima ─────────────────────────────

/**
 * A próxima comemoração que pode tocar agora, ou null.
 * `adiadasDaSessao` = ids das `adiada` que chegaram DEPOIS que esta
 * abertura do app começou (as que já estavam na fila ao abrir tocam).
 */
export function proximaParaTocar(
  fila: readonly Comemoracao[],
  adiadasDaSessao: ReadonlySet<string>
): Comemoracao | null {
  for (const c of fila) {
    if (c.adiada && adiadasDaSessao.has(c.id)) continue;
    return c;
  }
  return null;
}

/**
 * Atualiza o conjunto das adiadas desta sessão a partir da fila atual.
 * `vistasAoAbrir` = ids que já estavam na fila na primeira vez que o host a
 * viu nesta abertura: essas tocam, mesmo adiadas.
 */
export function adiadasNovas(
  fila: readonly Comemoracao[],
  vistasAoAbrir: ReadonlySet<string>,
  anteriores: ReadonlySet<string>
): Set<string> {
  const out = new Set(anteriores);
  for (const c of fila) {
    if (c.adiada && !vistasAoAbrir.has(c.id)) out.add(c.id);
  }
  return out;
}

// ───────────────────────────── 2. como ──────────────────────────────────

/**
 * `aviso`: a pílula no topo (toast). `selo`: o cartão da medalha.
 * `palco`: a tela cheia (anel, nome letra a letra, confete).
 */
export type Forma = "aviso" | "selo" | "palco";

export interface Ambiente {
  /** Preferência "Som da Jornada" (ligado por padrão). */
  somLigado: boolean;
  modoDiscreto: boolean;
  /** `prefers-reduced-motion: reduce`. */
  movimentoReduzido: boolean;
  /** "Comemorações: Calma" (0036): quieto como o protótipo (`quiet()`). */
  comemoracoesCalmas?: boolean;
}

export interface Plano {
  forma: Forma;
  /** null = sem som. */
  som: NomeSom | null;
  /** Atraso do som em segundos (o carimbo do selo cai em .3s). */
  atrasoSom: number;
  /** Partículas e confete. */
  efeitos: boolean;
  /** Animação de entrada (anel, carimbo, letras). Sem ela, mostra pronto. */
  animar: boolean;
  /** null = sem vibração. */
  vibracao: number | number[] | null;
  /** Aviso: quanto tempo fica na tela. */
  duracaoMs: number;
  /** Aviso: quando a fila pode seguir. Selo e palco seguem no toque. */
  seguirEmMs: number | null;
  /** Visual neutro (sem destaque de cor), como o "neutral" do protótipo. */
  neutro: boolean;
}

/**
 * A intensidade do protótipo (`small`, `medal`, `bigShow`), com as mesmas
 * regras de "quieto": Modo discreto OU movimento reduzido tiram as formas
 * grandes e os efeitos; o som cai pra o "plim" curto. O Modo discreto, além
 * disso, tira TODO som e vibração e deixa o aviso neutro -- "nada chamativo
 * aparece na tela".
 */
export function planoDaComemoracao(c: Comemoracao, amb: Ambiente): Plano {
  const discreto = amb.modoDiscreto;
  const quieto =
    discreto || amb.movimentoReduzido || amb.comemoracoesCalmas === true;
  const mudo = discreto || !amb.somLigado;
  const som = (n: NomeSom | null): NomeSom | null => (mudo ? null : n);
  const vibra = (p: number | number[]) => (discreto ? null : p);

  if (c.tipo === "pequena") {
    const rendeu = c.glow > 0 && c.ganhou;
    return {
      forma: "aviso",
      som: som(rendeu ? "plim" : "check"),
      atrasoSom: 0,
      efeitos: rendeu && !quieto,
      animar: !amb.movimentoReduzido,
      vibracao: rendeu ? vibra(12) : null,
      duracaoMs: rendeu ? 1900 : 2200,
      seguirEmMs: quieto ? 1150 : 1300,
      neutro: discreto || !rendeu,
    };
  }

  const grande = c.tipo === "estagio" || c.tipo === "meta";

  if (quieto && !(c.tipo === "estagio" && !discreto)) {
    // Protótipo: em modo quieto, selo/capítulo/marco/meta viram aviso +
    // "plim"; só o estágio mantém a tela (sem animação) fora do discreto.
    return {
      forma: "aviso",
      som: som("plim"),
      atrasoSom: 0,
      efeitos: false,
      animar: false,
      vibracao: null,
      duracaoMs: grande ? 2400 : 2300,
      seguirEmMs: 2000,
      neutro: discreto,
    };
  }

  if (grande) {
    return {
      forma: "palco",
      som: som(quieto ? "plim" : "stage"),
      atrasoSom: 0,
      efeitos: !quieto,
      animar: !quieto,
      vibracao: quieto ? null : vibra([30, 60, 30, 60, 90]),
      duracaoMs: 0,
      seguirEmMs: null,
      neutro: false,
    };
  }

  return {
    forma: "selo",
    som: som("stamp"),
    atrasoSom: 0.3,
    efeitos: true,
    animar: true,
    vibracao: vibra([18, 40, 26]),
    duracaoMs: 0,
    seguirEmMs: null,
    neutro: false,
  };
}

/** Linha do tempo do protótipo, em ms desde o início (bigShow / medal). */
export const TEMPOS = {
  /** medal: o carimbo entra. */
  seloCarimbo: 120,
  /** medal: tremida + partículas. */
  seloImpacto: 430,
  /** bigShow: o anel começa a encher. */
  palcoAnel: 120,
  /** bigShow: pico (nome, confete). */
  palcoPico: 1150,
  /** bigShow: linhas de baixo. */
  palcoDetalhes: 1750,
  /** bigShow: pode seguir. */
  palcoPronto: 2500,
  /** Depois de fechar uma forma grande, respiro antes da próxima. */
  respiro: 350,
} as const;

// ───────────────────────────── 3. com que texto ─────────────────────────

export interface TextosComemoracao {
  /** Linha pequena de cima (selo e palco). */
  chamada: string;
  /** O nome grande / título do aviso. */
  titulo: string;
  /** Linha de apoio (pode ser vazia). */
  apoio: string;
  /** O Glow ganho, já formatado ("+20 Glow"); vazio quando não há. */
  glow: string;
}

export function textosDaComemoracao(
  c: Comemoracao,
  discreto: boolean
): TextosComemoracao {
  const glow = c.glow > 0 && !discreto ? glowGanho(c.glow) : "";
  switch (c.tipo) {
    case "pequena": {
      const rotulo = c.acao ? ROTULO_ACAO[c.acao] : "";
      if (!c.ganhou) {
        return { chamada: "", titulo: rotulo, apoio: LIMITE_DO_DIA, glow: "" };
      }
      // Discreto: palavras neutras, sem "Glow" na tela.
      if (discreto || c.glow === 0) {
        return { chamada: "", titulo: rotulo, apoio: "", glow: "" };
      }
      return { chamada: "", titulo: glow, apoio: rotulo, glow };
    }
    case "selo": {
      const titulo = c.selo
        ? c.nivel && c.nivel > 1
          ? nomeSeloComNivel(c.selo, c.nivel)
          : SELO[c.selo].nome
        : "";
      return {
        // Protótipo: "Selo conquistado"; nos níveis II e III, "Selo nível N".
        chamada:
          (c.nivel ?? 1) > 1
            ? COMEMORACAO.seloNivel(c.nivel ?? 1)
            : TITULO_COMEMORACAO.selo,
        titulo,
        // A descrição de cada selo fala do nível I (como no protótipo):
        // nos níveis II e III ela não se aplica (#199).
        apoio:
          c.selo && !discreto && (c.nivel ?? 1) <= 1
            ? SELO[c.selo].descricao
            : "",
        glow,
      };
    }
    case "estagio": {
      const nivel = c.estagio ?? 0;
      return {
        // Depois da Icônica: "Novo nível de Icônica" (protótipo).
        chamada:
          nivel > ULTIMO_ESTAGIO_DA_TRILHA
            ? COMEMORACAO.novoNivelIconica
            : TITULO_COMEMORACAO.estagio,
        titulo: nomeEstagio(nivel),
        apoio: discreto ? "" : subEstagio(nivel),
        glow,
      };
    }
    case "capitulo":
      return {
        chamada: c.capitulo
          ? COMEMORACAO.capituloCompleto(c.capitulo.mes)
          : TITULO_COMEMORACAO.capitulo,
        titulo: c.capitulo
          ? nomeEnfeite(c.capitulo.mes)
          : TITULO_COMEMORACAO.capitulo,
        apoio:
          c.capitulo && !discreto
            ? COMEMORACAO.enfeiteNaColecao(c.capitulo.mes)
            : "",
        glow,
      };
    case "marco":
      return {
        chamada: TITULO_COMEMORACAO.marco,
        // Discreto: sem valor de dinheiro na tela.
        titulo:
          c.marco && !discreto ? textoMarco(c.marco) : TITULO_COMEMORACAO.marco,
        apoio: discreto ? "" : COMEMORACAO.marcoApoio,
        glow,
      };
    case "meta":
      // O nome e o valor da meta vêm do servidor (0036), como no protótipo:
      // "Fundo Viagem", "€ 300 guardados de verdade."
      return {
        chamada: TITULO_COMEMORACAO.meta,
        titulo: c.nome ?? "",
        apoio:
          c.valor !== undefined && !discreto
            ? COMEMORACAO.metaGuardada(c.valor)
            : "",
        glow,
      };
  }
}

/** Título curto do aviso de uma forma grande em modo quieto. */
export function tituloDoAviso(t: TextosComemoracao): string {
  return t.titulo || t.chamada;
}

/** O último degrau da trilha (Icônica); depois dele vêm os níveis. */
const ULTIMO_ESTAGIO_DA_TRILHA = 4;
