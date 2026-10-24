import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../lib/database.types";
import { createMockSupabaseClient } from "../../lib/mockSupabase";
import { faltaColuna, faltaTabela } from "../../lib/bancoSemMigracao";
import {
  guardarNoDesejo,
  listarHistoricoGuardar,
} from "../../lib/guardar/guardar";
import {
  atualizarWishlistItem,
  criarWishlistItem,
  listarWishlistItems,
} from "../../lib/rede/wishlist";
import { desejoPrincipal, progressoDesejo } from "../../lib/desejo/desejo";

/**
 * Bug C do ESTADO (19/10): a meta de dinheiro da Jornada ("Desejo atual",
 * 0036) lê `rede_wishlist_items.valor_atual`. Quem escreve nela é Finanças:
 * criar o Desejo (DesejosCard) e Guardar (GuardarCard). As duas escritas
 * usavam coisas das migrations 0042 (`prazo`) e 0044 (`guardar_historico`),
 * escritas e não aplicadas. Sem elas, criar, editar e guardar falhavam, e a
 * meta da Jornada nunca andava.
 *
 * Fluxo testado: quem escreve (as funções que os cards chamam) -> quem lê
 * (`listarWishlistItems` + `desejoPrincipal`, a mesma regra da "Meta atual"
 * da Jornada, que o Início e Finanças usam). O banco é o client em memória
 * do laboratório, respondendo como o PostgREST responde quando a tabela ou
 * a coluna não existe (PGRST205 / PGRST204). O lado do Postgres de verdade
 * está em tests/desejo/desejo-sem-migracoes-pglite.mjs.
 */

const USER = "u1";
const SEM_0042_E_0044 = {
  tabelas: ["guardar_historico"],
  colunas: { rede_wishlist_items: ["prazo"] },
};

function banco(ausentes?: typeof SEM_0042_E_0044) {
  const client = createMockSupabaseClient(
    { tables: {}, cofreFiles: [] },
    USER,
    { ausentes }
  );
  return client as unknown as SupabaseClient<Database>;
}

/** O que o Início, Finanças e a Jornada mostram como o Desejo principal. */
async function oQueQuemLeVe(client: SupabaseClient<Database>) {
  const principal = desejoPrincipal(await listarWishlistItems(client, USER));
  return principal
    ? {
        nome: principal.nome,
        atual: principal.valorAtual,
        pct: progressoDesejo(principal.valorAtual, principal.valorAlvo),
        prazo: principal.prazo,
      }
    : null;
}

afterEach(() => vi.restoreAllMocks());

describe("Desejo e Guardar sem as migrations 0042 e 0044 (banco de hoje)", () => {
  it("criar o Desejo, guardar e o progresso chega a quem lê", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = banco(SEM_0042_E_0044);

    const criado = await criarWishlistItem(client, {
      nome: "Cadeira",
      cor: "#FF7AB6",
      valorAlvo: 300,
      prazo: null,
    });
    expect(criado.valorAtual).toBe(0);

    const r = await guardarNoDesejo(client, {
      userId: USER,
      desejoId: criado.id,
      texto: "120",
    });
    expect(r).toEqual({ ok: true, valorAtual: 120 });

    expect(await oQueQuemLeVe(client)).toEqual({
      nome: "Cadeira",
      atual: 120,
      pct: 40,
      prazo: null,
    });

    // Um segundo Guardar soma em cima do primeiro.
    await guardarNoDesejo(client, {
      userId: USER,
      desejoId: criado.id,
      texto: "30,50",
    });
    expect((await oQueQuemLeVe(client))?.atual).toBe(150.5);
  });

  it("sem a tabela do histórico, a lista diz que não há histórico (null), não erro", async () => {
    const client = banco(SEM_0042_E_0044);
    expect(await listarHistoricoGuardar(client, USER)).toBeNull();
  });

  it("Desejo com prazo salva sem o prazo (a coluna ainda não existe)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = banco(SEM_0042_E_0044);
    const criado = await criarWishlistItem(client, {
      nome: "Viagem",
      cor: "#7AA7FF",
      valorAlvo: 800,
      prazo: "2026-12-24",
    });
    expect(criado.prazo).toBeNull();
    expect((await oQueQuemLeVe(client))?.nome).toBe("Viagem");
  });

  it("editar o Desejo funciona (o card sempre manda o prazo, mesmo vazio)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = banco(SEM_0042_E_0044);
    const criado = await criarWishlistItem(client, {
      nome: "Viagem",
      cor: "#7AA7FF",
      valorAlvo: 800,
    });
    const editado = await atualizarWishlistItem(client, {
      itemId: criado.id,
      nome: "Viagem a Paris",
      valorAlvo: 1000,
      estado: "quero",
      privacidade: "privado",
      prazo: null,
    });
    expect(editado.nome).toBe("Viagem a Paris");
    expect((await oQueQuemLeVe(client))?.nome).toBe("Viagem a Paris");
  });
});

describe("Desejo e Guardar com as migrations 0042 e 0044 aplicadas", () => {
  it("o histórico grava o depósito e o prazo fica salvo", async () => {
    const client = banco();
    const criado = await criarWishlistItem(client, {
      nome: "Cadeira",
      cor: "#FF7AB6",
      valorAlvo: 300,
      prazo: "2026-12-24",
    });
    expect(criado.prazo).toBe("2026-12-24");

    const r = await guardarNoDesejo(client, {
      userId: USER,
      desejoId: criado.id,
      texto: "120",
    });
    expect(r).toEqual({ ok: true, valorAtual: 120 });

    const hist = await listarHistoricoGuardar(client, USER);
    expect(hist?.map((h) => [h.desejoId, h.valor])).toEqual([
      [criado.id, 120],
    ]);
    expect(await oQueQuemLeVe(client)).toEqual({
      nome: "Cadeira",
      atual: 120,
      pct: 40,
      prazo: "2026-12-24",
    });
  });

  it("editar pode limpar o prazo", async () => {
    const client = banco();
    const criado = await criarWishlistItem(client, {
      nome: "Cadeira",
      cor: "#FF7AB6",
      valorAlvo: 300,
      prazo: "2026-12-24",
    });
    const editado = await atualizarWishlistItem(client, {
      itemId: criado.id,
      nome: "Cadeira",
      valorAlvo: 300,
      estado: "quero",
      privacidade: "privado",
      prazo: null,
    });
    expect(editado.prazo).toBeNull();
  });
});

describe("faltaTabela / faltaColuna: só o erro de migration não aplicada", () => {
  it("reconhece o PostgREST novo e o Postgres", () => {
    expect(
      faltaTabela(
        {
          code: "PGRST205",
          message:
            "Could not find the table 'public.guardar_historico' in the schema cache",
        },
        "guardar_historico"
      )
    ).toBe(true);
    expect(
      faltaTabela(
        {
          code: "42P01",
          message: 'relation "public.guardar_historico" does not exist',
        },
        "guardar_historico"
      )
    ).toBe(true);
    expect(
      faltaColuna(
        {
          code: "PGRST204",
          message:
            "Could not find the 'prazo' column of 'rede_wishlist_items' in the schema cache",
        },
        "prazo"
      )
    ).toBe(true);
    expect(
      faltaColuna(
        {
          code: "42703",
          message:
            'column "prazo" of relation "rede_wishlist_items" does not exist',
        },
        "prazo"
      )
    ).toBe(true);
  });

  it("não confunde com outra tabela, outra coluna nem outro erro", () => {
    expect(
      faltaTabela(
        { code: "42P01", message: 'relation "public.outra" does not exist' },
        "guardar_historico"
      )
    ).toBe(false);
    expect(
      faltaColuna(
        {
          code: "PGRST204",
          message: "Could not find the 'nome' column of 'x' in the schema cache",
        },
        "prazo"
      )
    ).toBe(false);
    expect(
      faltaTabela(
        { code: "42501", message: "permission denied for guardar_historico" },
        "guardar_historico"
      )
    ).toBe(false);
    expect(faltaTabela(null, "guardar_historico")).toBe(false);
  });
});

describe("outros erros continuam sendo erro", () => {
  it("Guardar com o histórico recusado (RLS) não soma nada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = banco();
    const criado = await criarWishlistItem(client, {
      nome: "Cadeira",
      cor: "#FF7AB6",
      valorAlvo: 300,
    });
    const recusa = {
      from(tabela: string) {
        if (tabela === "guardar_historico") {
          const q = {
            insert: () => q,
            select: () => q,
            single: async () => ({
              data: null,
              error: { code: "42501", message: "new row violates row-level security policy" },
            }),
          };
          return q;
        }
        return client.from(tabela as "rede_wishlist_items");
      },
    } as unknown as SupabaseClient<Database>;
    const r = await guardarNoDesejo(recusa, {
      userId: USER,
      desejoId: criado.id,
      texto: "50",
    });
    expect(r).toMatchObject({ ok: false, etapa: "historico" });
    expect((await oQueQuemLeVe(client))?.atual).toBe(0);
  });
});
