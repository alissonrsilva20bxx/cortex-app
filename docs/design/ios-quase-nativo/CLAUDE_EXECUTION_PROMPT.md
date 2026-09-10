# Prompt canônico para implementação pelo Claude

Cole este texto numa sessão nova somente depois que os bugs atuais terminarem e T0 estiver preenchido com um SHA limpo.

---

Retome o JobApp seguindo integralmente o contrato em `docs/design/ios-quase-nativo/`.

Leia, antes de agir:

1. `README.md`
2. `DESIGN_SYSTEM.md`
3. `IMPLEMENTATION_MAP.md`
4. `QA_CHECKLIST.md`
5. os seis PNGs em `mockups/`

Objetivo: implementar o redesign “iOS quase nativo” aprovado, preservando todas as funções, regras, dados e proteções atuais. A narrativa do produto é organização → renda → liberdade → viagem. O visual usa vinho/preto com rosa para ação e progresso. A barra inferior mantém o modelo atual inspirado no Instagram, mas passa a ter apenas Início, Agenda, Financeiro, Cofre e Rede. Ajustes abre pelo avatar.

Regras obrigatórias:

- Você é o único escritor do código desta etapa. Agentes GPT serão somente revisores.
- Não comece se `IMPLEMENTATION_MAP.md` ainda tiver o SHA de T0 como PENDENTE, se o working tree estiver sujo ou se houver trabalho de bugs concorrente.
- Crie um worktree e branch isolados a partir do SHA aprovado.
- Execute T2–T8 primeiro: protótipo em `app/dev-preview/ios/page.tsx` e `components/ios-prototype/**`, com estilos locais.
- Não altere as áreas protegidas durante o protótipo.
- Os mockups são autoridade visual e de hierarquia, não de dados. Não invente funcionalidades nem hardcode dados na aplicação real.
- Preserve autenticação, onboarding, PIN, Cofre, Agenda, Financeiro, feed, fotos, viewer, chat, permissões e persistência.
- Não remova o FAB até mapear e realocar todos os callbacks que ele representa.
- Não remova temas existentes sem decisão explícita.
- Não toque em produção, Supabase, migrations, policies, buckets, secrets, Vercel, `master`, retenção, cron ou fila.
- Ao terminar T8, gere as evidências do checklist e pare para aprovação humana. Não porte nada ao app real antes dessa aprovação.
- Depois da aprovação, implemente T9–T13 em fatias pequenas, com testes por fatia.
- Não faça merge nem deploy sem autorização explícita.

Antes de qualquer edição, reporte:

1. SHA e branch-base detectados;
2. confirmação de working tree limpo;
3. worktree/branch novos;
4. inventário dos arquivos que pretende tocar na primeira etapa;
5. riscos ou divergências entre o código atual e este contrato.

Durante o trabalho, mantenha um log curto por etapa: arquivos, decisões, testes, evidências e pendências. Se encontrar conflito funcional ou informação ausente, pare antes de ampliar o escopo.

---

