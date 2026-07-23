"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: string | string[];
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  enableColorScheme?: boolean;
  storageKey?: string;
  themes?: string[];
  forcedTheme?: string | null;
  value?: Record<string, string>;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  forcedTheme?: string | null;
  resolvedTheme: string | undefined;
  themes: string[];
  systemTheme?: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(
  theme: string,
  attribute: string | string[],
  value?: Record<string, string>,
  enableColorScheme?: boolean,
) {
  const root = document.documentElement;
  const resolved = value?.[theme] ?? theme;
  const attrs = Array.isArray(attribute) ? attribute : [attribute];
  for (const attr of attrs) {
    if (attr === "class") {
      const classes = value ? Object.values(value) : ["light", "dark"];
      root.classList.remove(...classes);
      root.classList.add(resolved);
    } else {
      root.setAttribute(attr, resolved);
    }
  }
  if (enableColorScheme) {
    root.style.colorScheme = resolved === "dark" ? "dark" : "light";
  }
}

function getStoredTheme(storageKey: string, fallback: Theme): Theme {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {}
  return fallback;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({
  children,
  attribute = "data-theme",
  defaultTheme = "system",
  disableTransitionOnChange = false,
  enableColorScheme = true,
  storageKey = "theme",
  themes = ["light", "dark"],
  forcedTheme,
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme(storageKey, defaultTheme));
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(getSystemTheme);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {}
    },
    [storageKey],
  );

  useEffect(() => {
    const t = forcedTheme ?? resolvedTheme;
    applyTheme(t, attribute, value, enableColorScheme);
  }, [resolvedTheme, forcedTheme, attribute, value, enableColorScheme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        setThemeState(e.newValue as Theme);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  useEffect(() => {
    if (!disableTransitionOnChange) return;
    const css = document.createElement("style");
    css.appendChild(
      document.createTextNode(
        "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;transition:none!important}",
      ),
    );
    document.head.appendChild(css);
    const timeout = setTimeout(() => css.remove(), 1);
    return () => {
      clearTimeout(timeout);
      css.remove();
    };
  }, [theme, disableTransitionOnChange]);

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      forcedTheme: forcedTheme ?? null,
      resolvedTheme: forcedTheme ?? resolvedTheme,
      themes: ["system", ...themes],
      systemTheme,
    }),
    [theme, setTheme, forcedTheme, resolvedTheme, themes, systemTheme],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system" as Theme,
      setTheme: (_: Theme) => {},
      forcedTheme: null,
      resolvedTheme: undefined,
      themes: ["light", "dark"],
      systemTheme: undefined,
    };
  }
  return ctx;
}
