-- Rodar no Supabase SQL Editor: https://supabase.com/dashboard/project/seciereacfestemdhzhp/sql

CREATE TABLE IF NOT EXISTS public.despesas (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao  TEXT          NOT NULL,
  valor      NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  categoria  TEXT          NOT NULL DEFAULT 'outros',
  data       DATE          NOT NULL DEFAULT CURRENT_DATE,
  criado_em  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_despesas"
  ON public.despesas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
