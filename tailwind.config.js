/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // accent + bg support Tailwind opacity modifiers (bg-accent/50, etc.)
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        // semantic colors — opacity modifiers supported (bg-success/10, etc.)
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        info: "rgb(var(--info-rgb) / <alpha-value>)",
        // direct CSS vars (no opacity modifier needed)
        "accent-soft": "var(--accent-soft)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "border-theme": "var(--border-color)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-muted": "var(--text-muted)",
      },
      boxShadow: {
        glow: "var(--glow)",
      },
    },
  },
  plugins: [],
};
