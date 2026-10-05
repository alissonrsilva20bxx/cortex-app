import { useMemo } from "react";
import { Plus } from "lucide-react";
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

  return (
    <div className="flex items-center gap-3">
      {/* Avatar -- dado real (foto/inicial). 44px: o mockup desenha 42px,
          mas o alvo de toque mínimo do app é 44×44. */}
      <button
        type="button"
        onClick={onOpenAjustes}
        aria-label="Abrir Ajustes"
        data-tour="home-ajustes"
        className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden transition-opacity active:opacity-70"
        style={{
          width: "44px",
          height: "44px",
          background: "var(--accent-tint)",
        }}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className="w-full h-full object-cover" />
        ) : (
          <span
            className="font-extrabold"
            style={{ fontSize: "16px", color: "var(--accent-deep)" }}
          >
            {firstName.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      <div className="min-w-0 flex-grow">
        <h1
          className="truncate font-extrabold"
          style={{ fontSize: "17px", lineHeight: 1.3, color: "var(--text)" }}
        >
          Olá, {firstName}
        </h1>
        <p
          className="truncate"
          style={{ fontSize: "12px", color: "var(--text-muted)" }}
        >
          {date}
        </p>
      </div>

      <button
        type="button"
        onClick={onNovo}
        data-fab-avoid
        className="flex items-center gap-1.5 shrink-0 rounded-full font-bold transition-opacity active:opacity-80"
        style={{
          minHeight: "44px",
          padding: "0 14px",
          fontSize: "13px",
          background: "var(--accent)",
          color: "#fff",
        }}
      >
        <Plus size={16} strokeWidth={2.6} aria-hidden="true" />
        Novo
      </button>
    </div>
  );
}
