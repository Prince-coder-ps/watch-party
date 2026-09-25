import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';
import { getUserId } from '../identity';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [nameInput, setNameInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState('');

  const myUserId = getUserId();
  const myRole = participants.find((p) => p.userId === myUserId)?.role;

  useEffect(() => {
    // invite link se seedha aaye ho aur naam nahi hai to pehle naam poochenge
    if (!username) return;

    const joinRoom = () => {
      socket.emit('join_room', { roomId, username, userId: myUserId }, (res) => {
        if (!res.ok) return setError(res.error);
        setParticipants(res.participants);
      });
    };

    const onParticipantsChange = (data) => setParticipants(data.participants);

    socket.on('user_joined', onParticipantsChange);
    socket.on('user_left', onParticipantsChange);
    // reconnect ke baad server ne socket ko room se hata diya hota hai, to dobara join
    socket.on('connect', joinRoom);

    if (socket.connected) joinRoom();
    else socket.connect();

    return () => {
      socket.off('user_joined', onParticipantsChange);
      socket.off('user_left', onParticipantsChange);
      socket.off('connect', joinRoom);
      socket.disconnect(); // server disconnect pe khud leave handle kar lega
    };
  }, [roomId, username, myUserId]);

  const submitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem('username', name);
    setUsername(name);
  };

  const copyInviteLink = () => navigator.clipboard.writeText(window.location.href);

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
        <button onClick={() => navigate('/')}>Back to home</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Room {roomId}</h2>
      <button onClick={copyInviteLink}>Copy invite link</button>
      <button onClick={() => navigate('/')}>Leave</button>

      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map((p) => (
          <li key={p.userId}>
            {p.username} {p.userId === myUserId && '(you)'} : {p.role}
          </li>
        ))}
      </ul>
      {myRole && <p>Your role: {myRole}</p>}
    </div>
  );
}

export default Room;