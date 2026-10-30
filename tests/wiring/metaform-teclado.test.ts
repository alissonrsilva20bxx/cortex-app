import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R21 (auditoria, teclado no iPhone): o "Editar Metas" tem casca de sheet
 * própria (não usa o BottomSheet) e ficou fora do #176. No laboratório, com
 * a área visível em 508 px, o campo da meta anual ficava em 691-739, atrás
 * do teclado. Liga o mesmo useCampoVisivelComTeclado do Novo atendimento.
 */
const src = readFileSync(
  join(process.cwd(), "components/financeiro/MetaForm.tsx"),
  "utf8"
).replace(/\r\n/g, "\n");

describe("Editar Metas: o campo focado fica acima do teclado", () => {
  it("liga o efeito do teclado ao painel enquanto está aberto", () => {
    expect(src).toMatch(/useCampoVisivelComTeclado\(painelRef, open\)/);
    expect(src).toMatch(/ref=\{painelRef\}\s+role="dialog"/);
  });

  it("o painel sobe pelo recuo do teclado e cabe na área que sobrou", () => {
    expect(src).toContain('bottom: "var(--teclado-inset, 0px)"');
    expect(src).toContain(
      '"min(90dvh, calc(var(--teclado-altura-util, 100dvh) * 0.9))"'
    );
  });

  it("os campos ficam numa área que rola", () => {
    expect(src).toContain(
      'className="overflow-y-auto flex-1 px-5 py-5 space-y-4"'
    );
  });
});
