import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Soehne for body text (sans-serif)
        sans: ["Soehne", "var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        // Tiempos for headings (serif)
        serif: ["Tiempos Text", "Georgia", "Times New Roman", "serif"],
        // Soehne Breit for special display
        display: ["Soehne Breit", "Soehne", "var(--font-inter)", "system-ui", "sans-serif"],
        // Mono unchanged
        mono: ["SF Mono", "Fira Code", "Consolas", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Liberation Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // INKRA Design System - 4-Color Pen
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
          90: "var(--ink-90)",
          80: "var(--ink-80)",
          70: "var(--ink-70)",
          60: "var(--ink-60)",
          50: "var(--ink-50)",
          20: "var(--ink-20)",
          12: "var(--ink-12)",
          "08": "var(--ink-08)",
        },
        paper: {
          DEFAULT: "var(--paper)",
          warm: "var(--paper-warm)",
          dim: "var(--paper-dim)",
        },
        "ink-blue": {
          DEFAULT: "var(--ink-blue)",
          mid: "var(--ink-blue-mid)",
          light: "var(--ink-blue-light)",
          wash: "var(--ink-blue-wash)",
          ghost: "var(--ink-blue-ghost)",
        },
        "ink-red": {
          DEFAULT: "var(--ink-red)",
          wash: "var(--ink-red-wash)",
        },
        "ink-green": {
          DEFAULT: "var(--ink-green)",
          wash: "var(--ink-green-wash)",
        },
        "ink-amber": {
          DEFAULT: "var(--ink-amber)",
          wash: "var(--ink-amber-wash)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        // INKRA radii
        r6: "6px",
        r10: "10px",
        r14: "14px",
      },
      boxShadow: {
        // INKRA shadows
        "inkra-sm": "var(--shadow-sm)",
        "inkra-md": "var(--shadow-md)",
        "inkra-lg": "var(--shadow-lg)",
      },
      spacing: {
        // INKRA spacing scale (8pt base + 4pt micro)
        s2: "2px",
        s4: "4px",
        s6: "6px",
        s8: "8px",
        s10: "10px",
        s12: "12px",
        s14: "14px",
        s16: "16px",
        s18: "18px",
        s20: "20px",
        s24: "24px",
        s32: "32px",
        s40: "40px",
        s48: "48px",
        s64: "64px",
        s80: "80px",
        s96: "96px",
      },
      maxWidth: {
        inkra: "1120px",
      },
      transitionTimingFunction: {
        "ease-out": "var(--ease-out)",
        "ease-soft": "var(--ease-soft)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "recording-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 2px var(--ink-red), 0 0 0 6px rgba(179,71,71,0.15)" },
          "50%": { boxShadow: "0 0 0 2px var(--ink-red), 0 0 0 14px rgba(179,71,71,0.08)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "spin-slow": "spin-slow 2s linear infinite",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "recording-pulse": "recording-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
