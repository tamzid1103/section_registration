"use client"

import { useTheme, Theme } from "@/components/theme-provider"
import { Sun, Moon, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ThemeToggleProps {
    variant?: "compact" | "pills" | "header" | "dropdown"
    className?: string
}

export function ThemeToggle({ variant = "pills", className = "" }: ThemeToggleProps) {
    const { theme, setTheme, cycleTheme } = useTheme()

    if (variant === "compact") {
        const themes = [
            { id: "light" as Theme, label: "Day", icon: Sun },
            { id: "dark" as Theme, label: "Night", icon: Moon },
            { id: "diu" as Theme, label: "DIU", icon: GraduationCap },
        ]
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

    if (variant === "header") {
        const headerThemes = [
            { id: "light" as Theme, label: "Day", icon: Sun, activeColor: "bg-white text-slate-950 font-bold shadow-xs" },
            { id: "dark" as Theme, label: "Night", icon: Moon, activeColor: "bg-slate-900 text-white font-bold border border-slate-700 shadow-xs" },
            { id: "diu" as Theme, label: "DIU", icon: GraduationCap, activeColor: "bg-emerald-600 text-white font-bold shadow-xs" },
        ]
        return (
            <div className={`inline-flex items-center p-0.5 rounded-xl border border-white/20 bg-black/25 backdrop-blur-sm shadow-xs ${className}`}>
                {headerThemes.map(t => {
                    const Icon = t.icon
                    const isActive = theme === t.id
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTheme(t.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-150 ${
                                isActive
                                    ? t.activeColor
                                    : "text-white/80 hover:text-white hover:bg-white/15 font-medium"
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

    const themes: { id: Theme; label: string; icon: React.ComponentType<{ className?: string }>; activeColor: string }[] = [
        { id: "light", label: "Day", icon: Sun, activeColor: "bg-background text-foreground shadow-xs border border-border/80 font-medium" },
        { id: "dark", label: "Night", icon: Moon, activeColor: "bg-background text-foreground shadow-xs border border-border/80 font-medium" },
        { id: "diu", label: "DIU", icon: GraduationCap, activeColor: "bg-emerald-600 text-white shadow-xs font-semibold" },
    ]

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
