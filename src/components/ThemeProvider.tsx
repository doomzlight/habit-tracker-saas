"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "habit-tracker-theme";

const applyThemeToRoot = (next: Theme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark", "dark");
  root.classList.add(`theme-${next}`);
  // Keep Tailwind's dark variant working for dark mode.
  if (next === "dark") root.classList.add("dark");
  root.dataset.theme = next;
  localStorage.setItem(STORAGE_KEY, next);
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme =
      stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
    setThemeState(initial);
    applyThemeToRoot(initial);
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeToRoot(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyThemeToRoot(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      mounted,
      setTheme,
      toggleTheme,
    }),
    [theme, mounted, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
};
