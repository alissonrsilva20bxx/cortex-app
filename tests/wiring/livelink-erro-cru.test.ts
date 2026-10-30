import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { criarLiveLink, LiveLinkInvalidoError } from "@/lib/rede/perfis";

/**
 * R21 (auditoria, erro e sem internet): salvar um LiveLink punha na tela
 * qualquer `e.message`, inclusive o erro cru do Supabase em inglês (sem
 * internet, banco recusou). Só o aviso da validação (em português, diz o que
 * corrigir) continua indo para a tela; o resto vira o texto genérico.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

describe("LiveLink: a mensagem crua do banco não vai para a tela", () => {
  it("a validação lança um erro próprio, que a tela sabe mostrar", async () => {
    await expect(
      criarLiveLink({} as never, {
        titulo: "Agenda",
        url: "http://exemplo.com",
        ordem: 0,
      })
    ).rejects.toBeInstanceOf(LiveLinkInvalidoError);
  });

  it("a Rede mostra só o aviso da validação; o resto vira texto genérico", () => {
    const src = ler("components/rede/RedeTab.tsx");
    expect(src).not.toMatch(
      /e instanceof Error \? e\.message : "Não foi possível salvar o LiveLink\."/
    );
    expect(src).toMatch(
      /e instanceof LiveLinkInvalidoError\s*\?\s*e\.message\s*:\s*"Não foi possível salvar o LiveLink\."/
    );
  });
});
