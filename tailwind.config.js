/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // accent + bg support Tailwind opacity modifiers (bg-accent/50, etc.)
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        // direct CSS vars (no opacity modifier needed)
        "accent-soft": "var(--accent-soft)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "border-theme": "var(--border-color)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
      },
      boxShadow: {
        glow: "var(--glow)",
      },
    },
  },
  plugins: [],
};
