import { supabase } from "@/lib/supabase";

/**
 * Exportar sempre disponível, mesmo com assinatura vencida (§7.4: confiança
 * > lock-in). Busca direto do Supabase — não depende de estado já carregado
 * na tela, então funciona de qualquer aba.
 */

interface LinhaExtrato {
  data: string;
  tipo: "Atendimento" | "Despesa" | "Receita avulsa";
  descricao: string;
  detalhe: string;
  valor: number;
  status: string;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildCSV(rows: LinhaExtrato[]): string {
  const header = [
    "Data",
    "Tipo",
    "Descrição",
    "Detalhe",
    "Valor (R$)",
    "Status",
  ];
  const linhas = [...rows]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((r) =>
      [r.data, r.tipo, r.descricao, r.detalhe, r.valor.toFixed(2), r.status]
        .map((v) => csvEscape(String(v)))
        .join(",")
    );
  return [header.join(","), ...linhas].join("\n");
}

/** Baixa um CSV com o extrato completo (atendimentos + despesas + receitas). */
export async function exportarDadosCSV(userId: string): Promise<void> {
  const [{ data: jobs }, { data: despesas }, { data: receitas }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("data, cliente_nome, modalidade, valor, status")
        .eq("user_id", userId),
      supabase
        .from("despesas")
        .select("data, descricao, categoria, valor")
        .eq("user_id", userId),
      supabase
        .from("receitas_avulsas")
        .select("data, descricao, categoria, valor")
        .eq("user_id", userId),
    ]);

  const rows: LinhaExtrato[] = [
    ...(jobs ?? []).map((j) => ({
      data: j.data,
      tipo: "Atendimento" as const,
      descricao: j.cliente_nome,
      detalhe: j.modalidade,
      valor: j.valor,
      status: j.status,
    })),
    ...(despesas ?? []).map((d) => ({
      data: d.data,
      tipo: "Despesa" as const,
      descricao: d.descricao,
      detalhe: d.categoria,
      valor: d.valor,
      status: "",
    })),
    ...(receitas ?? []).map((r) => ({
      data: r.data,
      tipo: "Receita avulsa" as const,
      descricao: r.descricao,
      detalhe: r.categoria,
      valor: r.valor,
      status: "",
    })),
  ];

  const csv = buildCSV(rows);
  // BOM no início: sem ele, o Excel abre acentos (ç, ã, é...) quebrados.
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jobapp-dados-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
