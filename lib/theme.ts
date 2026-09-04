export const THEMES = [
  "grafite",
  "pink-neon",
  "purple",
  "crimson",
  "ocean",
  "gold",
  "emerald",
  "midnight",
] as const;
export type Theme = (typeof THEMES)[number];

// Precisa bater com o `data-theme="pink-neon"` hardcoded em `app/layout.tsx`
// (o SSR não tem acesso a localStorage, então sempre renderiza esse valor
// fixo) -- se divergir, `ThemeProvider`'s `readInitialTheme()` produz um
// hydration mismatch real em qualquer texto que exiba o nome do tema (ex.:
// "Aparência" em AjustesTab.tsx), porque o servidor usa este fallback mas o
// cliente lê de volta o atributo já correto do DOM. Achado 2026-09-04.
export const DEFAULT_THEME: Theme = "pink-neon";
export const THEME_STORAGE_KEY = "jobapp-theme";
export const MODE_STORAGE_KEY = "jobapp-mode";

export const THEME_LABELS: Record<Theme, string> = {
  grafite: "Grafite",
  "pink-neon": "Pink",
  purple: "Purple",
  crimson: "Crimson",
  ocean: "Ocean",
  gold: "Gold",
  emerald: "Emerald",
  midnight: "Midnight",
};

export const THEME_ACCENTS: Record<Theme, string> = {
  grafite: "#a1a1aa",
  "pink-neon": "#FF2D78",
  purple: "#9B5CF6",
  crimson: "#DC143C",
  ocean: "#00CED1",
  gold: "#F59E0B",
  emerald: "#10B981",
  midnight: "#6366F1",
};
