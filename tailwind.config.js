/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#16161a',
          sidebar: '#121214',
          card: '#1e1e24',
          border: '#2a2a32',
          hover: '#262630',
          accent: '#7c3aed',
          text: '#f4f4f6',
          muted: '#94a1b2'
        }
      }
    },
  },
  plugins: [],
};
