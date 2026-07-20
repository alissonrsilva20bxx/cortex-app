export type JobStatus = "agendado" | "confirmado" | "concluído" | "cancelado";
export type Modalidade = "presencial" | "online";
export type PeriodoMeta = "dia" | "mes" | "ano";
export type Tema =
  | "grafite"
  | "pink-neon"
  | "purple"
  | "crimson"
  | "ocean"
  | "gold"
  | "emerald"
  | "midnight";

export type DespesaCategoria =
  | "alimentacao"
  | "transporte"
  | "moradia"
  | "saude"
  | "educacao"
  | "lazer"
  | "vestuario"
  | "marketing"
  | "ferramentas"
  | "equipamentos"
  | "impostos"
  | "internet"
  | "combustivel"
  | "outros";

export type Database = {
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      despesas: {
        Row: {
          id: string;
          user_id: string;
          descricao: string;
          valor: number;
          categoria: string;
          data: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          descricao: string;
          valor: number;
          categoria?: string;
          data?: string;
          criado_em?: string;
        };
        Update: {
          descricao?: string;
          valor?: number;
          categoria?: string;
          data?: string;
        };
        Relationships: [];
      };
      receitas_avulsas: {
        Row: {
          id: string;
          user_id: string;
          descricao: string;
          valor: number;
          categoria: string;
          data: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          descricao: string;
          valor: number;
          categoria?: string;
          data?: string;
          criado_em?: string;
        };
        Update: {
          descricao?: string;
          valor?: number;
          categoria?: string;
          data?: string;
        };
        Relationships: [];
      };
      objetivos: {
        Row: {
          id: string;
          user_id: string;
          titulo: string;
          descricao: string | null;
          categoria: string;
          concluido: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          titulo: string;
          descricao?: string | null;
          categoria?: string;
          concluido?: boolean;
          criado_em?: string;
        };
        Update: {
          titulo?: string;
          descricao?: string | null;
          categoria?: string;
          concluido?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
