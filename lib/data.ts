import { DashboardData } from './types';

export const dashboardData: DashboardData = {
  ideas: [
    {
      id: 'idea-1',
      title: 'Fluxo de conteúdos',
      description: 'Escrever um roteiro de vídeo sobre organização pessoal e produtividade.',
      category: 'Criatividade',
    },
    {
      id: 'idea-2',
      title: 'Startup interna',
      description: 'Proposta de software para consultoria e automação de processos.',
      category: 'Negócios',
    },
    {
      id: 'idea-3',
      title: 'Experimento de hábitos',
      description: 'Teste de rotina semanal com revisões diárias e notas rápidas.',
      category: 'Pessoal',
    },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Planejar sprint semanal',
      status: 'Em andamento',
      due: 'Hoje',
      project: 'Operações',
    },
    {
      id: 'task-2',
      title: 'Revisar OKRs da empresa',
      status: 'Próximo',
      due: 'Amanhã',
      project: 'Estratégia',
    },
    {
      id: 'task-3',
      title: 'Enviar relatório financeiro',
      status: 'Hoje',
      due: 'Agora',
      project: 'Finanças',
    },
  ],
  projects: [
    {
      id: 'project-1',
      title: 'Nova interface de vendas',
      progress: 68,
      stage: 'Design',
    },
    {
      id: 'project-2',
      title: 'Portal de aprendizado',
      progress: 42,
      stage: 'Construção',
    },
  ],
  finance: [
    {
      id: 'finance-1',
      label: 'Receita mensal',
      value: 'R$ 38.400',
      trend: '+12%',
      note: 'Receita acima da meta em 2% este mês.',
    },
    {
      id: 'finance-2',
      label: 'Despesas',
      value: 'R$ 16.200',
      trend: '-3%',
      note: 'Controle de custos funcionando melhor que o planejado.',
    },
    {
      id: 'finance-3',
      label: 'Fluxo de caixa',
      value: 'R$ 22.200',
      trend: '+8%',
      note: 'Sólido para investimentos de curto prazo.',
    },
  ],
  activity: [
    {
      id: 'activity-1',
      event: 'Atualizado board de tarefas',
      time: 'há 10 min',
      type: 'update',
    },
    {
      id: 'activity-2',
      event: 'Nova ideia capturada',
      time: 'há 27 min',
      type: 'capture',
    },
    {
      id: 'activity-3',
      event: 'Relatório financeiro enviado',
      time: 'há 1h',
      type: 'finance',
    },
  ],
};

export const initialDashboardData = dashboardData;
