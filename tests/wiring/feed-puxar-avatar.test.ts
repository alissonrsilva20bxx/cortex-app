import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fiação (não renderização): "puxar pra atualizar" no feed da Rede e foto
 * de perfil comprimida com prévia na hora (2026-10-01: "quando quero
 * atualizar feed, temos que puxar para baixo igual o Instagram" / "quando
 * adiciona foto de perfil demora para atualizar").
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8").replace(/\r\n/g, "\n");
}

const ptr = read("components/ui/PullToRefresh.tsx");
const feed = read("components/rede/FeedScreen.tsx");
const rede = read("components/rede/RedeTab.tsx");
const composer = read("lib/rede/imagemComposer.ts");

describe("PullToRefresh", () => {
  it("só engata no topo da página (a rolagem real é a do window)", () => {
    expect(ptr).toMatch(/window\.scrollY > 0/);
    expect(ptr).toMatch(/window\.scrollY <= 0/);
  });

  it("touchmove não é passivo (precisa de preventDefault enquanto puxa)", () => {
    expect(ptr).toMatch(
      /addEventListener\("touchmove", aoMover, \{ passive: false \}\)/
    );
  });

  it("nunca fica girando pra sempre: corre contra um timeout", () => {
    expect(ptr).toMatch(
      /Promise\.race\(\[onRefreshRef\.current\(\), timeout\]\)/
    );
  });

  it("parado, sem transform (não cria containing block pra filhos fixed)", () => {
    expect(ptr).toMatch(/transform: repouso \? undefined :/);
  });
});

describe("Feed da Rede usa o PullToRefresh", () => {
  it("FeedScreen envolve o conteúdo e repassa onRefresh", () => {
    expect(feed).toMatch(
      /import \{ PullToRefresh \} from "@\/components\/ui\/PullToRefresh"/
    );
    expect(feed).toMatch(/<PullToRefresh onRefresh=\{onRefresh\}>/);
    expect(feed).toMatch(/onRefresh: \(\) => Promise<void>;/);
  });

  it("RedeTab liga o gesto a uma chave nas deps do fetch do feed", () => {
    expect(rede).toMatch(/onRefresh=\{atualizarFeedPuxando\}/);
    expect(rede).toMatch(/setFeedReloadKey\(\(k\) => k \+ 1\)/);
    expect(rede).toMatch(/\}, \[usuario\.id, reconexaoKey, feedReloadKey\]\);/);
    // e revalida pedidos/notificações/conversas junto
    expect(rede).toMatch(
      /setFeedReloadKey\(\(k\) => k \+ 1\);[^}]*setSocialKey\(\(k\) => k \+ 1\);/
    );
  });
});

describe("Foto de perfil rápida", () => {
  it("comprime pra quadrado de 512px antes de subir", () => {
    expect(composer).toMatch(/export async function processarFotoParaAvatar\(/);
    expect(composer).toMatch(/AVATAR_LADO = 512/);
    expect(rede).toMatch(/await processarFotoParaAvatar\(file\)/);
  });

  it("mostra a prévia local na hora e usa em todo lugar que exibe a própria foto", () => {
    expect(rede).toMatch(/previa = URL\.createObjectURL\(envio\);/);
    expect(rede).toMatch(/setAvatarPrevia\(previa\);/);
    expect(rede).toMatch(
      /const fotoPropria = avatarPrevia \?\? perfil\?\.avatar_url \?\? null;/
    );
    expect((rede.match(/fotoPropria/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("libera a prévia (revokeObjectURL) quando termina", () => {
    expect(rede).toMatch(/URL\.revokeObjectURL\(/);
  });
});
