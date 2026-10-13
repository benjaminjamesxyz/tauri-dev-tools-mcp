import fs from "node:fs";
import path from "node:path";

export interface UiSetupOptions {
  projectPath: string;
  framework?: "react" | "svelte";
  designSystem?: "tailwind-shadcn" | "minimal";
  includeIcons?: boolean;
}

export interface UiSetupResult {
  success: boolean;
  projectPath: string;
  createdFiles: string[];
  components: string[];
  hooks: string[];
}

export function setupTauriUi(options: UiSetupOptions): UiSetupResult {
  const {
    projectPath,
    framework = "react",
    designSystem = "tailwind-shadcn",
    includeIcons = true,
  } = options;

  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }

  const createdFiles: string[] = [];
  const components = [
    "Button",
    "Card",
    "Badge",
    "Input",
    "Titlebar",
    "Sidebar",
    "MobileNav",
    "AppLayout",
  ];
  const hooks = ["useWindowControls", "useTheme", "useIpc"];

  const writeFile = (relPath: string, content: string) => {
    const full = path.join(absPath, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content.trimStart(), "utf8");
    createdFiles.push(relPath);
  };

  // 1. src/lib/utils.ts (Utility class helper)
  writeFile("src/lib/utils.ts", `
export function cn(...inputs: Array<string | boolean | undefined | null>): string {
  return inputs.filter(Boolean).join(" ").trim();
}
`);

  // 2. src/types/ui.ts
  writeFile("src/types/ui.ts", `
export type ThemeMode = "dark" | "light" | "system";

export interface NavItem {
  id: string;
  label: string;
  iconName?: string;
  badge?: string;
}

export interface WindowControlState {
  isMaximized: boolean;
  isTauri: boolean;
}
`);

  // 3. src/styles/theme.css (Design tokens & safe areas)
  writeFile("src/styles/theme.css", `
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);

  --bg-primary: #0a0a0a;
  --bg-secondary: #171717;
  --bg-elevated: #262626;
  --border-subtle: #2e2e2e;
  --text-primary: #fafafa;
  --text-muted: #a3a3a3;
  --accent-emerald: #10b981;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f4f4f5;
  --bg-elevated: #e4e4e7;
  --border-subtle: #d4d4d8;
  --text-primary: #09090b;
  --text-muted: #71717a;
  --accent-emerald: #059669;
}
`);

  // 4. Hooks
  writeFile("src/hooks/use-window-controls.ts", `
import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isTauri = typeof window !== "undefined" && window !== null && "__TAURI_INTERNALS__" in window;

  useEffect(() => {
    if (!isTauri) return;
    const checkMaximized = async () => {
      try {
        const maximized = await getCurrentWindow().isMaximized();
        setIsMaximized(maximized);
      } catch {
        // Ignored in headless/test environments
      }
    };
    checkMaximized();
  }, [isTauri]);

  const minimize = () => isTauri && getCurrentWindow().minimize();
  const toggleMaximize = async () => {
    if (!isTauri) return;
    await getCurrentWindow().toggleMaximize();
    setIsMaximized(!isMaximized);
  };
  const close = () => isTauri && getCurrentWindow().close();

  return { isTauri, isMaximized, minimize, toggleMaximize, close };
}
`);

  writeFile("src/hooks/use-theme.ts", `
import { useState, useEffect } from "react";
import type { ThemeMode } from "../types/ui";

export function useTheme(defaultTheme: ThemeMode = "dark") {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("app-theme");
      if (saved === "light" || saved === "dark" || saved === "system") return saved;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    const active = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;

    root.setAttribute("data-theme", active);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app-theme", theme);
    }
  }, [theme]);

  return { theme, setTheme };
}
`);

  writeFile("src/hooks/use-ipc.ts", `
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useIpc<TResult, TArgs extends Record<string, unknown> = Record<string, unknown>>(
  command: string,
  fallback?: TResult
) {
  const [data, setData] = useState<TResult | undefined>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (args?: TArgs): Promise<TResult | undefined> => {
    setLoading(true);
    setError(null);

    const isTauri = typeof window !== "undefined" && window !== null && "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      setLoading(false);
      setData(fallback);
      return fallback;
    }

    try {
      const result = await invoke<TResult>(command, args);
      setData(result);
      setLoading(false);
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      setLoading(false);
      return undefined;
    }
  }, [command, fallback]);

  return { data, loading, error, execute };
}
`);

  // 5. Components: UI Primitives
  writeFile("src/components/ui/button.tsx", `
import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary: "bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-semibold shadow-sm",
    secondary: "bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700",
    ghost: "bg-transparent hover:bg-neutral-800/60 text-neutral-300 hover:text-neutral-100",
    destructive: "bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/50",
  };

  const sizes = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
`);

  writeFile("src/components/ui/card.tsx", `
import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
}

export function Card({ className, title, subtitle, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-neutral-900/60 border border-neutral-800 p-5 shadow-sm space-y-3",
        className
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="space-y-0.5">
          {title && <h3 className="text-sm font-semibold text-neutral-200 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
`);

  writeFile("src/components/ui/badge.tsx", `
import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "neutral" | "danger";
}

export function Badge({ className, variant = "neutral", children, ...props }: BadgeProps) {
  const variants = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    neutral: "bg-neutral-800 text-neutral-300 border-neutral-700",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
`);

  writeFile("src/components/ui/input.tsx", `
import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  return (
    <div className="space-y-1 w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-neutral-400">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors",
          error && "border-rose-700 focus:ring-rose-500/40 focus:border-rose-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
`);

  // 6. Components: Layouts
  writeFile("src/components/layout/titlebar.tsx", `
import React from "react";
import { useWindowControls } from "../../hooks/use-window-controls";

export interface TitlebarProps {
  title: string;
  icon?: React.ReactNode;
}

export function Titlebar({ title, icon }: TitlebarProps) {
  const { isTauri, isMaximized, minimize, toggleMaximize, close } = useWindowControls();

  return (
    <header
      data-tauri-drag-region
      className="h-10 flex items-center justify-between px-3 bg-neutral-950/90 border-b border-neutral-800/80 select-none"
    >
      <div data-tauri-drag-region className="flex items-center space-x-2 text-xs font-semibold text-neutral-300">
        {icon}
        <span data-tauri-drag-region>{title}</span>
      </div>

      <div className="flex items-center space-x-1" data-tauri-drag-region="false">
        <button
          onClick={minimize}
          aria-label="Minimize"
          className="w-7 h-7 flex items-center justify-center hover:bg-neutral-800/80 rounded text-neutral-400 hover:text-neutral-200 text-xs"
        >
          &#8211;
        </button>
        <button
          onClick={toggleMaximize}
          aria-label="Maximize"
          className="w-7 h-7 flex items-center justify-center hover:bg-neutral-800/80 rounded text-neutral-400 hover:text-neutral-200 text-xs"
        >
          {isMaximized ? "&#10065;" : "&#9633;"}
        </button>
        <button
          onClick={close}
          aria-label="Close"
          className="w-7 h-7 flex items-center justify-center hover:bg-rose-900/80 rounded text-neutral-400 hover:text-rose-200 text-xs"
        >
          &#10005;
        </button>
      </div>
    </header>
  );
}
`);

  writeFile("src/components/layout/sidebar.tsx", `
import React from "react";
import type { NavItem } from "../../types/ui";
import { cn } from "../../lib/utils";

export interface SidebarProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function Sidebar({ items, activeId, onSelect }: SidebarProps) {
  return (
    <nav className="w-56 bg-neutral-900/40 border-r border-neutral-800/80 p-3 flex flex-col space-y-1">
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
              isActive
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
            )}
          >
            <span>{item.label}</span>
            {item.badge && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
`);

  writeFile("src/components/layout/mobile-nav.tsx", `
import React from "react";
import type { NavItem } from "../../types/ui";
import { cn } from "../../lib/utils";

export interface MobileNavProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function MobileNav({ items, activeId, onSelect }: MobileNavProps) {
  return (
    <nav className="h-14 bg-neutral-950/95 border-t border-neutral-800 flex items-center justify-around px-2 pb-[var(--safe-bottom)] select-none">
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex flex-col items-center justify-center text-xs font-medium px-3 py-1 rounded-md transition-colors",
              isActive ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
`);

  writeFile("src/components/layout/app-layout.tsx", `
import React, { useState, useEffect } from "react";
import { Titlebar } from "./titlebar";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import type { NavItem } from "../../types/ui";

export interface AppLayoutProps {
  appTitle: string;
  navItems: NavItem[];
  activeNavId: string;
  onNavSelect: (id: string) => void;
  children: React.ReactNode;
}

export function AppLayout({
  appTitle,
  navItems,
  activeNavId,
  onNavSelect,
  children,
}: AppLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkViewport = () => setIsMobile(window.innerWidth < 768);
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {!isMobile && <Titlebar title={appTitle} />}

      <div className="flex-1 flex overflow-hidden">
        {!isMobile && (
          <Sidebar items={navItems} activeId={activeNavId} onSelect={onNavSelect} />
        )}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>

      {isMobile && (
        <MobileNav items={navItems} activeId={activeNavId} onSelect={onNavSelect} />
      )}
    </div>
  );
}
`);

  return {
    success: true,
    projectPath: absPath,
    createdFiles,
    components,
    hooks,
  };
}
