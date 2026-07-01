"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  MODE_STORAGE_KEY,
  THEMES,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  mode: "dark" | "light";
  setMode: (mode: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  mode: "dark",
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mode, setModeState] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (storedTheme && (THEMES as readonly string[]).includes(storedTheme)) {
      setThemeState(storedTheme);
    }
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    if (storedMode === "light" || storedMode === "dark") {
      setModeState(storedMode as "dark" | "light");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (mode === "light") {
      document.documentElement.setAttribute("data-mode", "light");
    } else {
      document.documentElement.removeAttribute("data-mode");
    }
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme: setThemeState, mode, setMode: setModeState }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
