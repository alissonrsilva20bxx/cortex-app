import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'ProjetoApp | Meu OS Pessoal',
  description: 'Plataforma de vida, empresa, ideias, estudos, projetos, finanças e tarefas em um único lugar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
