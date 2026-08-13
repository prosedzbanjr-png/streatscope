"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try { localStorage.setItem("streetscope-theme", theme); } catch {}
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const active = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(active);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      title={isDark ? "Jasny motyw" : "Ciemny motyw"}
    >
      <span className="theme-toggle-icon" aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      <span className="theme-toggle-label">{isDark ? "JASNY" : "CIEMNY"}</span>
    </button>
  );
}
