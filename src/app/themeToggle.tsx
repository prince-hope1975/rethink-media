"use client";
import { useTheme } from "next-themes";
import React from "react";
export function DarkModeToggle() {
    const { theme, setTheme } = useTheme();
    return (
      <button
        style={{ position: "fixed", top: 16, right: 16, zIndex: 1000 }}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle dark mode"
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </button>
    );
  }