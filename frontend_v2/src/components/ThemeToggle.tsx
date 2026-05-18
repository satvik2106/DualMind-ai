"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

interface ThemeToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  iconSize?: number;
}

export function ThemeToggle({ className = "", iconSize = 14, ...props }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className={`p-2 rounded-lg bg-glass-overlay border border-transparent opacity-0 ${className}`} {...props}>
        <div style={{ width: iconSize, height: iconSize }} />
      </button>
    );
  }

  const isDark = theme === "dark" || theme === "system";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`p-2 rounded-lg bg-glass-overlay text-foreground-muted border border-transparent hover:bg-glass-highlight hover:text-foreground transition-all flex items-center justify-center ${className}`}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      {...props}
    >
      {isDark ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
    </button>
  );
}
