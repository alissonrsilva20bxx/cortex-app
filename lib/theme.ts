export const THEMES = ["pink-neon", "purple", "crimson"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "pink-neon";
export const THEME_STORAGE_KEY = "jobapp-theme";

export const THEME_LABELS: Record<Theme, string> = {
  "pink-neon": "Pink Neon",
  purple: "Purple",
  crimson: "Crimson",
};

export const THEME_ACCENTS: Record<Theme, string> = {
  "pink-neon": "#FF2D78",
  purple: "#9B5CF6",
  crimson: "#DC143C",
};
