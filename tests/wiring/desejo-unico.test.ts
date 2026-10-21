import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");

/**
 * Desejo e Objetivo sao um so: criar/editar em Financas, recarregar nas
 * outras telas (quem escreve avisa, quem le recarrega), tudo em euro.
 */
describe("DesejosCard (Financas > Metas) escreve de verdade e avisa", () => {
  const card = read("components/financeiro/DesejosCard.tsx");

  it('o "+ Novo" abre o DesejoForm vazio', () => {
    expect(card).toMatch(/onClick=\{abrirNovo\}/);
    expect(card).toMatch(
      /function abrirNovo\(\) \{\s*setEditando\(null\);\s*setFormAberto\(true\);/
    );
    expect(card).toContain("<DesejoForm");
    expect(card).toContain("open={formAberto}");
  });

  it("salvar cria/atualiza no banco, garante o perfil e avisa as outras telas", () => {
    expect(card).toContain("criarWishlistItem(supabase");
    expect(card).toContain("atualizarWishlistItem(supabase");
    expect(card).toContain("garantirPerfil(supabase");
    expect(card).toContain("excluirWishlistItem(supabase");
    expect(
      card.match(/avisarDesejosMudaram\(\)/g)?.length
    ).toBeGreaterThanOrEqual(2);
  });

  it("sem acesso a Rede mostra a explicacao e o botao para a Rede", () => {
    expect(card).toContain("T.semRedeTitulo");
    expect(card).toContain("onClick={onAbrirRede}");
  });

  it("o Desejo nunca e gravado direto em tela: so lib/ fala com a tabela", () => {
    for (const f of [
      "components/financeiro/DesejosCard.tsx",
      "components/home/DesejoCard.tsx",
      "components/rede/RedeTab.tsx",
      "app/page.tsx",
    ]) {
      expect(read(f)).not.toContain('from("rede_wishlist_items")');
    }
  });
});

describe("quem le Desejo recarrega quando alguem avisa", () => {
  it.each([
    "components/financeiro/GuardarCard.tsx",
    "components/financeiro/DesejosCard.tsx",
    "components/home/DesejoCard.tsx",
    "components/rede/RedeTab.tsx",
  ])("%s usa useAoMudarDesejos", (f) => {
    expect(read(f)).toContain("useAoMudarDesejos(");
  });

  it("o Guardar avisa depois de guardar", () => {
    expect(read("components/financeiro/GuardarCard.tsx")).toContain(
      "avisarDesejosMudaram()"
    );
  });

  it("a Rede reescreve o cache do perfil ao recarregar (nao mostra valor velho)", () => {
    const rede = read("components/rede/RedeTab.tsx");
    const i = rede.indexOf("useAoMudarDesejos(");
    expect(rede.slice(i, i + 700)).toContain("redeCache.escrever<PerfilCache>");
  });
});

describe("a Rede e vitrine: nao cria nem edita Desejo", () => {
  const rede = read("components/rede/RedeTab.tsx");
  const tela = read("components/rede/WishlistScreen.tsx");

  it("RedeTab nao importa o formulario nem grava Desejo", () => {
    expect(rede).not.toContain("WishlistForm");
    expect(rede).not.toContain("criarWishlistItem");
    expect(rede).not.toContain("atualizarWishlistItem");
    expect(rede).not.toContain("excluirWishlistItem");
  });

  it('o "+" da WishlistScreen leva a Financas (onAbrirDesejos)', () => {
    expect(tela).toContain("onClick={onAbrirDesejos}");
    expect(rede).toContain("onAbrirDesejos={() => onAbrirDesejos?.()}");
  });

  it("o toque no card abre Editar em Financas / Compartilhar", () => {
    expect(rede).toContain("TEXTOS_DESEJO.editarEmFinancas");
    expect(rede).toContain("TEXTOS_DESEJO.compartilhar");
    expect(rede).toContain("shareWishlistToFeed(wishlistAcoes)");
  });

  it("a pagina leva da Rede para Financas > Metas", () => {
    expect(read("app/page.tsx")).toMatch(
      /onAbrirDesejos=\{\(\) => \{\s*handleTabChange\("financeiro"\);\s*setFinanceiroFocusTab\("metas"\);/
    );
  });
});

describe("euro e textos em constantes", () => {
  it.each([
    "components/rede/WishlistCard.tsx",
    "components/home/DesejoCard.tsx",
    "components/financeiro/DesejosCard.tsx",
    "components/desejo/DesejoForm.tsx",
  ])("%s nao usa formatMoeda nem R$", (f) => {
    const src = read(f);
    expect(src).not.toContain("formatMoeda");
    expect(src).not.toContain("R$");
  });

  it("o progresso vem de progressoDesejo em todas as telas", () => {
    for (const f of [
      "components/rede/WishlistCard.tsx",
      "components/home/DesejoCard.tsx",
      "components/financeiro/GuardarCard.tsx",
      "components/rede/FeedScreen.tsx",
      "components/rede/RedeTab.tsx",
    ]) {
      expect(read(f), f).toContain("progressoDesejo(");
    }
  });

  it("o formulario nao edita o valor guardado", () => {
    const form = read("components/desejo/DesejoForm.tsx");
    expect(form).not.toContain("valorAtual:");
    expect(form).toContain("T.dicaGuardar");
    expect(read("lib/rede/wishlist.ts")).not.toMatch(
      /valor_atual: input\.valorAtual/
    );
  });

  it("os afazeres mantem a tabela objetivos e o nome vem de TEXTOS_AFAZERES", () => {
    const metas = read("components/financeiro/MetasTab.tsx");
    expect(metas).toContain('supabase.from("objetivos").insert(');
    expect(metas).toContain("TA.titulo");
    expect(metas).not.toContain("Objetivos de Vida");
  });
});

describe("Inicio mostra o Desejo e leva a Financas > Metas", () => {
  it("app/page.tsx renderiza DesejoCard com a chave de preferencia objetivos", () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(
      /\(homeCards\.objetivos \?\? true\) && \(\s*<DesejoCard/
    );
    expect(page).toMatch(
      /<DesejoCard[\s\S]*?onGoToMetas=\{\(\) => \{\s*handleTabChange\("financeiro"\);\s*setFinanceiroFocusTab\("metas"\);/
    );
    expect(page).not.toContain("<ObjetivosCard");
  });

  it("Ajustes chama o card de Desejo (a chave objetivos nao muda)", () => {
    const aj = read("components/ajustes/AjustesTab.tsx");
    expect(aj).toContain('key: "objetivos"');
    expect(aj).toContain("TEXTOS_DESEJO.ajustesRotulo");
  });
});
