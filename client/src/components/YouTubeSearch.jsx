// ---------------------------------------------------------------------------
// FEATURE: In-app YouTube search - explicit "Search" button (not live/debounced
// search), so results only load when the user actually asks for them.
// This calls OUR OWN server (/api/youtube/search), which in turn calls the
// official YouTube Data API v3 "search" endpoint with type=video - so every
// result here is a real YouTube video, never any other platform's content.
// If results ever look wrong, check that YOUTUBE_API_KEY is set correctly
// in server/.env (a missing/invalid key shows the error text below, it does
// not silently fall back to any other source).
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { SearchIcon, XIcon, PlayIcon, HandRaisedIcon } from '../icons';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

function YouTubeSearch({ canControl, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false); // have we searched at least once?

  // FUNCTION: runs on submit (Search button click OR pressing Enter in the input)
  const runSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/youtube/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results || []);
    } catch (err) {
      console.error('YouTube search failed:', err);
      setError('Could not search YouTube right now (check YOUTUBE_API_KEY on the server)');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-ink-700 dark:bg-ink-800/60">
      <form onSubmit={runSearch} className="flex shrink-0 gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none
                       focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                       dark:border-ink-700 dark:bg-ink-900 dark:text-white dark:focus:ring-brand-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white
                     transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '…' : 'Search'}
        </button>
        {/* Closes the whole search panel (handled by the parent, Player.jsx) */}
        <button
          type="button"
          onClick={onClose}
          title="Close search"
          className="flex shrink-0 items-center justify-center rounded-lg border border-gray-300 px-3 text-gray-500
                     transition hover:bg-gray-100 dark:border-ink-600 dark:text-gray-400 dark:hover:bg-ink-700"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </form>

      {error && <p className="shrink-0 text-xs text-red-500">{error}</p>}
      {searched && !loading && !error && results.length === 0 && (
        <p className="shrink-0 text-xs text-gray-400">No results found.</p>
      )}

      {results.length > 0 && (
        <ul className="thin-scrollbar flex max-h-64 min-h-0 flex-col gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-ink-700 dark:bg-ink-900">
          {results.map((r) => (
            <li
              key={r.videoId}
              className="flex items-center gap-3 rounded-md p-2 hover:bg-gray-50 dark:hover:bg-ink-800"
            >
              <img
                src={r.thumbnail}
                alt=""
                className="h-12 w-20 shrink-0 rounded-md object-cover"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{r.title}</p>
                <p className="truncate text-xs text-gray-400">{r.channelTitle}</p>
              </div>

              {/* Host/Moderator plays immediately, Participant sends a request -
                  same behavior as before, just a labeled button instead of an icon */}
              <button
                onClick={() => onSelect(r.videoId)}
                title={canControl ? 'Play this video now' : 'Request to play this video'}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition ${
                  canControl
                    ? 'bg-brand-500 hover:bg-brand-600'
                    : 'bg-gray-400 hover:bg-gray-500 dark:bg-ink-600 dark:hover:bg-ink-500'
                }`}
              >
                {canControl ? <PlayIcon className="h-3.5 w-3.5" /> : <HandRaisedIcon className="h-3.5 w-3.5" />}
                {canControl ? 'Play' : 'Request'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default YouTubeSearch;
