"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "diu"

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
    cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = "diu-pre-reg-theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // Read stored theme from localStorage on client mount
        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
            if (savedTheme && (savedTheme === "light" || savedTheme === "dark" || savedTheme === "diu")) {
                setThemeState(savedTheme)
                applyThemeClass(savedTheme)
            } else {
                // Check system preference for dark mode default
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
                const initialTheme = prefersDark ? "dark" : "light"
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
        if (theme === "light") setTheme("dark")
        else if (theme === "dark") setTheme("diu")
        else setTheme("light")
    }

    return (
        <ThemeContext.Provider value={{ theme: mounted ? theme : "light", setTheme, cycleTheme }}>
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
