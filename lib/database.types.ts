export type JobStatus = "agendado" | "confirmado" | "concluído" | "cancelado";
export type Modalidade = "presencial" | "online";
export type PeriodoMeta = "dia" | "mes" | "ano";
export type Tema = "pink-neon" | "purple" | "crimson";

export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          user_id: string;
          cliente_nome: string;
          data: string;
          hora: string;
          valor: number;
          modalidade: Modalidade;
          local: string | null;
          status: JobStatus;
          observacoes: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cliente_nome: string;
          data: string;
          hora: string;
          valor: number;
          modalidade: Modalidade;
          local?: string | null;
          status?: JobStatus;
          observacoes?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          cliente_nome?: string;
          data?: string;
          hora?: string;
          valor?: number;
          modalidade?: Modalidade;
          local?: string | null;
          status?: JobStatus;
          observacoes?: string | null;
          atualizado_em?: string;
        };
      };
      metas: {
        Row: {
          id: string;
          user_id: string;
          periodo: PeriodoMeta;
          valor_alvo: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          periodo: PeriodoMeta;
          valor_alvo: number;
        };
        Update: {
          valor_alvo?: number;
        };
      };
      notas: {
        Row: {
          id: string;
          user_id: string;
          conteudo: string;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conteudo: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          conteudo?: string;
          atualizado_em?: string;
        };
      };
      configuracoes: {
        Row: {
          user_id: string;
          tema: Tema;
          pin_hash: string | null;
        };
        Insert: {
          user_id: string;
          tema?: Tema;
          pin_hash?: string | null;
        };
        Update: {
          tema?: Tema;
          pin_hash?: string | null;
        };
      };
    };
  };
}
