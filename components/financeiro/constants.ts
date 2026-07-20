import type { Meta, PeriodoMeta } from "@/lib/types";

export const DEFAULT_METAS: Meta[] = [
  { periodo: "dia", valorAlvo: 300 },
  { periodo: "mes", valorAlvo: 3000 },
  { periodo: "ano", valorAlvo: 36000 },
];

export const PERIODO_LABELS: Record<PeriodoMeta, string> = {
  dia: "Hoje",
  mes: "Este mês",
  ano: "Este ano",
};

export const CAT_LABELS: Record<string, string> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  moradia: "Moradia",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  vestuario: "Vestuário",
  marketing: "Marketing",
  ferramentas: "Ferramentas",
  equipamentos: "Equipamentos",
  impostos: "Impostos",
  internet: "Internet",
  combustivel: "Combustível",
  outros: "Outros",
};

export const CAT_EMOJIS: Record<string, string> = {
  alimentacao: "🍽️",
  transporte: "🚗",
  moradia: "🏠",
  saude: "🏥",
  educacao: "📚",
  lazer: "🎮",
  vestuario: "👕",
  marketing: "📣",
  ferramentas: "💻",
  equipamentos: "🔧",
  impostos: "📋",
  internet: "📡",
  combustivel: "⛽",
  outros: "📦",
};

export const REC_CAT_EMOJIS: Record<string, string> = {
  freelance: "💼",
  investimento: "📈",
  venda: "🛒",
  bonus: "🎁",
  outros: "💰",
};

export const REC_CAT_LABELS: Record<string, string> = {
  freelance: "Freelance",
  investimento: "Investimento",
  venda: "Venda",
  bonus: "Bônus",
  outros: "Outros",
};

export const OBJ_CATS = [
  { id: "afazeres", label: "Afazeres", emoji: "✅" },
  { id: "vida", label: "Vida", emoji: "🌟" },
  { id: "saude", label: "Saúde", emoji: "💪" },
  { id: "financeiro", label: "Financeiro", emoji: "💰" },
  { id: "outros", label: "Outros", emoji: "📌" },
];
