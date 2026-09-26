// ---------------------------------------------------------------------------
// FEATURE: Light/dark mode toggle button, shown in the top bar of every page.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { getInitialTheme, applyTheme } from '../theme';
import { SunIcon, MoonIcon } from '../icons';

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
                 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50
                 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}

export default ThemeToggle;
