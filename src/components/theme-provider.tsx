"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "diu" | "dark"

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
    cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = "diu-pre-reg-theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("diu")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // Read stored theme from localStorage on client mount
        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as string | null
            if (savedTheme === "dark" || savedTheme === "diu") {
                setThemeState(savedTheme as Theme)
                applyThemeClass(savedTheme as Theme)
            } else if (savedTheme === "light") {
                // Migrate previously saved Day mode to DIU mode
                setThemeState("diu")
                applyThemeClass("diu")
                localStorage.setItem(THEME_STORAGE_KEY, "diu")
            } else {
                // Check system preference for dark mode default, otherwise DIU mode
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
                const initialTheme: Theme = prefersDark ? "dark" : "diu"
                setThemeState(initialTheme)
                applyThemeClass(initialTheme)
            }
        } catch {
            // Ignore storage errors
        }
        setMounted(true)
    }, [])

    const applyThemeClass = (newTheme: Theme) => {
        const root = document.documentElement
        root.classList.remove("light", "dark", "diu")
        root.classList.add(newTheme)
        root.setAttribute("data-theme", newTheme)
    }

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        applyThemeClass(newTheme)
        try {
            localStorage.setItem(THEME_STORAGE_KEY, newTheme)
        } catch {
            // Ignore storage errors
        }
    }

    const cycleTheme = () => {
        setTheme(theme === "diu" ? "dark" : "diu")
    }

    return (
        <ThemeContext.Provider value={{ theme: mounted ? theme : "diu", setTheme, cycleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }
    return context
}
