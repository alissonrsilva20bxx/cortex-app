/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#0f172a',
        panel: '#111827',
        border: '#1f2937',
        accent: '#38bdf8',
        accentSoft: '#cffafe',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56, 189, 248, 0.12), 0 20px 60px -30px rgba(15, 23, 42, 0.8)',
      },
    },
  },
  plugins: [],
};
