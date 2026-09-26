// ---------------------------------------------------------------------------
// FEATURE: Light/dark theme persistence, using Tailwind's "class" dark mode
// strategy (adds/removes a "dark" class on <html>). The app is dark-first
// (matches the SYNC// visual design) but a person can still switch to light.
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'theme';

// FUNCTION: read the saved theme, defaulting to dark on a first-ever visit
export function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

// FUNCTION: apply the theme to the whole document and remember the choice
export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(STORAGE_KEY, theme);
}
