import type { Metadata } from "next";
import "../styles/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "JobApp",
  description: "Gerenciador de atendimentos e finanças.",
};

// Runs before paint to avoid theme flash
const themeScript = `
  try {
    var t = localStorage.getItem('jobapp-theme');
    var valid = ['pink-neon', 'purple', 'crimson'];
    if (t && valid.includes(t)) document.documentElement.setAttribute('data-theme', t);
  } catch(e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-theme="pink-neon">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
