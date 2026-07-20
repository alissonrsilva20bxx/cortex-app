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

export const DEFAULT_THEME: Theme = "grafite";
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
