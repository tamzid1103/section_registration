"use client"

import { useTheme, Theme } from "@/components/theme-provider"
import { Sun, Moon, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ThemeToggleProps {
    variant?: "compact" | "pills" | "dropdown"
    className?: string
}

export function ThemeToggle({ variant = "pills", className = "" }: ThemeToggleProps) {
    const { theme, setTheme, cycleTheme } = useTheme()

    const themes: { id: Theme; label: string; icon: React.ComponentType<{ className?: string }>; activeColor: string }[] = [
        { id: "light", label: "Day", icon: Sun, activeColor: "bg-background text-foreground shadow-xs border border-border/80 font-medium" },
        { id: "dark", label: "Night", icon: Moon, activeColor: "bg-background text-foreground shadow-xs border border-border/80 font-medium" },
        { id: "diu", label: "DIU", icon: GraduationCap, activeColor: "bg-emerald-600 text-white shadow-xs font-semibold" },
    ]

    if (variant === "compact") {
        const current = themes.find(t => t.id === theme) || themes[0]
        const Icon = current.icon
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={cycleTheme}
                title={`Current Theme: ${current.label} (Click to switch)`}
                className={`h-8 px-2.5 rounded-lg border border-border text-foreground hover:bg-muted/70 flex items-center gap-1.5 text-xs font-medium transition-all ${className}`}
            >
                <Icon className="w-3.5 h-3.5" />
                <span>{current.label}</span>
            </Button>
        )
    }

    return (
        <div className={`inline-flex items-center p-0.5 rounded-lg border border-border bg-muted/60 shadow-2xs ${className}`}>
            {themes.map(t => {
                const Icon = t.icon
                const isActive = theme === t.id
                return (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all duration-150 ${
                            isActive
                                ? t.activeColor
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        }`}
                        title={`Switch to ${t.label} Mode`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
