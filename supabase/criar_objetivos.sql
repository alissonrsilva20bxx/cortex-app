-- receitas avulsas (entradas que não são jobs)
CREATE TABLE IF NOT EXISTS public.receitas_avulsas (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao  TEXT          NOT NULL,
  valor      NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  categoria  TEXT          NOT NULL DEFAULT 'outros',
  data       DATE          NOT NULL DEFAULT CURRENT_DATE,
  criado_em  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
ALTER TABLE public.receitas_avulsas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_receitas_avulsas" ON public.receitas_avulsas FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- objetivos de vida/afazeres
CREATE TABLE IF NOT EXISTS public.objetivos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo     TEXT        NOT NULL,
  descricao  TEXT,
  categoria  TEXT        NOT NULL DEFAULT 'afazeres',
  concluido  BOOLEAN     NOT NULL DEFAULT FALSE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.objetivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_objetivos" ON public.objetivos FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
