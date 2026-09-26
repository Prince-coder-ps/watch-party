// ---------------------------------------------------------------------------
// PAGE: The watch-party room itself - video player, participant list with
// host controls (promote/demote/remove/transfer host), the approval-request
// queue, and room-wide chat. Everything here reacts to server-pushed socket
// events; this component never mutates shared state on its own.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';
import { getUserId } from '../identity';
import Player from '../components/Player';
import ThemeToggle from '../components/ThemeToggle';
import {
  PlayIcon,
  CopyIcon,
  CheckIcon,
  LogOutIcon,
  UsersIcon,
  CrownIcon,
  XIcon,
  LinkIcon,
  MessageCircleIcon,
  SendIcon,
} from '../icons';

// FUNCTION: plain-language description of a pending request, for the host/mod to read
function describeRequest(type) {
  switch (type) {
    case 'play':
      return 'play the video';
    case 'pause':
      return 'pause the video';
    case 'seek':
      return 'seek to a new position';
    case 'change_video':
      return 'change the video';
    default:
      return 'make a change';
  }
}

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase();
}

// FEATURE: Host always listed first, then Moderator, then Participant.
// Since this re-sorts on every render from the current `role` field, a
// transferred host automatically jumps to the top with no extra code -
// they just have role: 'host' now, same as anyone else who's ever been host.
const ROLE_ORDER = { host: 0, moderator: 1, participant: 2 };
function sortByRole(list) {
  return [...list].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

const ROLE_STYLES = {
  host: 'bg-brand-500/15 text-brand-500',
  moderator: 'bg-blue-500/15 text-blue-400',
  participant: 'bg-gray-500/15 text-gray-400',
};

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const chatOpenRef = useRef(false); // mirrors chatOpen for the socket listener below

  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [nameInput, setNameInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [sync, setSync] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false); // is the floating chat panel open?
  const [unreadCount, setUnreadCount] = useState(0); // badge count while chat is closed
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [welcome, setWelcome] = useState(''); // username to greet, cleared after a few seconds
  const hasJoinedRef = useRef(false); // so the welcome popup only shows on the FIRST join, not on reconnects

  const myUserId = getUserId();
  const myRole = participants.find((p) => p.userId === myUserId)?.role;
  // UI-only flags for enabling/disabling buttons - the real check always happens on the server
  const canControl = myRole === 'host' || myRole === 'moderator';
  const isHost = myRole === 'host';

  // MAIN EFFECT: connects the socket, joins the room, and wires up every
  // realtime event this page cares about. Runs once username is known.
  useEffect(() => {
    if (!username) return; // came from an invite link with no name yet

    const joinRoom = () => {
      socket.emit('join_room', { roomId, username, userId: myUserId }, (res) => {
        if (!res.ok) return setError(res.error);
        setParticipants(res.participants);
        setSync(res.sync);
        setPendingRequests(res.pendingRequests || []);
        setChatMessages(res.chatMessages || []);

        if (!hasJoinedRef.current) {
          hasJoinedRef.current = true;
          setWelcome(username);
          setTimeout(() => setWelcome(''), 3000);
        }
      });
    };

    const onParticipantsChange = (data) => setParticipants(data.participants);
    const onSync = (state) => setSync(state);
    const onPendingRequests = (list) => setPendingRequests(list);
    const onChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!chatOpenRef.current) setUnreadCount((c) => c + 1); // only badge it if the panel is closed
    };
    const onRoomError = (data) => {
      setNotice(data.message);
      setTimeout(() => setNotice(''), 3000);
    };
    const onRequestApproved = (data) => {
      setNotice(`Your request to ${describeRequest(data.type)} was approved`);
      setTimeout(() => setNotice(''), 3000);
    };
    const onRequestRejected = (data) => {
      setNotice(`Your request to ${describeRequest(data.type)} was rejected`);
      setTimeout(() => setNotice(''), 3000);
    };
    const onHostTransferred = (data) => {
      setParticipants(data.participants);
      setNotice(
        data.newHostUserId === myUserId ? 'You are now the host' : 'The host role was transferred'
      );
      setTimeout(() => setNotice(''), 3000);
    };
    const onRemoved = () => {
      alert('You were removed from the room by the host');
      navigate('/');
    };

    socket.on('user_joined', onParticipantsChange);
    socket.on('user_left', onParticipantsChange);
    socket.on('role_assigned', onParticipantsChange);
    socket.on('participant_removed', onParticipantsChange);
    socket.on('host_transferred', onHostTransferred);
    socket.on('sync_state', onSync);
    socket.on('pending_requests', onPendingRequests);
    socket.on('chat_message', onChatMessage);
    socket.on('room_error', onRoomError);
    socket.on('request_approved', onRequestApproved);
    socket.on('request_rejected', onRequestRejected);
    socket.on('removed_from_room', onRemoved);
    // After a reconnect the server has already dropped this socket from the room,
    // so we must join again
    socket.on('connect', joinRoom);

    if (socket.connected) joinRoom();
    else socket.connect();

    return () => {
      socket.off('user_joined', onParticipantsChange);
      socket.off('user_left', onParticipantsChange);
      socket.off('role_assigned', onParticipantsChange);
      socket.off('participant_removed', onParticipantsChange);
      socket.off('host_transferred', onHostTransferred);
      socket.off('sync_state', onSync);
      socket.off('pending_requests', onPendingRequests);
      socket.off('chat_message', onChatMessage);
      socket.off('room_error', onRoomError);
      socket.off('request_approved', onRequestApproved);
      socket.off('request_rejected', onRequestRejected);
      socket.off('removed_from_room', onRemoved);
      socket.off('connect', joinRoom);
      socket.disconnect(); // server handles the leave itself on disconnect
    };
  }, [roomId, username, myUserId, navigate]);

  // Keep the ref in sync so the socket listener (set up once) sees the latest value,
  // and clear the unread badge the moment the panel is opened
  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // Auto-scroll chat to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const submitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem('username', name);
    setUsername(name);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // FUNCTION: copies just the 6-character room code (not the full URL) -
  // used by the room-code badge in the header, distinct from copyInviteLink
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // --- Host-only actions (server re-validates all of these) ---
  const promote = (userId) => socket.emit('assign_role', { userId, role: 'moderator' });
  const demote = (userId) => socket.emit('assign_role', { userId, role: 'participant' });
  const removeUser = (userId, name) => {
    if (confirm(`Remove ${name} from the room?`)) socket.emit('remove_participant', { userId });
  };
  const transferHost = (userId, name) => {
    if (confirm(`Make ${name} the new host? You will become a participant.`)) {
      socket.emit('transfer_host', { userId });
    }
  };

  // --- Approval queue (host/moderator) ---
  const respondToRequest = (requestId, approve) => socket.emit('respond_to_request', { requestId, approve });

  // --- Chat (everyone) ---
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { text: chatInput.trim() });
    setChatInput('');
  };

  // --- Screen: ask for a display name (invite-link deep entry) ---
  if (!username) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-ink-950">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-ink-700 dark:bg-ink-900">
          <h2 className="mb-4 font-display text-xl dark:text-white">Join room {roomId}</h2>
          <input
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={20}
            className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none
                       focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
          />
          <button
            onClick={submitName}
            className="w-full rounded-lg bg-brand-500 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600"
          >
            Join room
          </button>
        </div>
      </div>
    );
  }

  // --- Screen: room not found / join failed ---
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-ink-950">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg dark:border-ink-700 dark:bg-ink-900">
          <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full rounded-lg bg-brand-500 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // --- Main room screen ---
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-ink-900 dark:bg-ink-950 dark:text-white">
      {/* Welcome popup - shown once, right after this user's own join succeeds */}
      {welcome && (
        <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="animate-fade-in-down flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium shadow-lg dark:border-ink-700 dark:bg-ink-900">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <PlayIcon className="h-3 w-3" />
            </span>
            Welcome, <span className="text-brand-500">{welcome}</span>!
          </div>
        </div>
      )}

      {/* Top bar: logo, room code, theme toggle, leave */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-ink-700">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-white">
            <PlayIcon className="h-4 w-4" />
          </span>
          <span className="font-display text-lg tracking-wide">
            SYNC<span className="text-brand-500">//</span>
          </span>
        </div>

        <button
          onClick={copyRoomCode}
          title="Copy room code"
          className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium
                     text-gray-500 transition hover:bg-gray-50 dark:border-ink-700 dark:text-gray-400 dark:hover:bg-ink-800"
        >
          <span className="hidden sm:inline">ROOM</span>
          <span className="font-mono text-base font-bold tracking-widest text-ink-900 dark:text-white sm:text-lg">
            {roomId}
          </span>
          <span>{copiedCode ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}</span>
        </button>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* Desktop/tablet (sm and up): icon + text "Leave" button */}
          <button
            onClick={() => navigate('/')}
            className="hidden items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold
                       text-red-500 transition hover:bg-red-50 dark:border-ink-700 dark:hover:bg-red-950 sm:flex"
          >
            <LogOutIcon className="h-3.5 w-3.5" /> Leave
          </button>

          {/* Mobile (below sm): icon-only exit button - saves space on small screens */}
          <button
            onClick={() => navigate('/')}
            title="Leave room"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200
                       transition hover:bg-red-50 hover:text-red-500 dark:border-ink-700 dark:hover:bg-red-950 sm:hidden"
          >
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Status row */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-2 text-xs dark:border-ink-800">
        <span className="flex items-center gap-2 font-medium text-gray-500 dark:text-gray-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          LIVE ROOM · {participants.length} WATCHING
        </span>
        {myRole && (
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${ROLE_STYLES[myRole]}`}>
            {canControl ? 'Controls enabled' : 'View only'} · {myRole}
          </span>
        )}
      </div>

      {notice && (
        <div className="mx-6 mt-2 shrink-0 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
          {notice}
        </div>
      )}

      {/* Main layout: player (fills all remaining height) + sidebar (scrolls on its own).
          Desktop (lg+): a fixed-height row - the player never needs a page scroll.
          Mobile: a normal stacked column that scrolls the whole page, since there
          isn't enough width to show both side by side. */}
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4 lg:flex-row lg:overflow-hidden">
        {/* Player card - stretches to the row's full height on desktop (flex default) */}
        <section className="flex min-h-[45vh] flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:min-h-0 lg:flex-1">
          <Player sync={sync} canControl={canControl} />
        </section>

        {/* Sidebar: pending requests, people, invite, chat - scrolls independently on desktop */}
        <aside className="thin-scrollbar flex flex-col gap-6 lg:w-[360px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          {canControl && pendingRequests.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Pending requests
              </h3>
              <ul className="flex flex-col gap-2">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-ink-800">
                    <p className="mb-2">
                      <strong>{r.username}</strong> wants to {describeRequest(r.type)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToRequest(r.id, true)}
                        className="flex-1 rounded-md bg-brand-500 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => respondToRequest(r.id, false)}
                        className="flex-1 rounded-md border border-gray-300 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:border-ink-600 dark:hover:bg-ink-700"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* People */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">In the room</h3>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <UsersIcon className="h-3.5 w-3.5" /> {participants.length}
              </span>
            </div>
            <ul className="thin-scrollbar flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
              {sortByRole(participants).map((p) => (
                <li key={p.userId} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-white dark:bg-ink-700">
                    {initials(p.username)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.username} {p.userId === myUserId && <span className="text-gray-400">(you)</span>}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ROLE_STYLES[p.role]}`}>
                      {p.role === 'host' ? (
                        <>
                          <CrownIcon /> host
                        </>
                      ) : (
                        p.role
                      )}
                    </span>
                  </div>

                  {isHost && p.userId !== myUserId && (
                    <div className="flex shrink-0 gap-1">
                      {p.role === 'participant' && (
                        <button
                          onClick={() => promote(p.userId)}
                          title="Make moderator"
                          className="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium hover:bg-gray-100 dark:border-ink-600 dark:hover:bg-ink-700"
                        >
                          + Mod
                        </button>
                      )}
                      {p.role === 'moderator' && (
                        <button
                          onClick={() => demote(p.userId)}
                          title="Make participant"
                          className="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium hover:bg-gray-100 dark:border-ink-600 dark:hover:bg-ink-700"
                        >
                          − Mod
                        </button>
                      )}
                      <button
                        onClick={() => transferHost(p.userId, p.username)}
                        title="Transfer host"
                        className="flex items-center rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium hover:bg-gray-100 dark:border-ink-600 dark:hover:bg-ink-700"
                      >
                        <CrownIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeUser(p.userId, p.username)}
                        title="Remove"
                        className="flex items-center rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Invite card */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-500">
              <LinkIcon className="h-3.5 w-3.5" /> Invite people
            </h3>
            <p className="mb-3 text-xs text-gray-400">Share the room link. New arrivals join as participants.</p>
            <button
              onClick={copyInviteLink}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-ink-600 dark:hover:bg-ink-800"
            >
              {copiedLink ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              {copiedLink ? 'Copied!' : 'Copy invite link'}
            </button>
          </div>
        </aside>
      </main>

      {/* FEATURE: Floating chat toggle, like Google Meet's chat icon.
          Fixed position - always visible in the corner, no scrolling needed
          to find it. Clicking it opens/closes a small chat panel above it. */}
      <button
        onClick={() => setChatOpen((open) => !open)}
        title={chatOpen ? 'Close chat' : 'Open chat'}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full
                   bg-brand-500 text-white shadow-xl transition hover:bg-brand-600"
      >
        <MessageCircleIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {chatOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[420px] w-80 max-w-[calc(100vw-3rem)] flex-col
                     overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl
                     dark:border-ink-700 dark:bg-ink-900"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-ink-700">
            <h3 className="text-sm font-semibold">Room chat</h3>
            <button
              onClick={() => setChatOpen(false)}
              className="text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="thin-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
            {chatMessages.length === 0 && <p className="text-xs text-gray-400">No messages yet. Say hi 👋</p>}
            {chatMessages.map((m) => (
              <div key={m.id}>
                <span className="font-semibold">{m.username}: </span>
                <span className="text-gray-600 dark:text-gray-300">{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendChat} className="flex shrink-0 gap-2 border-t border-gray-200 p-3 dark:border-ink-700">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message the room…"
              maxLength={500}
              autoFocus
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none
                         focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
            <button
              type="submit"
              className="flex items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Room;
