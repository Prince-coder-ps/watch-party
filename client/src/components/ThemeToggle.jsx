// ---------------------------------------------------------------------------
// FEATURE: Light/dark mode toggle button, shown in the top bar of every page.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { getInitialTheme, applyTheme } from '../theme';

function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  // Re-apply whenever the theme state changes (and persist it)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label="Toggle theme"
      title="Toggle theme"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200
                 bg-white text-lg shadow-sm transition hover:bg-gray-50
                 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default ThemeToggle;
