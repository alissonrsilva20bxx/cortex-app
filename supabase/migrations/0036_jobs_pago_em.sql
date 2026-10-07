-- 0036: dia em que o dinheiro de um atendimento entrou (ordem do operador,
-- pixel do Financeiro contra o mockup normativo
-- docs/jornada/referencias/5-telas-8-temas-claro-escuro.html).
--
-- O Financeiro passa a lançar a entrada de um atendimento concluído no dia
-- do PAGAMENTO, não no dia do atendimento: o sinal pago antes, ou o
-- atendimento pago depois, entra no caixa do dia em que o dinheiro entrou.
-- null = pago no próprio dia do atendimento (o comportamento de antes, sem
-- mudar nada para quem já tem dados).
--
-- Escrita, NUNCA aplicada por agente: quem aplica é o operador.

alter table public.jobs
  add column if not exists pago_em date;

comment on column public.jobs.pago_em is
  'Dia em que o dinheiro do atendimento entrou (null = no dia do atendimento).';
