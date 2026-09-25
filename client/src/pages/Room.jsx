import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { getUserId } from "../identity";
import Player from "../components/Player";

// Plain-language description of a pending request, for the host/mod to read
function describeRequest(type) {
  switch (type) {
    case "play":
      return "play the video";
    case "pause":
      return "pause the video";
    case "seek":
      return "seek to a new position";
    case "change_video":
      return "change the video";
    default:
      return "make a change";
  }
}

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [username, setUsername] = useState(
    localStorage.getItem("username") || "",
  );
  const [nameInput, setNameInput] = useState("");
  const [participants, setParticipants] = useState([]);
  const [sync, setSync] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const myUserId = getUserId();
  const myRole = participants.find((p) => p.userId === myUserId)?.role;
  // Just for the UI (enabling/disabling buttons) — the real check happens on the server
  const canControl = myRole === "host" || myRole === "moderator";
  const isHost = myRole === "host";

  useEffect(() => {
    // Came straight from an invite link with no name set yet — ask for it first
    if (!username) return;

    const joinRoom = () => {
      socket.emit(
        "join_room",
        { roomId, username, userId: myUserId },
        (res) => {
          if (!res.ok) return setError(res.error);
          setParticipants(res.participants);
          setSync(res.sync);
          setPendingRequests(res.pendingRequests || []);
        },
      );
    };

    const onParticipantsChange = (data) => setParticipants(data.participants);
    const onSync = (state) => setSync(state);
    const onPendingRequests = (list) => setPendingRequests(list);
    const onRoomError = (data) => {
      setNotice(data.message);
      setTimeout(() => setNotice(""), 3000);
    };
    const onRequestApproved = (data) => {
      setNotice(`Your request to ${describeRequest(data.type)} was approved`);
      setTimeout(() => setNotice(""), 3000);
    };
    const onRequestRejected = (data) => {
      setNotice(`Your request to ${describeRequest(data.type)} was rejected`);
      setTimeout(() => setNotice(""), 3000);
    };
    const onRemoved = () => {
      alert("You were removed from the room by the host");
      navigate("/");
    };

    socket.on("user_joined", onParticipantsChange);
    socket.on("user_left", onParticipantsChange);
    socket.on("role_assigned", onParticipantsChange);
    socket.on("participant_removed", onParticipantsChange);
    socket.on("sync_state", onSync);
    socket.on("pending_requests", onPendingRequests);
    socket.on("room_error", onRoomError);
    socket.on("request_approved", onRequestApproved);
    socket.on("request_rejected", onRequestRejected);
    socket.on("removed_from_room", onRemoved);
    // After a reconnect, the server has already dropped this socket from the
    // room, so we need to join again
    socket.on("connect", joinRoom);

    if (socket.connected) joinRoom();
    else socket.connect();

    return () => {
      socket.off("user_joined", onParticipantsChange);
      socket.off("user_left", onParticipantsChange);
      socket.off("role_assigned", onParticipantsChange);
      socket.off("participant_removed", onParticipantsChange);
      socket.off("sync_state", onSync);
      socket.off("pending_requests", onPendingRequests);
      socket.off("room_error", onRoomError);
      socket.off("request_approved", onRequestApproved);
      socket.off("request_rejected", onRequestRejected);
      socket.off("removed_from_room", onRemoved);
      socket.off("connect", joinRoom);
      socket.disconnect(); // the server handles the leave itself on disconnect
    };
  }, [roomId, username, myUserId, navigate]);

  const submitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem("username", name);
    setUsername(name);
  };

  const copyInviteLink = () =>
    navigator.clipboard.writeText(window.location.href);

  const promote = (userId) =>
    socket.emit("assign_role", { userId, role: "moderator" });
  const demote = (userId) =>
    socket.emit("assign_role", { userId, role: "participant" });
  const removeUser = (userId, name) => {
    if (confirm(`Remove ${name} from the room?`)) {
      socket.emit("remove_participant", { userId });
    }
  };
  const respondToRequest = (requestId, approve) =>
    socket.emit("respond_to_request", { requestId, approve });

  if (!username) {
    return (
      <div>
        <h2>Join room {roomId}</h2>
        <input
          placeholder="Your name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          maxLength={20}
        />
        <button onClick={submitName}>Join</button>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <button onClick={() => navigate("/")}>Back to home</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Room {roomId}</h2>
      <button onClick={copyInviteLink}>Copy invite link</button>
      <button onClick={() => navigate("/")}>Leave</button>
      {notice && <p>{notice}</p>}

      <Player sync={sync} canControl={canControl} />

      {canControl && pendingRequests.length > 0 && (
        <div>
          <h3>Pending requests ({pendingRequests.length})</h3>
          <ul>
            {pendingRequests.map((r) => (
              <li key={r.id}>
                {r.username} wants to {describeRequest(r.type)}{" "}
                <button onClick={() => respondToRequest(r.id, true)}>
                  Approve
                </button>
                <button onClick={() => respondToRequest(r.id, false)}>
                  Reject
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map((p) => (
          <li key={p.userId}>
            {p.username} {p.userId === myUserId && "(you)"} : {p.role}
            {isHost && p.userId !== myUserId && (
              <>
                {" "}
                {p.role === "participant" && (
                  <button onClick={() => promote(p.userId)}>
                    Make Moderator
                  </button>
                )}
                {p.role === "moderator" && (
                  <button onClick={() => demote(p.userId)}>
                    Make Participant
                  </button>
                )}
                <button onClick={() => removeUser(p.userId, p.username)}>
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {myRole && <p>Your role: {myRole}</p>}
    </div>
  );
}

export default Room;
