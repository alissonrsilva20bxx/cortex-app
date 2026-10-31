import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * R23 (achado B1 da R21rev): com o teclado aberto o painel do BottomSheet
 * cabe em 90% da área que sobrou, mas quem não tem área de rolagem própria
 * (Publicar, LiveLink, Editar perfil, Upload do Cofre, reautenticação)
 * continuava com o fim do conteúdo atrás do teclado, sem rolagem.
 * Agora essas folhas pedem `scrollContent`: o conteúdo ganha área de rolagem
 * e o rodapé com o botão continua fixo. As folhas que já rolam por dentro
 * (Comentários, por exemplo) ficam sem a prop para não ter rolagem dupla.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

function htmlDoSheet(props: Record<string, unknown>): string {
  return renderToStaticMarkup(
    createElement(BottomSheet, {
      open: true,
      onClose: () => {},
      title: "Teste",
      ...props,
    } as never)
  );
}

const FOLHAS_ALTAS = [
  "components/rede/PostComposer.tsx",
  "components/rede/LiveLinkForm.tsx",
  "components/rede/ProfileEditForm.tsx",
  "components/cofre/UploadSheet.tsx",
  "components/pin/ReauthModal.tsx",
];

/** Quantas folhas o arquivo abre e quantas pedem a rolagem do conteúdo.
 * A conta por arquivo é o que pega a folha que PERDE a prop: um regex
 * solto (`/<BottomSheet[\s\S]*?scrollContent/`) também passa quando o
 * `scrollContent` é de outra folha do mesmo arquivo, ou quando só sobrou
 * a palavra num comentário. */
function folhasDoArquivo(src: string) {
  return {
    folhas: (src.match(/<BottomSheet\b/g) ?? []).length,
    rolagem: (src.match(/(?:^|\n)\s*scrollContent\b/g) ?? []).length,
  };
}

describe("BottomSheet: conteúdo alto rola por dentro da folha", () => {
  it("com scrollContent, o conteúdo ganha rolagem própria", () => {
    const html = htmlDoSheet({
      scrollContent: true,
      children: createElement("p", null, "conteudo"),
    });
    expect(html).toMatch(
      /<div class="overflow-y-auto flex-1"><p>conteudo<\/p><\/div>/
    );
  });

  it("sem scrollContent, o conteúdo entra direto (nada muda nas outras folhas)", () => {
    const html = htmlDoSheet({
      children: createElement("p", null, "conteudo"),
    });
    expect(html).toContain("<p>conteudo</p>");
    expect(html).not.toContain("overflow-y-auto flex-1");
  });

  it.each(FOLHAS_ALTAS)("%s pede a rolagem do conteúdo", (arquivo) => {
    const { folhas, rolagem } = folhasDoArquivo(ler(arquivo));
    // Cada folha do arquivo precisa pedir a rolagem: sem a prop, o fim do
    // conteúdo fica atrás do teclado (achado B1 da R21rev).
    expect(folhas).toBeGreaterThan(0);
    expect(rolagem).toBe(folhas);
  });
});
