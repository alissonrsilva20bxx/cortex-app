import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ajustes no estilo do iPhone (gabarito: opção 1 de
 * .lavish/config-estilos.html; mapa em AJUSTES-MAPA.md, 19 itens). Teste de
 * fiação: lê o fonte e afirma que as 4 correções pedidas estão ligadas ao
 * código real, e que os itens que funcionavam continuam alcançáveis.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const src = read("components/ajustes/AjustesTab.tsx");
const semComentarios = src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("lista agrupada (estilo iPhone)", () => {
  it("os grupos, na ordem: Conta, Segurança, Aparência, Tela inicial, Notificações, Dados, Aplicativo e Sair", () => {
    const ordem = [
      'titulo="Conta"',
      'titulo="Segurança"',
      'titulo="Aparência"',
      'titulo="Tela inicial"',
      'titulo="Notificações"',
      'titulo="Dados e privacidade"',
      'titulo="Aplicativo"',
      'title="Sair da conta"',
    ].map((m) => semComentarios.indexOf(m));
    for (const i of ordem) expect(i).toBeGreaterThan(-1);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("linhas de 52px no mínimo e a linha inteira alterna as chaves", () => {
    expect(src).toMatch(/minHeight: 52,/);
    expect(src).toMatch(
      /onClick=\{\(\) => !chave\.disabled && chave\.onChange\(!chave\.checked\)\}/
    );
  });

  it("sem sub-página de um item só: Notificações, Instalar, Tela inicial e Dados ficam na lista", () => {
    expect(src).toMatch(/type SettingsPage = "appearance";/);
    expect(semComentarios).not.toMatch(
      /openSettingsPage\("(security|home|notifications|install|data)"\)/
    );
  });
});

describe("as 4 correções do mapa", () => {
  it("Trocar PIN aparece com o PIN ativo (e pede a conta, via abrirPinSetup)", () => {
    expect(src).toMatch(
      /<Linha title="Trocar PIN" onClick=\{abrirPinSetup\} \/>/
    );
    expect(src).toMatch(
      /function abrirPinSetup\(\) \{\s*if \(pinEnabled\) setReauthMotivo\("trocar-pin"\);/
    );
  });

  it('Assinatura com "Ver planos", que abre a tela de planos real da página', () => {
    expect(src).toMatch(
      /<Linha title="Ver planos" destaque onClick=\{onVerPlanos\} last \/>/
    );
    expect(read("app/page.tsx")).toMatch(
      /<AjustesTab[\s\S]*?onVerPlanos=\{\(\) => setReabrirPlanos\(\(n\) => n \+ 1\)\}/
    );
    expect(read("app/dev-preview/app/page.tsx")).toMatch(
      /<AjustesTab[\s\S]*?onVerPlanos=\{\(\) => setAbrirPlanos\(\(n\) => n \+ 1\)\}/
    );
  });

  it('"Sair da conta" pede confirmação antes de sair', () => {
    expect(src).toMatch(
      /title="Sair da conta"\s*perigo\s*onClick=\{\(\) => setSairAberto\(true\)\}/
    );
    expect(src).toMatch(
      /<BottomSheet\s+open=\{sairAberto\}[\s\S]*?title="Sair da conta\?"[\s\S]*?onClick=\{onSignOut\}/
    );
    // onSignOut só sai pelo botão da confirmação (e pelo ReauthModal, que
    // já é uma tela de confirmação).
    expect(semComentarios.match(/onClick=\{onSignOut\}/g) ?? []).toHaveLength(
      1
    );
  });

  it('a chave enfeite "Independência Financeira" saiu (não mudava nada na Início)', () => {
    expect(semComentarios).not.toMatch(/Independência Financeira/);
    const lista = src.slice(
      src.indexOf("const homeCardItems"),
      src.indexOf("];", src.indexOf("const homeCardItems"))
    );
    expect(lista).not.toMatch(/key: "financeSummary"/);
  });
});

describe("outros consertos do mapa", () => {
  it("exportar avisa quando termina e quando falha", () => {
    expect(src).toMatch(
      /await exportarDadosCSV\(userId\);\s*setExportAviso\(\{ ok: true,/
    );
    expect(src).toMatch(
      /\} catch \(err\) \{\s*console\.error\("\[Ajustes exportar\]", err\);\s*setExportAviso\(\{/
    );
  });

  it('"Você já construiu" só aparece com atendimentos (nunca "R$ 0 em 0")', () => {
    expect(src).toMatch(
      /estadoAssinatura\?\.status === "vencida" && concluidos > 0/
    );
  });

  it("Instalar abre a folha direto, num toque", () => {
    expect(src).toMatch(
      /title="Instalar Arcelle"[\s\S]{0,300}onClick=\{\(\) => setInstallSheetOpen\(true\)\}/
    );
  });

  it("os temas dizem qual está escolhido e não divergem do servidor (sem erro de hidratação)", () => {
    expect(src).toMatch(/aria-pressed=\{active\}/);
    expect(src).toMatch(/const active = montado && theme === t;/);
    expect(src).toMatch(/valor=\{montado \? THEME_LABELS\[theme\] : ""\}/);
  });

  it('a opção "Barras / Pizza" (gráfico do resumo) não existe mais nos Ajustes', () => {
    expect(src).not.toMatch(/Barras|Pizza|Gráfico do resumo/);
    expect(src).not.toMatch(/BarChart2|PieChart|chartPrefs|ChartPrefConfig/);
    expect(src).not.toContain("onChartPrefsChange");
    expect(src).not.toContain("jobapp-chart-prefs");
  });

  it("nenhuma página nem o JobsTab ainda recebe ou guarda a preferência de gráfico; a preferência antiga salva no aparelho é ignorada", () => {
    for (const p of [
      "app/page.tsx",
      "app/dev-preview/app/page.tsx",
      "components/jobs/JobsTab.tsx",
      "lib/types.ts",
    ]) {
      expect(read(p)).not.toMatch(
        /chartType|chartPrefs|ChartPrefConfig|jobapp-chart-prefs/
      );
    }
  });

  it("os gráficos de barra e pizza, sem uso, foram apagados", () => {
    expect(existsSync(join(ROOT, "components/charts/MiniBarChart.tsx"))).toBe(
      false
    );
    expect(existsSync(join(ROOT, "components/charts/DonutChart.tsx"))).toBe(
      false
    );
  });
});
