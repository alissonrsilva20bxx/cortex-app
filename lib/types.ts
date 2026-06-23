export interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  due: string;
  project: string;
}

export interface Project {
  id: string;
  title: string;
  progress: number;
  stage: string;
}

export interface FinanceMetric {
  id: string;
  label: string;
  value: string;
  trend: string;
  note: string;
}

export interface ActivityEvent {
  id: string;
  event: string;
  time: string;
  type: 'update' | 'capture' | 'finance';
}

export interface DashboardData {
  ideas: Idea[];
  tasks: Task[];
  projects: Project[];
  finance: FinanceMetric[];
  activity: ActivityEvent[];
}
