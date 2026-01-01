import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Neumorphic specific
        neo: {
          bg: "hsl(var(--neo-bg))",
          surface: "hsl(var(--neo-surface))",
        },
        // Globe colors
        globe: {
          ocean: "hsl(var(--globe-ocean))",
          land: "hsl(var(--globe-land))",
          border: "hsl(var(--globe-border))",
          atmosphere: "hsl(var(--globe-atmosphere))",
        },
        // Player colors
        player: {
          active: "hsl(var(--player-active))",
          inactive: "hsl(var(--player-inactive))",
          progress: "hsl(var(--player-progress))",
        },
        // Genre colors
        genre: {
          pop: "hsl(var(--genre-pop))",
          rock: "hsl(var(--genre-rock))",
          jazz: "hsl(var(--genre-jazz))",
          classical: "hsl(var(--genre-classical))",
          electronic: "hsl(var(--genre-electronic))",
          hiphop: "hsl(var(--genre-hiphop))",
          country: "hsl(var(--genre-country))",
          other: "hsl(var(--genre-other))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        neo: "var(--neo-radius)",
      },
      boxShadow: {
        neo: "var(--neo-depth) var(--neo-depth) calc(var(--neo-depth) * 2) hsl(var(--neo-shadow-dark)), calc(var(--neo-depth) * -1) calc(var(--neo-depth) * -1) calc(var(--neo-depth) * 2) hsl(var(--neo-shadow-light))",
        "neo-inset": "inset var(--neo-depth-sm) var(--neo-depth-sm) calc(var(--neo-depth-sm) * 2) hsl(var(--neo-shadow-inset-dark)), inset calc(var(--neo-depth-sm) * -1) calc(var(--neo-depth-sm) * -1) calc(var(--neo-depth-sm) * 2) hsl(var(--neo-shadow-inset-light))",
        "glow-primary": "0 0 20px hsl(var(--primary) / 0.4)",
        "glow-accent": "0 0 20px hsl(var(--accent) / 0.4)",
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
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "1" },
          "100%": { transform: "scale(1.3)", opacity: "0" },
        },
        "rotate-globe": {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-ring": "pulse-ring 1.5s ease-out infinite",
        "rotate-globe": "rotate-globe 60s linear infinite",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
