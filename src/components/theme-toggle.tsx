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
        { id: "light", label: "Day", icon: Sun, activeColor: "bg-amber-500 text-white shadow-sm" },
        { id: "dark", label: "Night", icon: Moon, activeColor: "bg-blue-600 text-white shadow-sm" },
        { id: "diu", label: "DIU", icon: GraduationCap, activeColor: "bg-emerald-600 text-amber-300 font-black shadow-sm" },
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
                className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-all ${className}`}
            >
                <Icon className="w-3.5 h-3.5" />
                <span>{current.label}</span>
            </Button>
        )
    }

    return (
        <div className={`inline-flex items-center p-0.5 rounded-xl border border-slate-200/80 bg-slate-100/80 dark:bg-slate-900/80 dark:border-slate-800 diu:bg-[#07162C]/90 diu:border-[#133E87]/60 shadow-2xs ${className}`}>
            {themes.map(t => {
                const Icon = t.icon
                const isActive = theme === t.id
                return (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            isActive
                                ? t.activeColor
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 diu:text-slate-300 diu:hover:text-amber-200"
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
