// ---------------------------------------------------------------------------
// FEATURE: YouTube IFrame Player wrapper with server-driven synchronization.
//
// Key ideas (see inline comments below for detail):
//  - The server is the single source of truth for playback state; this
//    component only ever *reflects* what the server says, it never assumes.
//  - Native YouTube controls are disabled; we use our own buttons so every
//    action goes through the socket instead of directly touching the player
//    (this avoids "echo loops" where our own playVideo() call re-triggers
//    another sync event).
//  - Browsers block programmatic playVideo() until a real user gesture
//    happens, so we gate playback behind a "Click to join playback" button.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import YouTubeSearch from './YouTubeSearch';
import { PlayIcon, PauseIcon, SearchIcon } from '../icons';

let apiPromise; // load the YouTube <script> only once for the whole app

function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  });
  return apiPromise;
}

// FUNCTION: project the position forward by however long it's been
// since the server sent this state (so late joiners land in the right spot)
function expectedTime(s) {
  if (s.playState !== 'playing') return s.currentTime;
  return s.currentTime + (Date.now() - s.receivedAt) / 1000;
}

function formatTime(sec) {
  const s = Math.floor(sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// FUNCTION: plain-language meaning of YouTube's onError codes
function errorMessageFor(code) {
  switch (code) {
    case 2:
      return 'Invalid video ID';
    case 5:
      return 'This video cannot be played here';
    case 100:
      return 'Video not found or has been removed';
    case 101:
    case 150:
      return "This video's owner has disabled embedding";
    default:
      return 'Could not play this video';
  }
}

function Player({ sync, canControl }) {
  const targetRef = useRef(null);
  const playerRef = useRef(null);
  const loadedVideoRef = useRef(null);
  const syncRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false); // has the user given a play gesture yet?
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // is the "search YouTube" panel expanded?
  const [buffering, setBuffering] = useState(false);
  const [playerError, setPlayerError] = useState('');

  // STEP 1: create the YT.Player instance once on mount.
  // YT.Player replaces its target element with an <iframe>, so we hand it a
  // plain div instead of letting React manage that DOM node directly.
  useEffect(() => {
    let cancelled = false;
    const mount = document.createElement('div');
    targetRef.current.appendChild(mount);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mount, {
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onStateChange: (e) => {
            // Buffering is used only for a UI badge, it never triggers a sync event
            setBuffering(e.data === YT.PlayerState.BUFFERING);
          },
          onError: (e) => {
            console.error('YouTube player error code:', e.data);
            setPlayerError(errorMessageFor(e.data));
          },
          onAutoplayBlocked: () => {
            // Browser blocked playback - ask the user for a fresh click
            setUnlocked(false);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (playerRef.current) playerRef.current.destroy();
      playerRef.current = null;
      loadedVideoRef.current = null;
      setReady(false);
      mount.remove();
    };
  }, []);

  // STEP 2: remember the server's latest state, stamped with when we got it
  useEffect(() => {
    if (sync) syncRef.current = { ...sync, receivedAt: Date.now() };
  }, [sync]);

  // STEP 3: apply the server's state to the actual YouTube player
  useEffect(() => {
    const s = syncRef.current;
    if (!ready || !s || !s.videoId) return;
    const player = playerRef.current;

    if (loadedVideoRef.current !== s.videoId) {
      setPlayerError('');
      loadedVideoRef.current = s.videoId;
      // Only cue (loads thumbnail, no autoplay) - actual playVideo() only
      // ever runs inside the user's click handler (see joinPlayback below)
      player.cueVideoById({ videoId: s.videoId, startSeconds: expectedTime(s) });
      return;
    }

    const target = expectedTime(s);
    const allowedDrift = s.playState === 'playing' ? 1 : 0.25;
    const playerState = player.getPlayerState();
    const started =
      playerState === window.YT.PlayerState.PLAYING ||
      playerState === window.YT.PlayerState.PAUSED ||
      playerState === window.YT.PlayerState.BUFFERING;

    if (s.playState === 'playing') {
      // playVideo() needs a user gesture - skip until unlocked
      if (!unlocked) return;
      if (Math.abs(player.getCurrentTime() - target) > allowedDrift) player.seekTo(target, true);
      player.playVideo();
    } else {
      // pauseVideo() does NOT need a gesture - always apply immediately,
      // this is what guarantees a host's pause is never missed anywhere
      if (started && Math.abs(player.getCurrentTime() - target) > allowedDrift) player.seekTo(target, true);
      player.pauseVideo();
    }
  }, [sync, ready, unlocked]);

  // STEP 4: keep the seek-bar UI updated + gently correct drift (e.g. after buffering)
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      const player = playerRef.current;
      const s = syncRef.current;
      if (!player || !s || !s.videoId) return;

      if (!dragging) {
        setPosition(player.getCurrentTime() || 0);
        setDuration(player.getDuration() || 0);
      }

      if (unlocked && s.playState === 'playing') {
        const target = expectedTime(s);
        if (Math.abs(player.getCurrentTime() - target) > 2) player.seekTo(target, true);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [ready, unlocked, dragging]);

  const hasVideo = Boolean(sync?.videoId);
  const controlsDisabled = !hasVideo; // both direct control and request flows need a loaded video

  // FUNCTION: runs synchronously inside the click, so the browser treats it
  // as a genuine user gesture and allows playVideo() from here on
  const joinPlayback = () => {
    const s = syncRef.current;
    const player = playerRef.current;
    if (s && player) {
      const target = expectedTime(s);
      player.seekTo(target, true);
      if (s.playState === 'playing') player.playVideo();
      else player.pauseVideo();
    }
    setUnlocked(true);
  };

  // FUNCTION: play/pause button - sends a direct control if allowed, else a request
  const togglePlay = () => {
    const time = playerRef.current.getCurrentTime();
    const type = sync.playState === 'playing' ? 'pause' : 'play';
    if (canControl) socket.emit(type, { time });
    else socket.emit('request_change', { type, payload: { time } });
  };

  const onSeekRelease = (e) => {
    if (!dragging) return;
    setDragging(false);
    const time = Number(e.target.value);
    if (canControl) socket.emit('seek', { time });
    else socket.emit('request_change', { type: 'seek', payload: { time } });
  };

  // FUNCTION: shared by both the paste-a-link form and the search results'
  // play/request buttons - sends a direct control if allowed, else a request
  const submitVideo = (videoIdOrLink) => {
    if (!videoIdOrLink.trim()) return;
    if (canControl) socket.emit('change_video', { videoId: videoIdOrLink.trim() });
    else socket.emit('request_change', { type: 'change_video', payload: { videoId: videoIdOrLink.trim() } });
  };

  const changeVideo = (e) => {
    e.preventDefault();
    submitVideo(urlInput);
    setUrlInput('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Video surface: fills whatever height is left in the card (flex-1),
          instead of a fixed 16:9 box - that's what keeps the controls below
          it always visible without needing to scroll the page. */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black shadow-inner">
        <div className="absolute inset-0" ref={targetRef} />

        {/* Overlay sits above the iframe so nobody can click the video directly to pause it */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-center text-white">
          {!hasVideo && (
            <p className="px-6 text-sm text-gray-200">No video yet. Host can paste a YouTube link below.</p>
          )}
          {hasVideo && !unlocked && !playerError && (
            <button
              onClick={joinPlayback}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white shadow-lg transition hover:bg-brand-700"
            >
              <PlayIcon className="h-4 w-4" /> Click to join playback
            </button>
          )}
          {playerError && (
            <p className="rounded-lg bg-red-600/90 px-4 py-2 text-sm font-medium">{playerError}</p>
          )}
          {hasVideo && unlocked && buffering && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs">
              Buffering…
            </span>
          )}
        </div>
      </div>

      {/* Playback controls - fixed height, always stays below the video */}
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={controlsDisabled}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow transition
                     hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {canControl ? (
            sync?.playState === 'playing' ? (
              <>
                <PauseIcon className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4" /> Play
              </>
            )
          ) : sync?.playState === 'playing' ? (
            'Request Pause'
          ) : (
            'Request Play'
          )}
        </button>

        <input
          type="range"
          className="seek-slider flex-1"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(position, duration || 0)}
          disabled={controlsDisabled}
          onChange={(e) => {
            setDragging(true);
            setPosition(Number(e.target.value));
          }}
          onPointerUp={onSeekRelease}
          onKeyUp={onSeekRelease}
        />

        <span className="w-24 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
          {formatTime(position)} / {formatTime(duration)}
        </span>
      </div>

      {/* Search icon + paste-link form, side by side - clicking the search
          icon toggles the search panel open/closed (fixed height row) */}
      <div className="flex shrink-0 items-stretch gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen((open) => !open)}
          title="Search YouTube"
          aria-pressed={searchOpen}
          className={`flex w-10 shrink-0 items-center justify-center rounded-lg border text-base transition ${
            searchOpen
              ? 'border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
              : 'border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
        >
          <SearchIcon className="h-4 w-4" />
        </button>

        <form onSubmit={changeVideo} className="flex flex-1 gap-2">
          <input
            placeholder="Paste a YouTube link…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none
                       focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                       dark:border-gray-700 dark:bg-gray-800 dark:focus:ring-brand-900"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium
                       transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            {canControl ? 'Change video' : 'Request change'}
          </button>
        </form>
      </div>

      {/* Search panel - only rendered while open, so it takes zero space when closed.
          Selecting a result auto-closes the panel (nicer than leaving it open). */}
      {searchOpen && (
        <YouTubeSearch
          canControl={canControl}
          onSelect={(videoId) => {
            submitVideo(videoId);
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

export default Player;
