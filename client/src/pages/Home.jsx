import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserId } from '../identity';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const createRoom = async () => {
    if (!username.trim()) return setError('Enter your name first');

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
    } catch {
      setError('Could not reach the server');
    }
  };

  const joinRoom = () => {
    if (!username.trim()) return setError('Enter your name first');
    if (!code.trim()) return setError('Enter a room code');

    localStorage.setItem('username', username.trim());
    navigate(`/room/${code.trim().toUpperCase()}`);
  };

  return (
    <div>
      <h1>Watch Party</h1>

      <input
        placeholder="Your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={20}
      />

      <div>
        <button onClick={createRoom}>Create room</button>
      </div>

      <div>
        <input
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
        />
        <button onClick={joinRoom}>Join room</button>
      </div>

      {error && <p>{error}</p>}
    </div>
  );
}

export default Home;