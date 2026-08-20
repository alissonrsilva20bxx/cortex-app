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

// layout.tsx's head script already corrects <html data-theme> from
// localStorage before paint. Reading that attribute back here (instead of
// always starting from DEFAULT_THEME) means the [theme] effect below
// re-applies the value that's already on the DOM instead of stomping it
// back to the SSR default for one commit — that stomp-then-correct is what
// used to flash the real theme to DEFAULT_THEME right after hydration.
function readInitialTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute("data-theme");
  return attr && (THEMES as readonly string[]).includes(attr as Theme)
    ? (attr as Theme)
    : DEFAULT_THEME;
}

function readInitialMode(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-mode") === "light"
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // localStorage is written only from the setTheme/setMode wrappers — i.e.
  // only in response to an explicit user action, never from a
  // [theme]/[mode]-dependent effect. That effect pattern used to race
  // itself: with React Strict Mode's double effect invocation in dev, a
  // write-effect's first pass ran with the still-default state and
  // stomped the real stored value before a separate read-effect's setState
  // could land, silently resetting the theme on every reload. Decoupling
  // "persist" from "state changed" removes the race.
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);
  const [mode, setModeState] = useState<"dark" | "light">(readInitialMode);

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
