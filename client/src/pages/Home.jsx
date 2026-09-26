// ---------------------------------------------------------------------------
// PAGE: Landing page - create a new watch-party room or join one with a code.
// Visual style: bold display headline on the left ("EVERYONE HITS PLAY AT
// ONCE."), a create/join card on the right, dark theme with an orange accent.
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserId } from '../identity';
import { PlayIcon } from '../icons';
import ThemeToggle from '../components/ThemeToggle';
import Footer from '../components/Footer';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('create'); // 'create' | 'join' - which tab is active
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // FUNCTION: calls the REST API to create a room, then navigates into it
  const createRoom = async () => {
    if (!username.trim()) return setError('Enter your name first');
    setCreating(true);
    setError('');

    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId() }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Could not create room');

      localStorage.setItem('username', username.trim());
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      console.error('create room failed:', err);
      setError('Could not reach the server');
    } finally {
      setCreating(false);
    }
  };

  // FUNCTION: no REST call needed to join - Room.jsx validates the code via socket
  const joinRoom = () => {
    if (!username.trim()) return setError('Enter your name first');
    if (!code.trim()) return setError('Enter a room code');

    localStorage.setItem('username', username.trim());
    navigate(`/room/${code.trim().toUpperCase()}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'create') createRoom();
    else joinRoom();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-ink-900 dark:bg-ink-950 dark:text-white">
      {/* Top bar: logo + live status + theme toggle */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-ink-700">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-white">
            <PlayIcon className="h-4 w-4" />
          </span>
          <span className="font-display text-lg tracking-wide">
            SYNC<span className="text-brand-500">//</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            LIVE SYNC READY
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero: grid backdrop, big headline left, create/join card right.
          flex-1 + min-h-0 makes this fill exactly the space left between the
          header and footer (both fixed-height), so the whole page fits one
          screen with no scrolling. overflow-y-auto is just a safety net for
          very short screens where the content genuinely doesn't fit. */}
      <main className="bg-grid flex min-h-0 flex-1 items-center overflow-y-auto px-6 py-6 md:px-10">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          {/* Left column: headline + description + steps */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-500">
              <span className="h-px w-8 bg-brand-500" />
              Shared screen, shared moment
            </div>

            <h1 className="font-display text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
              EVERYONE
              <br />
              HITS
              <br />
              <span className="text-brand-500">PLAY</span> AT
              <br />
              ONCE.
            </h1>

            <p className="mt-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
              A focused YouTube room where one timeline stays in sync. Hosts lead, moderators help,
              everyone watches together.
            </p>
          </div>

          {/* Right column: create/join card */}
          <div className="flex items-center justify-center lg:justify-end">
            <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg
                       dark:border-ink-700 dark:bg-ink-900"
          >
            {/* Tab switcher */}
            <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 text-sm font-medium dark:border-ink-700">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-2 transition ${
                  mode === 'create'
                    ? 'bg-brand-500 text-white'
                    : 'bg-transparent text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-ink-800'
                }`}
              >
                Create room
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`py-2 transition ${
                  mode === 'join'
                    ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                    : 'bg-transparent text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-ink-800'
                }`}
              >
                Join room
              </button>
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {mode === 'create' ? 'Start a new session' : 'Enter a session'}
            </p>
            <h2 className="mb-6 mt-1 font-display text-2xl">
              {mode === 'create' ? 'Open the room.' : 'Join the room.'}
            </h2>

            <label className="mb-4 block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Display name</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="How people will see you"
                maxLength={20}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none
                           focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                           dark:border-ink-700 dark:bg-ink-800 dark:text-white dark:focus:ring-brand-900"
              />
            </label>

            {mode === 'join' && (
              <label className="mb-4 block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Room code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. F336E5"
                  maxLength={6}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase tracking-widest outline-none
                             focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                             dark:border-ink-700 dark:bg-ink-800 dark:text-white dark:focus:ring-brand-900"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-brand-500 py-3 text-sm font-bold uppercase tracking-wide text-white
                         shadow transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === 'create' ? (creating ? 'Creating…' : 'Create watch room') : 'Join watch room'}
            </button>

            {error && <p className="mt-3 text-xs font-medium text-red-500">{error}</p>}

            <p className="mt-4 text-xs text-gray-400">
              {mode === 'create'
                ? 'No account needed. Your room code is the invite.'
                : 'Ask the host for their 6-character room code.'}
            </p>
          </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Home;
