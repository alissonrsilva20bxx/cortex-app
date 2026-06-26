export type JobStatus = "agendado" | "confirmado" | "concluído" | "cancelado";
export type Modalidade = "presencial" | "online";
export type PeriodoMeta = "dia" | "mes" | "ano";
export type TabId = "home" | "jobs" | "financeiro" | "cofre" | "ajustes";

export interface Job {
  id: string;
  clienteNome: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  valor: number; // BRL
  modalidade: Modalidade;
  local?: string; // obrigatório se presencial
  status: JobStatus;
  observacoes?: string;
  criadoEm: string; // ISO timestamp
}

export interface Meta {
  periodo: PeriodoMeta;
  valorAlvo: number;
}

export interface Usuario {
  id: string;
  nome: string; // user_metadata.full_name do Google
  email: string;
  avatarUrl?: string;
}
