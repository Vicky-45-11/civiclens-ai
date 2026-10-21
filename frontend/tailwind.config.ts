import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f7f4ee",
        ink: { DEFAULT: "#14233a", soft: "#3d4c63", mute: "#6b778a" },
        civic: { DEFAULT: "#0f6e68", dark: "#0a4f4b", light: "#d9efec" },
        signal: { DEFAULT: "#e8892b", light: "#fdebd3" },
        line: "#ddd7ca",
      },
      fontFamily: {
        display: ["'Fraunces Variable'", "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["'Inter Variable'", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: { card: "0 1px 0 rgba(20,35,58,0.04), 0 8px 24px -12px rgba(20,35,58,0.18)" },
    },
  },
  plugins: [],
} satisfies Config;
