import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";

let apiPromise; // Load the YouTube script only once

function loadYouTubeApi() {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);

    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });

  return apiPromise;
}

// Project the position forward by however long it's been since the server sent this state
function expectedTime(s) {
  if (s.playState !== "playing") return s.currentTime;
  return s.currentTime + (Date.now() - s.receivedAt) / 1000;
}

function formatTime(sec) {
  const s = Math.floor(sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Plain-language meaning of YouTube's onError codes
function errorMessageFor(code) {
  switch (code) {
    case 2:
      return "Invalid video ID";
    case 5:
      return "This video cannot be played here";
    case 100:
      return "Video not found or has been removed";
    case 101:
    case 150:
      return "This video's owner has disabled embedding";
    default:
      return "Could not play this video";
  }
}

function Player({ sync, canControl }) {
  const targetRef = useRef(null);
  const playerRef = useRef(null);
  const loadedVideoRef = useRef(null);
  const syncRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [buffering, setBuffering] = useState(false);
  const [playerError, setPlayerError] = useState("");

  // 1) Create the player. YT.Player replaces its target div with an iframe,
  // so we mount our own plain div instead of letting React manage it directly
  useEffect(() => {
    let cancelled = false;
    const mount = document.createElement("div");
    targetRef.current.appendChild(mount);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mount, {
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onStateChange: (e) => {
            // Buffering (3) is only used for UI feedback here, it doesn't trigger any sync event
            setBuffering(e.data === YT.PlayerState.BUFFERING);
          },
          onError: (e) => {
            console.error("YouTube player error code:", e.data);
            setPlayerError(errorMessageFor(e.data));
          },
          onAutoplayBlocked: () => {
            // The browser blocked playback, ask the user for a fresh gesture
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

  // 2) Remember the server's latest state (with a receivedAt timestamp)
  useEffect(() => {
    if (sync) syncRef.current = { ...sync, receivedAt: Date.now() };
  }, [sync]);

  // 3) Apply the server's state to the player
  useEffect(() => {
    const s = syncRef.current;
    if (!ready || !s || !s.videoId) return;
    const player = playerRef.current;

    if (loadedVideoRef.current !== s.videoId) {
      setPlayerError("");
      loadedVideoRef.current = s.videoId;
      // Only cue for now (shows the thumbnail). playVideo() only runs inside the
      // user's "Click to join playback" click, otherwise the browser's autoplay
      // policy silently blocks it
      player.cueVideoById({
        videoId: s.videoId,
        startSeconds: expectedTime(s),
      });
      return;
    }

    const target = expectedTime(s);
    const allowedDrift = s.playState === "playing" ? 1 : 0.25;
    const playerState = player.getPlayerState();
    // Whether the video has actually started, vs still being cued/unstarted
    const started =
      playerState === window.YT.PlayerState.PLAYING ||
      playerState === window.YT.PlayerState.PAUSED ||
      playerState === window.YT.PlayerState.BUFFERING;

    if (s.playState === "playing") {
      // playVideo() needs a user gesture — skip it until unlocked
      // (the overlay's "Click to join playback" button stays visible until then)
      if (!unlocked) return;
      if (Math.abs(player.getCurrentTime() - target) > allowedDrift) {
        player.seekTo(target, true);
      }
      player.playVideo();
    } else {
      // pauseVideo() does NOT need a user gesture — always apply it right away,
      // regardless of 'unlocked'. This is what makes sure a host's pause is
      // never missed on a participant's screen
      if (
        started &&
        Math.abs(player.getCurrentTime() - target) > allowedDrift
      ) {
        player.seekTo(target, true);
      }
      player.pauseVideo();
    }
  }, [sync, ready, unlocked]);

  // 4) Keep the slider position updated + correct drift (e.g. from buffering)
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

      if (unlocked && s.playState === "playing") {
        const target = expectedTime(s);
        if (Math.abs(player.getCurrentTime() - target) > 2)
          player.seekTo(target, true);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [ready, unlocked, dragging]);

  const hasVideo = Boolean(sync?.videoId);
  const controlsDisabled = !hasVideo; // both control and request flows need a loaded video

  // Runs directly inside the click, so the browser treats it as a real user gesture
  // and allows playVideo()
  const joinPlayback = () => {
    const s = syncRef.current;
    const player = playerRef.current;
    if (s && player) {
      const target = expectedTime(s);
      player.seekTo(target, true);
      if (s.playState === "playing") player.playVideo();
      else player.pauseVideo();
    }
    setUnlocked(true);
  };

  const togglePlay = () => {
    const time = playerRef.current.getCurrentTime();
    const type = sync.playState === "playing" ? "pause" : "play";
    if (canControl) socket.emit(type, { time });
    else socket.emit("request_change", { type, payload: { time } });
  };

  const onSeekRelease = (e) => {
    if (!dragging) return;
    setDragging(false);
    const time = Number(e.target.value);
    if (canControl) socket.emit("seek", { time });
    else socket.emit("request_change", { type: "seek", payload: { time } });
  };

  const changeVideo = (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    if (canControl) socket.emit("change_video", { videoId: urlInput.trim() });
    else
      socket.emit("request_change", {
        type: "change_video",
        payload: { videoId: urlInput.trim() },
      });
    setUrlInput("");
  };

  return (
    <div>
      <div className="player-box">
        <div className="player-target" ref={targetRef} />

        {/* The overlay sits above the iframe so nobody can click the video directly to pause it */}
        <div className="player-overlay">
          {!hasVideo && (
            <p>No video yet. Host can paste a YouTube link below.</p>
          )}
          {hasVideo && !unlocked && !playerError && (
            <button onClick={joinPlayback}>Click to join playback</button>
          )}
          {playerError && <p>{playerError}</p>}
          {hasVideo && unlocked && buffering && <p>Buffering…</p>}
        </div>
      </div>

      <div>
        <button onClick={togglePlay} disabled={controlsDisabled}>
          {canControl
            ? sync?.playState === "playing"
              ? "Pause"
              : "Play"
            : sync?.playState === "playing"
              ? "Request Pause"
              : "Request Play"}
        </button>

        <input
          type="range"
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

        <span>
          {formatTime(position)} / {formatTime(duration)}
        </span>
      </div>

      <form onSubmit={changeVideo}>
        <input
          placeholder="Paste YouTube link"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
        />
        <button type="submit">
          {canControl ? "Change video" : "Request video change"}
        </button>
      </form>
    </div>
  );
}

export default Player;
