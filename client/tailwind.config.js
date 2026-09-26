/** @type {import('tailwindcss').Config} */
export default {
  // Class-based dark mode: we toggle a "dark" class on <html> ourselves
  // (see src/theme.js). The reference design is dark-first, so dark mode
  // is the default theme on first visit.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand accent: the orange/red used for the logo, primary buttons,
        // "PLAY" highlight word, and live-status indicators.
        brand: {
          50: '#fff1ec',
          100: '#ffe0d3',
          400: '#ff7a52',
          500: '#ff5a2e',
          600: '#ff4419',
          700: '#e0350f',
        },
        // Near-black app background + slightly-lighter panel surfaces,
        // used for the dark theme (SYNC// look).
        ink: {
          950: '#0c0a09',
          900: '#131110',
          800: '#1c1917',
          700: '#292420',
          600: '#3a332c',
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', 'Arial Black', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
