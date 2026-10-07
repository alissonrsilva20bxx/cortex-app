import { useMemo } from "react";
import { AvatarAjustes, BotaoNovo } from "@/components/ui/cabecalho";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario;
  /** Redesign iOS quase nativo (wayfinder #122, ticket #124): Ajustes saiu
   * da BottomNav — o avatar da Início é agora o único ponto de acesso. */
  onOpenAjustes: () => void;
  /** Foto do perfil da Rede, quando houver: o Início mostra a mesma. */
  fotoUrl?: string | null;
  /** Botão "Novo" do cabeçalho (Jornada J02): abre o mesmo formulário de
   * atendimento que o "+" da Início abre. */
  onNovo: () => void;
}

function getFirstName(nome: string): string {
  return nome.split(" ")[0];
}

function getFormattedDate(): string {
  const raw = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // Achado da revisão visual #131: a classe utilitária de capitalize
  // (CSS text-transform) maiusculiza CADA palavra -- "Quarta-Feira, 23 De
  // Setembro", incluindo a preposição "de". pt-BR natural só maiusculiza
  // a primeira letra da frase (protótipo aprovado, /dev-preview/ios:
  // "Quinta-feira, 10 de setembro") -- feito no conteúdo, não via CSS,
  // pra também ficar certo se o texto for copiado/lido por leitor de tela.
  // Jornada J02: o mockup usa o dia da semana curto ("Quarta, 23 de
  // setembro"), sem o "-feira" que o pt-BR por extenso traz.
  const curto = raw.replace("-feira", "");
  return curto.charAt(0).toUpperCase() + curto.slice(1);
}

/**
 * Cabeçalho da Início no visual novo (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`, tela Início): avatar à esquerda,
 * "Olá, <nome>" com a data por extenso embaixo, e o botão "Novo" à
 * direita. Substitui a escala de saudação grande do protótipo iOS
 * (#122/#142) -- o mockup aprovado da Jornada usa um cabeçalho compacto.
 * O avatar continua sendo o único acesso a Ajustes (#122/#124).
 */
export function GreetingHeader({
  usuario,
  onOpenAjustes,
  fotoUrl,
  onNovo,
}: Props) {
  // Foto da Rede tem prioridade; sem ela, a da conta (Google).
  const foto = fotoUrl || usuario.avatarUrl;
  const date = useMemo(getFormattedDate, []);
  const firstName = getFirstName(usuario.nome);

  // Valores do mockup normativo (tela Início): avatar 42px `--t-soft`,
  // título 17px/800, data 12px `--t-mut`, "Novo" 38px em `--t-acc`.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {/* Avatar -- dado real (foto/inicial), 42px como o mockup, toque de
          44px (components/ui/cabecalho.tsx). */}
      <AvatarAjustes
        inicial={firstName.charAt(0).toUpperCase()}
        foto={foto}
        onClick={onOpenAjustes}
        aria-label="Abrir Ajustes"
        data-tour="home-ajustes"
      />

      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <h1
          className="truncate"
          style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}
        >
          Olá, {firstName}
        </h1>
        <div
          className="truncate"
          style={{ fontSize: "12px", color: "var(--t-mut)" }}
        >
          {date}
        </div>
      </div>

      <BotaoNovo onClick={onNovo}>Novo</BotaoNovo>
    </div>
  );
}
