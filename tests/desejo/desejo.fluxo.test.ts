import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient } from "../rede/support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../rede/support/testUsers";
import {
  atualizarWishlistItem,
  criarWishlistItem,
  excluirWishlistItem,
  listarWishlistItems,
} from "@/lib/rede/wishlist";
import { garantirPerfil } from "@/lib/rede/perfis";
import { guardarNoDesejo } from "@/lib/guardar/guardar";
import { desejoPrincipal, progressoDesejo } from "@/lib/desejo/desejo";
import { lerEstadoDoServidor } from "@/lib/jornada/servidor";

/**
 * Fluxo real do Desejo (quem escreve -> quem le), no Supabase local:
 * criar com prazo -> editar -> Guardar -> Jornada -> excluir. Precisa de
 * SUPABASE_TEST_URL (.env.test.local) e das migrations 0042 e 0044 aplicadas.
 * Usa o cliente da propria usuaria (a RPC da Jornada le auth.uid()).
 */

const FUSO = "America/Sao_Paulo";

describe("Desejo: fluxo de ponta a ponta no banco real", () => {
  const usuarios: TestUser[] = [];
  let membro: TestUser;
  let semConvite: TestUser;

  beforeAll(async () => {
    membro = await createTestUser();
    usuarios.push(membro);
    semConvite = await createTestUser();
    usuarios.push(semConvite);

    // Membro da Rede (convite usado), mas SEM rede_perfis: o app cria o
    // perfil em silencio antes de gravar o Desejo (garantirPerfil).
    const { error } = await (adminClient() as SupabaseClient)
      .from("rede_convites")
      .insert({
        codigo_hash: `desejo-fluxo-${membro.id}`,
        usado_por: membro.id,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 3_600_000).toISOString(),
      });
    if (error) throw new Error(`Falha ao criar convite: ${error.message}`);
  });

  afterAll(async () => {
    const r = await Promise.allSettled(usuarios.map(deleteTestUser));
    if (r.some((x) => x.status === "rejected")) {
      throw new Error("Falha ao remover usuarios de teste");
    }
  });

  it("fluxo completo: criar, editar, guardar, Jornada, segundo Desejo, excluir, afazeres intocados", async () => {
    const c = membro.client;

    // 6. Afazeres: 1 linha antes do fluxo.
    const { data: afazer, error: eAfazer } = await c
      .from("objetivos")
      .insert({
        user_id: membro.id,
        titulo: "Ligar pra Ana",
        categoria: "afazeres",
      })
      .select()
      .single();
    expect(eAfazer).toBeNull();

    // 1. Criar com prazo -> ler.
    await garantirPerfil(c, membro.id, "Teste Desejo");
    const a = await criarWishlistItem(c, {
      nome: "Cadeira",
      cor: "#FF7AB6",
      valorAlvo: 300,
      prazo: "2026-12-24",
    });
    let lista = await listarWishlistItems(c, membro.id);
    const lidoA = lista.find((i) => i.id === a.id)!;
    expect(lidoA.prazo).toBe("2026-12-24");
    expect(lidoA.valorAtual).toBe(0);
    expect(lidoA.criadoEm).toBeTruthy();

    // 2. Editar prazo e nome -> ler; o dinheiro nao muda.
    await atualizarWishlistItem(c, {
      itemId: a.id,
      nome: "Cadeira nova",
      valorAlvo: 300,
      estado: "quero",
      privacidade: "privado",
      prazo: null,
    });
    lista = await listarWishlistItems(c, membro.id);
    const editado = lista.find((i) => i.id === a.id)!;
    expect(editado.prazo).toBeNull();
    expect(editado.nome).toBe("Cadeira nova");
    expect(editado.valorAtual).toBe(0);

    // 3. Guardar -> todo mundo le o mesmo progresso (lista, regra pura, Jornada).
    const g = await guardarNoDesejo(c, {
      userId: membro.id,
      desejoId: a.id,
      texto: "120",
    });
    expect(g.ok).toBe(true);
    lista = await listarWishlistItems(c, membro.id);
    const guardado = lista.find((i) => i.id === a.id)!;
    expect(guardado.valorAtual).toBe(120);
    expect(progressoDesejo(guardado.valorAtual, guardado.valorAlvo)).toBe(40);
    let estado = await lerEstadoDoServidor(c, FUSO, 180);
    const principal = desejoPrincipal(lista)!;
    expect(estado.dinheiro?.meta?.nome).toBe(principal.nome);
    expect(estado.dinheiro?.meta?.atual).toBe(principal.valorAtual);
    expect(estado.dinheiro?.meta?.alvo).toBe(principal.valorAlvo);

    // 4. Dois Desejos: ao completar A, o principal vira B (tambem na Jornada).
    const b = await criarWishlistItem(c, {
      nome: "Maleta",
      cor: "#7AA7FF",
      valorAlvo: 500,
    });
    const g2 = await guardarNoDesejo(c, {
      userId: membro.id,
      desejoId: a.id,
      texto: "180",
    });
    expect(g2.ok).toBe(true);
    lista = await listarWishlistItems(c, membro.id);
    expect(desejoPrincipal(lista)?.id).toBe(b.id);
    estado = await lerEstadoDoServidor(c, FUSO, 180);
    expect(estado.dinheiro?.meta?.nome).toBe("Maleta");

    // 5. Excluir -> some, e o historico dele some junto (cascade).
    await excluirWishlistItem(c, { itemId: a.id });
    lista = await listarWishlistItems(c, membro.id);
    expect(lista.find((i) => i.id === a.id)).toBeUndefined();
    const { data: hist } = await (adminClient() as SupabaseClient)
      .from("guardar_historico")
      .select("id")
      .eq("desejo_id", a.id);
    expect(hist ?? []).toEqual([]);

    // 6. Afazeres intocados.
    const { data: depois } = await c
      .from("objetivos")
      .select("titulo,concluido")
      .eq("id", afazer!.id)
      .single();
    expect(depois).toEqual({ titulo: "Ligar pra Ana", concluido: false });
  });

  it("sem convite da Rede nao cria Desejo (documenta a decisao 2A)", async () => {
    const c = semConvite.client;
    let falhou = false;
    try {
      await garantirPerfil(c, semConvite.id, "Sem Convite");
      await criarWishlistItem(c, {
        nome: "Nao deveria",
        cor: "#FF7AB6",
        valorAlvo: 100,
      });
    } catch (e) {
      falhou = true;
      expect(["42501", "23503"]).toContain((e as { code?: string }).code);
    }
    expect(falhou).toBe(true);
    const { data } = await (adminClient() as SupabaseClient)
      .from("rede_wishlist_items")
      .select("id")
      .eq("user_id", semConvite.id);
    expect(data ?? []).toEqual([]);
  });
});
