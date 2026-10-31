import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  criarLiveLink,
  LIVELINK_TITULO_MAX_LENGTH,
  LIVELINK_URL_MAX_LENGTH,
} from "@/lib/rede/perfis";
import { TEXTOS_LIVELINK } from "@/lib/rede/textosLiveLink";

/**
 * R23 (achado B4 da R21rev): os avisos dos LiveLinks continuavam escritos
 * no código -- o erro de salvar em RedeTab.tsx, os três avisos da validação
 * em lib/rede/perfis.ts e os textos do formulário. Fere o padrão "texto
 * visível em constante" e deixa o nome "LiveLink" espalhado, que ainda pode
 * mudar. Agora tudo isso mora em lib/rede/textosLiveLink.ts.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

const perfis = ler("lib/rede/perfis.ts");
const redeTab = ler("components/rede/RedeTab.tsx");
const formulario = ler("components/rede/LiveLinkForm.tsx");
const secao = ler("components/rede/LiveLinksSection.tsx");

describe("LiveLink: o texto visível mora na constante", () => {
  it("os textos são os mesmos de antes", () => {
    expect(TEXTOS_LIVELINK.erroSalvar).toBe(
      "Não foi possível salvar o LiveLink."
    );
    expect(TEXTOS_LIVELINK.erroExcluir).toBe(
      "Não foi possível excluir o LiveLink."
    );
    expect(TEXTOS_LIVELINK.erroReordenar).toBe(
      "Não foi possível reordenar os LiveLinks."
    );
    expect(TEXTOS_LIVELINK.avisos.urlHttps).toBe(
      "URL do LiveLink deve ser uma URL HTTPS absoluta"
    );
    expect(TEXTOS_LIVELINK.avisos.tituloTamanho(100)).toBe(
      "Título do LiveLink deve ter entre 1 e 100 caracteres"
    );
    expect(TEXTOS_LIVELINK.avisos.urlTamanho(2048)).toBe(
      "URL do LiveLink deve ter entre 1 e 2048 caracteres"
    );
  });

  it("a validação lança o aviso da constante", async () => {
    await expect(
      criarLiveLink({} as never, {
        titulo: "Agenda",
        url: "http://exemplo.com",
        ordem: 0,
      })
    ).rejects.toThrow(TEXTOS_LIVELINK.avisos.urlHttps);

    await expect(
      criarLiveLink({} as never, {
        titulo: "",
        url: "https://exemplo.com",
        ordem: 0,
      })
    ).rejects.toThrow(
      TEXTOS_LIVELINK.avisos.tituloTamanho(LIVELINK_TITULO_MAX_LENGTH)
    );

    await expect(
      criarLiveLink({} as never, {
        titulo: "Agenda",
        url: `https://exemplo.com/${"a".repeat(LIVELINK_URL_MAX_LENGTH)}`,
        ordem: 0,
      })
    ).rejects.toThrow(
      TEXTOS_LIVELINK.avisos.urlTamanho(LIVELINK_URL_MAX_LENGTH)
    );
  });

  it("a validação em perfis.ts não tem mais o texto no código", () => {
    expect(perfis).toMatch(/TEXTOS_LIVELINK\.avisos\.tituloTamanho/);
    expect(perfis).toMatch(/TEXTOS_LIVELINK\.avisos\.urlTamanho/);
    expect(perfis).toMatch(/TEXTOS_LIVELINK\.avisos\.urlHttps/);
    expect(perfis).not.toMatch(/`Título do LiveLink|`URL do LiveLink/);
    expect(perfis).not.toMatch(/"URL do LiveLink deve ser/);
  });

  it("a Rede usa a constante e não o texto no código", () => {
    expect(redeTab).toMatch(/TEXTOS_LIVELINK\.erroSalvar/);
    expect(redeTab).toMatch(/TEXTOS_LIVELINK\.erroExcluir/);
    expect(redeTab).toMatch(/TEXTOS_LIVELINK\.erroReordenar/);
    expect(redeTab).not.toMatch(/"Não foi possível salvar o LiveLink\."/);
    expect(redeTab).not.toMatch(/"Não foi possível excluir o LiveLink\."/);
    expect(redeTab).not.toMatch(
      /"Não foi possível reordenar os LiveLinks\."/
    );
  });

  it("o formulário usa a constante", () => {
    expect(formulario).toMatch(/TEXTOS_LIVELINK\.form\./);
    expect(formulario).not.toMatch(/"Novo LiveLink"|"Adicionar LiveLink"/);
  });

  // R25: o botão de adicionar da lista (Meu espaço > Gerenciar LiveLinks)
  // também tinha o texto escrito no código, com a constante já pronta.
  it("o botão de adicionar da lista usa a constante", () => {
    expect(secao).toMatch(/TEXTOS_LIVELINK\.form\.botaoAdicionar/);
    expect(secao).not.toMatch(/"Adicionar LiveLink"/);
    expect(secao).not.toMatch(/^\s*Adicionar LiveLink\s*$/m);
  });
});
