import { Moon, Sparkles, Sun } from "lucide-react";
import { cn } from "../lib/utils";

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "dracula", label: "Dracula", icon: Sparkles },
];

export default function ThemeSwitcher({
  value = "dark",
  onChange,
  compact = false,
  className,
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-sm",
        className
      )}
      role="group"
      aria-label="Color theme"
    >
      {THEMES.map((theme) => {
        const Icon = theme.icon;
        const active = value === theme.id;

        return (
          <button
            key={theme.id}
            type="button"
            aria-pressed={active}
            title={`${theme.label} theme`}
            onClick={() => onChange?.(theme.id)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              compact && "w-8 px-0"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className={compact ? "sr-only" : "hidden sm:inline"}>
              {theme.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
