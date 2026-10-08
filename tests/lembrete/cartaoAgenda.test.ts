import { describe, expect, it, vi } from "vitest";
import {
  POLITICA,
  POLITICA_24H,
  cartaoAgendaSvg,
  dadosDoLembrete,
  linkWhatsApp,
  mensagemDoLembrete,
  nomeDoArquivo,
  podeLembrar,
} from "../../lib/lembrete/cartaoAgenda";
import { compartilharLembrete } from "../../lib/lembrete/imagem";
import type { Job } from "../../lib/types";

const job = (extra: Partial<Job> = {}): Job => ({
  id: "j1",
  clienteNome: "Carla Mendes",
  data: "2026-10-09", // sexta
  hora: "14:30",
  valor: 180,
  modalidade: "presencial",
  local: "Rua das Flores 120",
  status: "confirmado",
  criadoEm: "2026-10-01T10:00:00Z",
  ...extra,
});
const PRO = { nome: "Miguel", telefone: "(11) 98765-4321" };

describe("dadosDoLembrete: só dado real do agendamento e da profissional", () => {
  it("dia da semana, dia, mês, data, hora, valor e status", () => {
    const d = dadosDoLembrete(job(), PRO);
    expect(d).toMatchObject({
      cliente: "Carla Mendes",
      semana: "Sexta",
      dia: 9,
      mes: "outubro",
      data: "09/10",
      hora: "14h30",
      local: "Rua das Flores 120",
      profissional: "Miguel",
      telefone: "(11) 98765-4321",
      status: "Confirmado",
      confirmado: true,
    });
    expect(d.valor.replace(/\s/g, " ")).toBe("R$ 180,00");
  });
  it("sem serviço salvo: 'Atendimento' (ou 'Atendimento online'); com serviço, o serviço", () => {
    expect(dadosDoLembrete(job(), PRO).servico).toBe("Atendimento");
    expect(dadosDoLembrete(job({ modalidade: "online" }), PRO)).toMatchObject({
      servico: "Atendimento online",
      local: "Online",
    });
    expect(dadosDoLembrete(job(), PRO, { servico: "Manicure" }).servico).toBe(
      "Manicure"
    );
  });
  it("campos que faltam ficam nulos, não inventados", () => {
    const d = dadosDoLembrete(job({ local: "  " }), { nome: "Miguel" });
    expect(d.local).toBeNull();
    expect(d.telefone).toBeNull();
    expect(d.duracaoMin).toBeNull();
    expect(d.fim).toBeNull();
  });
  it("com duração, o fim é calculado (e vira o dia na meia-noite)", () => {
    expect(dadosDoLembrete(job(), PRO, { duracaoMin: 60 }).fim).toBe("15h30");
    expect(
      dadosDoLembrete(job({ hora: "23:30" }), PRO, { duracaoMin: 60 }).fim
    ).toBe("00h30");
  });
  it("só lembra o que ainda vai acontecer", () => {
    expect(podeLembrar(job({ status: "agendado" }))).toBe(true);
    expect(podeLembrar(job({ status: "confirmado" }))).toBe(true);
    expect(podeLembrar(job({ status: "concluído" }))).toBe(false);
    expect(podeLembrar(job({ status: "cancelado" }))).toBe(false);
  });
});

/** SVG vira imagem só se for XML bem formado: todo atributo com valor entre
 * aspas e toda tag fechada (o navegador recusa o resto em silêncio). */
function xmlBemFormado(svg: string): string[] {
  const erros: string[] = [];
  for (const tag of svg.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const corpo = tag.replace(/^<[a-zA-Z][\w:-]*/, "").replace(/\/?>$/, "");
    const sobra = corpo.replace(/\s+[\w:-]+="[^"]*"/g, "").trim();
    if (sobra) erros.push(`atributo sem valor em ${tag.slice(0, 60)}`);
  }
  const abre = (svg.match(/<(?!\/)[a-zA-Z][^>]*[^/]>/g) ?? []).length;
  const fecha = (svg.match(/<\/[a-zA-Z][^>]*>/g) ?? []).length;
  if (abre !== fecha) erros.push(`tags abertas ${abre} x fechadas ${fecha}`);
  return erros;
}

describe("cartaoAgendaSvg: o cartão de agenda (proposta 2)", () => {
  const d = dadosDoLembrete(job(), PRO, { duracaoMin: 60 });
  const svg = cartaoAgendaSvg(d, "claro");
  it("é XML bem formado em todos os casos (senão o celular não gera a imagem)", () => {
    for (const dd of [
      d,
      dadosDoLembrete(job({ local: null as never, status: "agendado" }), {
        nome: "Miguel",
      }),
      dadosDoLembrete(
        job({ modalidade: "online", clienteNome: 'Ana <b>& "Bia"' }),
        PRO,
        { duracaoMin: 90 }
      ),
    ])
      for (const modo of ["claro", "escuro"] as const)
        expect(xmlBemFormado(cartaoAgendaSvg(dd, modo))).toEqual([]);
  });
  it("600×750, com data grande, dia da semana no topo do calendário e mês", () => {
    expect(svg).toContain('viewBox="0 0 600 750"');
    expect(svg).toMatch(/font-size="136"[^>]*>9<\/text>/);
    expect(svg).toMatch(/letter-spacing="5">SEXTA<\/text>/);
    expect(svg).toMatch(/letter-spacing="3">OUTUBRO<\/text>/);
  });
  it("hora e duração, serviço, valor, cliente, local, profissional e telefone, status e o aviso de 24h", () => {
    for (const t of [
      "14h30 – 15h30",
      "60 min",
      "Atendimento",
      "para Carla Mendes",
      "Rua das Flores 120",
      "Miguel",
      "(11) 98765-4321",
      "Confirmado",
      POLITICA,
      POLITICA_24H,
    ])
      expect(svg, t).toContain(t);
    expect(svg.replace(/\s/g, " ")).toContain("R$ 180,00");
    expect(POLITICA_24H).toContain("24h");
  });
  it("o relógio marca o tempo do atendimento (arco rosa) só quando há duração", () => {
    expect(svg).toContain("data-arco");
    const semDur = cartaoAgendaSvg(dadosDoLembrete(job(), PRO), "claro");
    expect(semDur).not.toContain("data-arco");
    expect(semDur).not.toMatch(/\d+ min</);
    expect(semDur).toContain(">14h30<");
  });
  it("sem telefone a linha some; sem local a linha some", () => {
    const s = cartaoAgendaSvg(
      dadosDoLembrete(job({ local: null as never }), { nome: "Miguel" }),
      "claro"
    );
    expect(s).not.toContain("data-telefone");
    expect(s).not.toContain("Rua das Flores");
  });
  it("agendado (ainda não confirmado) diz 'Agendado', sem o verde de confirmado", () => {
    const s = cartaoAgendaSvg(
      dadosDoLembrete(job({ status: "agendado" }), PRO),
      "claro"
    );
    expect(s).toContain(">Agendado<");
    expect(s).not.toContain("#0f8a52");
  });
  it("claro e escuro trocam as cores (fundo branco / fundo escuro)", () => {
    expect(svg).toContain('fill="#ffffff"');
    expect(cartaoAgendaSvg(d, "escuro")).toContain('fill="#141015"');
  });
  it("escapa texto do usuário (nada de HTML/SVG injetado)", () => {
    const s = cartaoAgendaSvg(
      dadosDoLembrete(job({ clienteNome: 'Ana <b>& "Bia"' }), PRO),
      "claro"
    );
    expect(s).toContain("Ana &lt;b&gt;&amp; &quot;Bia&quot;");
    expect(s).not.toContain("<b>");
  });
});

describe("a mensagem curta do WhatsApp", () => {
  it("confirmado: quando, onde, 24h e a assinatura", () => {
    const m = mensagemDoLembrete(
      dadosDoLembrete(job(), PRO, { duracaoMin: 60 })
    );
    expect(m).toBe(
      "Olá, Carla Mendes, tudo bem? Seu horário está confirmado: sexta, 09/10, às 14h30 (60 min), em Rua das Flores 120.\n" +
        "Para remarcar ou cancelar, responda a esta mensagem com 24h de antecedência. Até lá!\nMiguel"
    );
  });
  it("agendado, online, sem duração", () => {
    const m = mensagemDoLembrete(
      dadosDoLembrete(job({ status: "agendado", modalidade: "online" }), PRO)
    );
    expect(m).toContain(
      "Seu horário está marcado: sexta, 09/10, às 14h30, online."
    );
    expect(m).not.toContain("min)");
  });
  it("wa.me só com o texto: o app não escolhe o contato", () => {
    const l = linkWhatsApp("Olá, Carla & cia");
    expect(l).toBe("https://wa.me/?text=Ol%C3%A1%2C%20Carla%20%26%20cia");
    expect(l).not.toMatch(/wa\.me\/\d/);
  });
  it("nome do arquivo sem acento nem espaço", () => {
    expect(
      nomeDoArquivo(
        dadosDoLembrete(job({ clienteNome: "Sônia Aparecida" }), PRO)
      )
    ).toBe("lembrete-sonia-aparecida-09-10.png");
  });
});

describe("compartilhar: a folha do celular com a imagem; nunca envia sozinho", () => {
  const png = new Blob(["x"], { type: "image/png" });
  it("com suporte a arquivo, abre a folha com a imagem e o texto", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const r = await compartilharLembrete(png, "a.png", "Olá", {
      share,
      canShare: () => true,
    } as never);
    expect(r).toBe("compartilhado");
    const dados = share.mock.calls[0][0];
    expect(dados.text).toBe("Olá");
    expect(dados.files[0].name).toBe("a.png");
    expect(dados.files[0].type).toBe("image/png");
  });
  it("ela fecha a folha: 'cancelado', sem erro", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("x", "AbortError"));
    expect(
      await compartilharLembrete(png, "a.png", "Olá", {
        share,
        canShare: () => true,
      } as never)
    ).toBe("cancelado");
  });
  it("sem suporte a arquivo: 'sem-suporte' (vai para baixar + wa.me)", async () => {
    const share = vi.fn();
    expect(
      await compartilharLembrete(png, "a.png", "Olá", {
        share,
        canShare: () => false,
      } as never)
    ).toBe("sem-suporte");
    expect(await compartilharLembrete(png, "a.png", "Olá", {} as never)).toBe(
      "sem-suporte"
    );
    expect(share).not.toHaveBeenCalled();
  });
});
