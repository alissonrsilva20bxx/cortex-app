export type JobStatus = "agendado" | "confirmado" | "concluído" | "cancelado";
export type Modalidade = "presencial" | "online";
export type PeriodoMeta = "dia" | "mes" | "ano";
export type TabId =
  | "home"
  | "jobs"
  | "financeiro"
  | "cofre"
  | "rede"
  | "ajustes";
export type AssinaturaStatus = "trial" | "ativa" | "vencida";

export interface Job {
  id: string;
  clienteNome: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  valor: number; // BRL
  modalidade: Modalidade;
  local?: string;
  status: JobStatus;
  observacoes?: string;
  criadoEm: string; // ISO timestamp
}

export interface Meta {
  periodo: PeriodoMeta;
  valorAlvo: number;
}

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data: string; // YYYY-MM-DD
  criadoEm: string;
}

export interface ReceitaAvulsa {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data: string; // YYYY-MM-DD
  criadoEm: string;
}

export interface Objetivo {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: string; // vida | afazeres | saude | financeiro | outros
  concluido: boolean;
  criadoEm: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string;
}

export interface HomeCardConfig {
  nextJob: boolean;
  financeSummary: boolean;
  objetivos?: boolean;
}

export type CardStyle = "compact" | "standard";
export interface CardStyleConfig {
  nextJob: CardStyle;
  financeSummary: CardStyle;
}

export interface ChartPrefConfig {
  financeiro: "bar" | "area";
  jobs: "bar" | "donut";
}
