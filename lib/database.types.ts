export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      configuracoes: {
        Row: {
          assinatura_status: Database["public"]["Enums"]["assinatura_status"];
          pin_hash: string | null;
          tema: Database["public"]["Enums"]["tema"];
          trial_started_at: string;
          user_id: string;
        };
        Insert: {
          assinatura_status?: Database["public"]["Enums"]["assinatura_status"];
          pin_hash?: string | null;
          tema?: Database["public"]["Enums"]["tema"];
          trial_started_at?: string;
          user_id: string;
        };
        Update: {
          assinatura_status?: Database["public"]["Enums"]["assinatura_status"];
          pin_hash?: string | null;
          tema?: Database["public"]["Enums"]["tema"];
          trial_started_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      despesas: {
        Row: {
          categoria: string;
          criado_em: string;
          data: string;
          descricao: string;
          id: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          categoria?: string;
          criado_em?: string;
          data?: string;
          descricao: string;
          id?: string;
          user_id: string;
          valor: number;
        };
        Update: {
          categoria?: string;
          criado_em?: string;
          data?: string;
          descricao?: string;
          id?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          atualizado_em: string;
          cliente_nome: string;
          criado_em: string;
          data: string;
          hora: string;
          id: string;
          local: string | null;
          modalidade: Database["public"]["Enums"]["modalidade"];
          observacoes: string | null;
          status: Database["public"]["Enums"]["job_status"];
          user_id: string;
          valor: number;
        };
        Insert: {
          atualizado_em?: string;
          cliente_nome: string;
          criado_em?: string;
          data: string;
          hora: string;
          id?: string;
          local?: string | null;
          modalidade: Database["public"]["Enums"]["modalidade"];
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          user_id: string;
          valor: number;
        };
        Update: {
          atualizado_em?: string;
          cliente_nome?: string;
          criado_em?: string;
          data?: string;
          hora?: string;
          id?: string;
          local?: string | null;
          modalidade?: Database["public"]["Enums"]["modalidade"];
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          user_id?: string;
          valor?: number;
        };
        Relationships: [];
      };
      metas: {
        Row: {
          id: string;
          periodo: Database["public"]["Enums"]["periodo_meta"];
          user_id: string;
          valor_alvo: number;
        };
        Insert: {
          id?: string;
          periodo: Database["public"]["Enums"]["periodo_meta"];
          user_id: string;
          valor_alvo: number;
        };
        Update: {
          id?: string;
          periodo?: Database["public"]["Enums"]["periodo_meta"];
          user_id?: string;
          valor_alvo?: number;
        };
        Relationships: [];
      };
      notas: {
        Row: {
          atualizado_em: string;
          conteudo: string;
          criado_em: string;
          id: string;
          user_id: string;
        };
        Insert: {
          atualizado_em?: string;
          conteudo: string;
          criado_em?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          atualizado_em?: string;
          conteudo?: string;
          criado_em?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      objetivos: {
        Row: {
          categoria: string;
          concluido: boolean;
          criado_em: string;
          descricao: string | null;
          id: string;
          titulo: string;
          user_id: string;
        };
        Insert: {
          categoria?: string;
          concluido?: boolean;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          titulo: string;
          user_id: string;
        };
        Update: {
          categoria?: string;
          concluido?: boolean;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          titulo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          criado_em: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          criado_em?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          criado_em?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      receitas_avulsas: {
        Row: {
          categoria: string;
          criado_em: string;
          data: string;
          descricao: string;
          id: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          categoria?: string;
          criado_em?: string;
          data?: string;
          descricao: string;
          id?: string;
          user_id: string;
          valor: number;
        };
        Update: {
          categoria?: string;
          criado_em?: string;
          data?: string;
          descricao?: string;
          id?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [];
      };
      rede_admins: {
        Row: {
          criado_em: string;
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          user_id: string;
        };
        Update: {
          criado_em?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rede_amizades: {
        Row: {
          criado_em: string;
          destinatario_id: string;
          id: string;
          respondido_em: string | null;
          solicitante_id: string;
          status: Database["public"]["Enums"]["rede_amizade_status"];
        };
        Insert: {
          criado_em?: string;
          destinatario_id: string;
          id?: string;
          respondido_em?: string | null;
          solicitante_id: string;
          status?: Database["public"]["Enums"]["rede_amizade_status"];
        };
        Update: {
          criado_em?: string;
          destinatario_id?: string;
          id?: string;
          respondido_em?: string | null;
          solicitante_id?: string;
          status?: Database["public"]["Enums"]["rede_amizade_status"];
        };
        Relationships: [];
      };
      rede_bloqueios: {
        Row: {
          bloqueado_id: string;
          bloqueador_id: string;
          criado_em: string;
          id: string;
        };
        Insert: {
          bloqueado_id: string;
          bloqueador_id: string;
          criado_em?: string;
          id?: string;
        };
        Update: {
          bloqueado_id?: string;
          bloqueador_id?: string;
          criado_em?: string;
          id?: string;
        };
        Relationships: [];
      };
      rede_clientes: {
        Row: {
          criado_em: string;
          etiquetas: string[];
          id: string;
          nome: string;
          observacoes: string;
          status: string;
          telefone: string;
          ultimo_contato: string;
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          etiquetas?: string[];
          id?: string;
          nome: string;
          observacoes?: string;
          status?: string;
          telefone?: string;
          ultimo_contato?: string;
          user_id: string;
        };
        Update: {
          criado_em?: string;
          etiquetas?: string[];
          id?: string;
          nome?: string;
          observacoes?: string;
          status?: string;
          telefone?: string;
          ultimo_contato?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rede_clientes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "rede_perfis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      rede_comentarios: {
        Row: {
          autor_id: string;
          criado_em: string;
          id: string;
          post_id: string;
          texto: string;
        };
        Insert: {
          autor_id: string;
          criado_em?: string;
          id?: string;
          post_id: string;
          texto: string;
        };
        Update: {
          autor_id?: string;
          criado_em?: string;
          id?: string;
          post_id?: string;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rede_comentarios_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "rede_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      rede_conversas: {
        Row: {
          criado_em: string;
          id: string;
          user_high_id: string;
          user_low_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          user_high_id: string;
          user_low_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          user_high_id?: string;
          user_low_id?: string;
        };
        Relationships: [];
      };
      rede_conversas_participantes: {
        Row: {
          conversa_id: string;
          oculta_desde: string | null;
          user_id: string;
        };
        Insert: {
          conversa_id: string;
          oculta_desde?: string | null;
          user_id: string;
        };
        Update: {
          conversa_id?: string;
          oculta_desde?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rede_conversas_participantes_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "rede_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      rede_convites: {
        Row: {
          codigo_hash: string;
          criado_em: string;
          expira_em: string;
          id: string;
          solicitacao_id: string | null;
          usado_em: string | null;
          usado_por: string | null;
        };
        Insert: {
          codigo_hash: string;
          criado_em?: string;
          expira_em: string;
          id?: string;
          solicitacao_id?: string | null;
          usado_em?: string | null;
          usado_por?: string | null;
        };
        Update: {
          codigo_hash?: string;
          criado_em?: string;
          expira_em?: string;
          id?: string;
          solicitacao_id?: string | null;
          usado_em?: string | null;
          usado_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rede_convites_solicitacao_id_fkey";
            columns: ["solicitacao_id"];
            isOneToOne: false;
            referencedRelation: "rede_solicitacoes_beta";
            referencedColumns: ["id"];
          },
        ];
      };
      rede_curtidas: {
        Row: {
          criado_em: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          criado_em?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rede_curtidas_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "rede_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      rede_denuncias: {
        Row: {
          alvo_id: string;
          alvo_tipo: Database["public"]["Enums"]["rede_denuncia_alvo_tipo"];
          criado_em: string;
          denunciante_id: string;
          descricao: string | null;
          id: string;
          motivo: Database["public"]["Enums"]["rede_denuncia_motivo"];
          resolvido_em: string | null;
          resolvido_por: string | null;
          resolvido_por_auditoria: string | null;
          revisado_em: string | null;
          revisado_por: string | null;
          revisado_por_auditoria: string | null;
          status: Database["public"]["Enums"]["rede_denuncia_status"];
        };
        Insert: {
          alvo_id: string;
          alvo_tipo: Database["public"]["Enums"]["rede_denuncia_alvo_tipo"];
          criado_em?: string;
          denunciante_id: string;
          descricao?: string | null;
          id?: string;
          motivo: Database["public"]["Enums"]["rede_denuncia_motivo"];
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          resolvido_por_auditoria?: string | null;
          revisado_em?: string | null;
          revisado_por?: string | null;
          revisado_por_auditoria?: string | null;
          status?: Database["public"]["Enums"]["rede_denuncia_status"];
        };
        Update: {
          alvo_id?: string;
          alvo_tipo?: Database["public"]["Enums"]["rede_denuncia_alvo_tipo"];
          criado_em?: string;
          denunciante_id?: string;
          descricao?: string | null;
          id?: string;
          motivo?: Database["public"]["Enums"]["rede_denuncia_motivo"];
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          resolvido_por_auditoria?: string | null;
          revisado_em?: string | null;
          revisado_por?: string | null;
          revisado_por_auditoria?: string | null;
          status?: Database["public"]["Enums"]["rede_denuncia_status"];
        };
        Relationships: [];
      };
      rede_livelinks: {
        Row: {
          criado_em: string;
          id: string;
          ordem: number;
          titulo: string;
          url: string;
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          ordem?: number;
          titulo: string;
          url: string;
          user_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          ordem?: number;
          titulo?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rede_livelinks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "rede_perfis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      rede_mensagens: {
        Row: {
          autor_id: string;
          conversa_id: string;
          criado_em: string;
          id: string;
          lida_em: string | null;
          texto: string;
        };
        Insert: {
          autor_id: string;
          conversa_id: string;
          criado_em?: string;
          id?: string;
          lida_em?: string | null;
          texto: string;
        };
        Update: {
          autor_id?: string;
          conversa_id?: string;
          criado_em?: string;
          id?: string;
          lida_em?: string | null;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rede_mensagens_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "rede_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      rede_notificacoes_cursor: {
        Row: {
          user_id: string;
          vistas_em: string;
        };
        Insert: {
          user_id: string;
          vistas_em?: string;
        };
        Update: {
          user_id?: string;
          vistas_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rede_notificacoes_cursor_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "rede_perfis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      rede_perfis: {
        Row: {
          area_atuacao: string | null;
          atualizado_em: string;
          bio: string | null;
          cor_avatar: string;
          criado_em: string;
          nome_exibicao: string;
          user_id: string;
        };
        Insert: {
          area_atuacao?: string | null;
          atualizado_em?: string;
          bio?: string | null;
          cor_avatar: string;
          criado_em?: string;
          nome_exibicao: string;
          user_id: string;
        };
        Update: {
          area_atuacao?: string | null;
          atualizado_em?: string;
          bio?: string | null;
          cor_avatar?: string;
          criado_em?: string;
          nome_exibicao?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rede_posts: {
        Row: {
          atualizado_em: string;
          autor_id: string;
          categoria: Database["public"]["Enums"]["rede_post_categoria"];
          criado_em: string;
          id: string;
          texto: string;
        };
        Insert: {
          atualizado_em?: string;
          autor_id: string;
          categoria: Database["public"]["Enums"]["rede_post_categoria"];
          criado_em?: string;
          id?: string;
          texto: string;
        };
        Update: {
          atualizado_em?: string;
          autor_id?: string;
          categoria?: Database["public"]["Enums"]["rede_post_categoria"];
          criado_em?: string;
          id?: string;
          texto?: string;
        };
        Relationships: [];
      };
      rede_solicitacoes_beta: {
        Row: {
          criado_em: string;
          id: string;
          status: Database["public"]["Enums"]["rede_solicitacao_beta_status"];
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          status?: Database["public"]["Enums"]["rede_solicitacao_beta_status"];
          user_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          status?: Database["public"]["Enums"]["rede_solicitacao_beta_status"];
          user_id?: string;
        };
        Relationships: [];
      };
      rede_wishlist_items: {
        Row: {
          cor: string;
          criado_em: string;
          estado: string;
          id: string;
          nome: string;
          privacidade: string;
          user_id: string;
          valor_alvo: number;
          valor_atual: number;
        };
        Insert: {
          cor: string;
          criado_em?: string;
          estado?: string;
          id?: string;
          nome: string;
          privacidade?: string;
          user_id: string;
          valor_alvo: number;
          valor_atual?: number;
        };
        Update: {
          cor?: string;
          criado_em?: string;
          estado?: string;
          id?: string;
          nome?: string;
          privacidade?: string;
          user_id?: string;
          valor_alvo?: number;
          valor_atual?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rede_wishlist_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "rede_perfis";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      rede_aprovar_solicitacao_beta: {
        Args: { solicitacao_id: string };
        Returns: Json;
      };
      rede_conversation_is_unblocked: {
        Args: { target_conversa_id: string };
        Returns: boolean;
      };
      rede_criar_conversa_1a1: {
        Args: { outro_user_id: string };
        Returns: string;
      };
      rede_gerar_convite: { Args: { codigo_hash: string }; Returns: Json };
      rede_is_admin: { Args: never; Returns: boolean };
      rede_is_conversation_participant: {
        Args: { target_conversa_id: string };
        Returns: boolean;
      };
      rede_is_member: { Args: never; Returns: boolean };
      rede_listar_bloqueados: {
        Args: never;
        Returns: {
          cor_avatar: string;
          nome_exibicao: string;
          user_id: string;
        }[];
      };
      rede_listar_resumo_conversas: {
        Args: never;
        Returns: {
          conversa_id: string;
          nao_lidas: number;
          outro_user_id: string;
          ultima_mensagem: string;
          ultima_mensagem_em: string;
        }[];
      };
      rede_ocultar_conversa: {
        Args: { alvo_conversa_id: string };
        Returns: undefined;
      };
      rede_reordenar_livelinks: {
        Args: { livelink_ids: string[] };
        Returns: {
          criado_em: string;
          id: string;
          ordem: number;
          titulo: string;
          url: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "rede_livelinks";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      rede_resgatar_convite: {
        Args: { codigo_hash: string; ip_hash: string };
        Returns: Json;
      };
    };
    Enums: {
      assinatura_status: "trial" | "ativa" | "vencida";
      job_status: "agendado" | "confirmado" | "concluído" | "cancelado";
      modalidade: "presencial" | "online";
      periodo_meta: "dia" | "mes" | "ano";
      rede_amizade_status: "pendente" | "aceita" | "recusada";
      rede_denuncia_alvo_tipo: "post" | "comentario" | "usuario" | "mensagem";
      rede_denuncia_motivo: "spam" | "assedio" | "conteudo_impropio" | "outro";
      rede_denuncia_status: "pendente" | "revisada" | "resolvida";
      rede_post_categoria:
        | "conquista"
        | "dica"
        | "duvida"
        | "desabafo"
        | "geral";
      rede_solicitacao_beta_status: "pendente" | "convidado" | "recusado";
      tema:
        | "pink-neon"
        | "purple"
        | "crimson"
        | "grafite"
        | "ocean"
        | "gold"
        | "emerald"
        | "midnight";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assinatura_status: ["trial", "ativa", "vencida"],
      job_status: ["agendado", "confirmado", "concluído", "cancelado"],
      modalidade: ["presencial", "online"],
      periodo_meta: ["dia", "mes", "ano"],
      rede_amizade_status: ["pendente", "aceita", "recusada"],
      rede_denuncia_alvo_tipo: ["post", "comentario", "usuario", "mensagem"],
      rede_denuncia_motivo: ["spam", "assedio", "conteudo_impropio", "outro"],
      rede_denuncia_status: ["pendente", "revisada", "resolvida"],
      rede_post_categoria: ["conquista", "dica", "duvida", "desabafo", "geral"],
      rede_solicitacao_beta_status: ["pendente", "convidado", "recusado"],
      tema: [
        "pink-neon",
        "purple",
        "crimson",
        "grafite",
        "ocean",
        "gold",
        "emerald",
        "midnight",
      ],
    },
  },
} as const;
