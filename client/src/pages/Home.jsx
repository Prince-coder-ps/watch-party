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
          IMPORTANT: no `items-center` on this flex container - centering a
          child that's TALLER than the viewport (common on short mobile
          screens) makes the browser clip whatever overflows above center and
          that clipped part (the headline, since it's topmost) becomes
          unreachable even with overflow-y-auto - scrollTop can't go
          negative. Centering instead happens via `my-auto` on the inner
          wrapper below: it centers only when there's slack, and otherwise
          sits at the natural top so overflow-y-auto can scroll to it. */}
      <main className="bg-grid relative flex min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10">
        {/* Soft decorative glow - purely visual, sits behind everything, never
            intercepts clicks. Fills otherwise-empty dark space with intent. */}
        <div className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-brand-500/10 blur-[120px] dark:bg-brand-500/20" />

        <div className="relative my-auto mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          {/* Left column: headline + description + steps */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-500">
              <span className="h-px w-8 bg-brand-500" />
              Shared screen, shared moment
            </div>

            <h1 className="font-display text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
              EVERYONE
              <br />
              HITS
              <br />
              <span className="text-brand-500">PLAY</span> AT
              <br />
              ONCE.
            </h1>

            <p className="mt-6 max-w-lg text-base text-gray-600 dark:text-gray-400">
              A focused YouTube room where one timeline stays in sync. Hosts lead, moderators help,
              everyone watches together.
            </p>

            {/* Bigger, icon-backed steps row - fills more of the left column
                and gives the eye something to land on below the description */}
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-gray-200 pt-8 dark:border-ink-700">
              {[
                ['01', 'Create', 'Spin up a room in one click'],
                ['02', 'Invite', 'Share the code or link'],
                ['03', 'Watch', 'Everyone stays in sync'],
              ].map(([n, label, desc]) => (
                <div key={n}>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 font-display text-base text-brand-500">
                    {n}
                  </div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: create/join card */}
          <div className="flex items-center justify-center lg:justify-end">
            <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-lg
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
