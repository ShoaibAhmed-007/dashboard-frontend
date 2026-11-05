"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  // The inline script in <head> already applied the "dark" class before
  // hydration, so read it back instead of defaulting to "light" here —
  // otherwise React's first render would briefly flip the theme again.
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const applyTheme = useCallback((next: Theme, animate: boolean) => {
    const root = document.documentElement;

    if (animate) {
      // Briefly enable a transition just for the toggle, then remove it so
      // it never affects normal interactions (hover states, etc.).
      root.classList.add("theme-transition");
      window.setTimeout(() => root.classList.remove("theme-transition"), 300);
    }

    root.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }, []);

  useEffect(() => {
    // Keep in sync if the theme is changed in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme" && (e.newValue === "light" || e.newValue === "dark")) {
        applyTheme(e.newValue, false);
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyTheme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const next = prevTheme === "light" ? "dark" : "light";
      applyTheme(next, true);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
