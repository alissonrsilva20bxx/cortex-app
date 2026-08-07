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

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  return stored && (THEMES as readonly string[]).includes(stored)
    ? stored
    : DEFAULT_THEME;
}

function readStoredMode(): "dark" | "light" {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // State starts at the same default the server rendered (localStorage
  // isn't readable during SSR), then a mount-only effect below corrects it
  // from the real stored value. localStorage is written only from the
  // setTheme/setMode wrappers — i.e. only in response to an explicit user
  // action, never from a [theme]/[mode]-dependent effect. That effect
  // pattern used to race itself: with React Strict Mode's double effect
  // invocation in dev, a write-effect's first pass ran with the
  // still-default state and stomped the real stored value before a
  // separate read-effect's setState could land, silently resetting the
  // theme on every reload. Decoupling "persist" from "state changed"
  // removes the race, and starting from the SSR default avoids a
  // hydration mismatch in anything that renders conditionally on theme.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mode, setModeState] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setThemeState(readStoredTheme());
    setModeState(readStoredMode());
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function setMode(next: "dark" | "light") {
    setModeState(next);
    localStorage.setItem(MODE_STORAGE_KEY, next);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (mode === "light") {
      document.documentElement.setAttribute("data-mode", "light");
    } else {
      document.documentElement.removeAttribute("data-mode");
    }
  }, [mode]);

  // Sem isso, a barra de status/área segura do Safari fica sempre preta
  // (o valor fixo do <meta name="theme-color">), mesmo em temas claros —
  // lê a cor de fundo já resolvida pelo tema/modo ativos, mesma fonte que
  // o resto do app usa, então nunca dessincroniza.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    if (bg) meta.setAttribute("content", bg);
  }, [theme, mode]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
