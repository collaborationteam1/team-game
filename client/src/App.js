import React, { useState, useEffect } from 'react';
import { socket } from './socket';

const GAME_DURATION_MS = 5 * 60 * 1000;

function App() {
  const [isConnected, setIsConnected]   = useState(socket.connected);
  const [socketId, setSocketId]         = useState('');
  const [nickname, setNickname]         = useState('');
  const [roomCode, setRoomCode]         = useState('');
  const [currentRoom, setCurrentRoom]   = useState(null);
  const [players, setPlayers]           = useState([]);
  const [error, setError]               = useState('');
  const [role, setRole]                 = useState(null);
  const [gameState, setGameState]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [stabilizeError, setStabilizeError] = useState('');
  const [timeLeft, setTimeLeft]         = useState(null);

  // Countdown timer — updates every 500ms while game is running
  useEffect(() => {
    if (!gameState?.startTime || gameState.gamePhase !== 'running') {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, GAME_DURATION_MS - (Date.now() - gameState.startTime));
      setTimeLeft(remaining);
    }, 500);
    return () => clearInterval(interval);
  }, [gameState?.startTime, gameState?.gamePhase]);

  // Socket event listeners — registered once, no roomCode dependency
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id);
    }
    function onDisconnect() {
      setIsConnected(false);
      setSocketId('');
      setCurrentRoom(null);
      setPlayers([]);
      setRole(null);
      setGameState(null);
      setTimeLeft(null);
    }
    function onPlayerJoined(data)     { setPlayers(data.players); }
    function onPlayerLeft(data)       { setPlayers(data.players); }
    function onRoleAssigned(data)     { setRole(data.role); setGameState(data.gameState); }
    function onGameStarted(data)      { setPlayers(data.players); setGameState(data.gameState); }
    function onGameStateUpdate(data)  { setGameState(data.gameState); }

    function onCreateRoomResponse(response) {
      if (response?.success) {
        setRoomCode(response.roomCode);
        setCurrentRoom(response.roomCode);
        setError('');
      } else {
        setError(response?.error || 'Fehler beim Erstellen des Raums');
      }
      setLoading(false);
    }

    // Server echoes roomCode back — no need to read it from component state
    function onJoinRoomResponse(response) {
      if (response?.success) {
        setCurrentRoom(response.roomCode);
        setPlayers(response.players);
        setError('');
      } else {
        setError(response?.error || 'Fehler beim Beitreten des Raums');
      }
      setLoading(false);
    }

    socket.on('connect',            onConnect);
    socket.on('disconnect',         onDisconnect);
    socket.on('playerJoined',       onPlayerJoined);
    socket.on('playerLeft',         onPlayerLeft);
    socket.on('roleAssigned',       onRoleAssigned);
    socket.on('gameStarted',        onGameStarted);
    socket.on('gameStateUpdate',    onGameStateUpdate);
    socket.on('createRoomResponse', onCreateRoomResponse);
    socket.on('joinRoomResponse',   onJoinRoomResponse);

    setIsConnected(socket.connected);
    if (socket.connected) setSocketId(socket.id);

    return () => {
      socket.off('connect',            onConnect);
      socket.off('disconnect',         onDisconnect);
      socket.off('playerJoined',       onPlayerJoined);
      socket.off('playerLeft',         onPlayerLeft);
      socket.off('roleAssigned',       onRoleAssigned);
      socket.off('gameStarted',        onGameStarted);
      socket.off('gameStateUpdate',    onGameStateUpdate);
      socket.off('createRoomResponse', onCreateRoomResponse);
      socket.off('joinRoomResponse',   onJoinRoomResponse);
    };
  }, []);

  const handleCreateRoom = () => {
    if (!nickname.trim()) { setError('Bitte gib einen Nickname ein'); return; }
    setLoading(true);
    setError('');
    socket.emit('createRoom', nickname.trim());
  };

  const handleJoinRoom = () => {
    if (!nickname.trim()) { setError('Bitte gib einen Nickname ein'); return; }
    if (!roomCode.trim()) { setError('Bitte gib einen Raumcode ein'); return; }
    setLoading(true);
    setError('');
    socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), nickname: nickname.trim() });
  };

  const handleLeaveRoom = () => {
    socket.emit('leaveRoom');
    setCurrentRoom(null);
    setPlayers([]);
    setRole(null);
    setGameState(null);
    setTimeLeft(null);
    setRoomCode('');
    setError('');
  };

  const handleToggleLever = (lever) => {
    socket.emit('toggleLever', { lever }, (response) => {
      if (!response?.success) setError(response?.error || 'Fehler');
    });
  };

  const handleExecuteFinalAction = () => {
    setStabilizeError('');
    socket.emit('executeFinalAction', {}, (response) => {
      if (!response?.success) setStabilizeError(response?.error || 'Fehler');
    });
  };

  const formatTime = (ms) => {
    if (ms === null) return '';
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const btn = (bg, extra = {}) => ({
    padding: '8px 16px', backgroundColor: bg, color: 'white',
    border: 'none', borderRadius: '4px', cursor: 'pointer', ...extra
  });

  // ── End screens ──────────────────────────────────────────────────────────────

  if (gameState?.gamePhase === 'completed') {
    const secs = Math.floor((gameState.endTime - gameState.startTime) / 1000);
    const m = Math.floor(secs / 60), s = secs % 60;
    return (
      <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#4CAF50' }}>Reaktor stabilisiert!</h1>
        <p style={{ fontSize: '1.2em', color: '#555' }}>Zeit: {m}:{String(s).padStart(2, '0')}</p>
        <button onClick={handleLeaveRoom} style={btn('#4CAF50')}>Neues Spiel</button>
      </div>
    );
  }

  if (gameState?.gamePhase === 'failed') {
    return (
      <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#f44336' }}>Reaktor außer Kontrolle!</h1>
        <p style={{ fontSize: '1.2em', color: '#555' }}>Der Reaktor ist ausgefallen.</p>
        <button onClick={handleLeaveRoom} style={btn('#f44336')}>Neues Spiel</button>
      </div>
    );
  }

  // ── Role views — called as functions (not rendered as components) to avoid
  // React remounting the DOM on every game tick re-render ───────────────────────

  const renderEngineerView = () => (
    <div>
      <h3>Ingenieur-Konsole</h3>
      <div style={{ marginBottom: '20px' }}>
        <h4>Fehlermeldungen:</h4>
        {gameState.errorMessages?.length === 0
          ? <div style={{ color: '#4CAF50' }}>Keine Fehler</div>
          : gameState.errorMessages?.map((msg, i) => (
              <div key={i} style={{ color: '#f44336', margin: '5px 0' }}>{msg}</div>
            ))}
      </div>
      <div>
        <h4>Hebel-Steuerung:</h4>
        {Object.entries(gameState.levers || {}).map(([lever, isActive]) => (
          <button key={lever} onClick={() => handleToggleLever(lever)}
            style={btn(isActive ? '#4CAF50' : '#f44336', { margin: '5px' })}>
            Hebel {lever}: {isActive ? 'Aktiv' : 'Inaktiv'}
          </button>
        ))}
        <div style={{ marginTop: '10px', fontSize: '0.85em', color: '#666' }}>
          A/C: Temperatur/Druck erhöhen &nbsp;|&nbsp; B/D: Temperatur/Druck senken
        </div>
      </div>
    </div>
  );

  const renderTechnicianView = () => (
    <div>
      <h3>Techniker-Konsole</h3>
      <h4>Statusleuchten:</h4>
      {Object.entries(gameState.statusLights || {}).map(([color, isActive]) => (
        <div key={color} style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            backgroundColor: isActive ? color : '#ccc',
            marginRight: '12px',
            boxShadow: isActive ? `0 0 8px ${color}` : 'none'
          }} />
          <span>{color.toUpperCase()} — {isActive ? 'AN' : 'AUS'}</span>
        </div>
      ))}
      <div style={{ marginTop: '15px', fontSize: '0.85em', color: '#666' }}>
        ROT: Temp zu hoch &nbsp;|&nbsp; BLAU: Temp zu niedrig &nbsp;|&nbsp;
        GELB: Druck zu hoch &nbsp;|&nbsp; GRÜN: Alles im sicheren Bereich
      </div>
    </div>
  );

  const renderScientistView = () => (
    <div>
      <h3>Wissenschaftler-Konsole</h3>
      <h4>Live-Daten:</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h5>Temperatur</h5>
          <div style={{
            padding: '12px', borderRadius: '4px', fontSize: '1.5em', fontWeight: 'bold',
            backgroundColor: (gameState.temperature < 30 || gameState.temperature > 80) ? '#ffebee' : '#e8f5e9'
          }}>
            {Math.round(gameState.temperature)}°C
          </div>
          <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>Soll: 30 – 80 °C</div>
        </div>
        <div>
          <h5>Druck</h5>
          <div style={{
            padding: '12px', borderRadius: '4px', fontSize: '1.5em', fontWeight: 'bold',
            backgroundColor: (gameState.pressure < 30 || gameState.pressure > 70) ? '#ffebee' : '#e8f5e9'
          }}>
            {Math.round(gameState.pressure)} bar
          </div>
          <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>Soll: 30 – 70 bar</div>
        </div>
      </div>
      <div style={{ marginTop: '20px' }}>
        <h4>Reaktor-Status:</h4>
        <div style={{
          padding: '10px', borderRadius: '4px',
          backgroundColor: gameState.reactorStatus === 'critical' ? '#ffebee'
                          : gameState.reactorStatus === 'warning'  ? '#fff3e0' : '#e8f5e9'
        }}>
          {gameState.reactorStatus?.toUpperCase()}
        </div>
      </div>
    </div>
  );

  const renderOperatorView = () => {
    const inSafeZone = gameState.temperature >= 30 && gameState.temperature <= 80 &&
                       gameState.pressure   >= 30 && gameState.pressure   <= 70;
    return (
      <div>
        <h3>Operator-Konsole</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '0.85em', color: '#666' }}>Temperatur</div>
            <div style={{ fontSize: '1.4em', fontWeight: 'bold',
              color: (gameState.temperature < 30 || gameState.temperature > 80) ? '#f44336' : '#4CAF50' }}>
              {Math.round(gameState.temperature)}°C
            </div>
            <div style={{ fontSize: '0.75em', color: '#999' }}>Soll: 30–80</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85em', color: '#666' }}>Druck</div>
            <div style={{ fontSize: '1.4em', fontWeight: 'bold',
              color: (gameState.pressure < 30 || gameState.pressure > 70) ? '#f44336' : '#4CAF50' }}>
              {Math.round(gameState.pressure)} bar
            </div>
            <div style={{ fontSize: '0.75em', color: '#999' }}>Soll: 30–70</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85em', color: '#666' }}>Status</div>
            <div style={{ fontSize: '1.1em' }}>{gameState.reactorStatus?.toUpperCase()}</div>
          </div>
        </div>

        <div style={{
          padding: '12px', borderRadius: '4px', marginBottom: '15px',
          backgroundColor: inSafeZone ? '#e8f5e9' : '#fff3e0'
        }}>
          {inSafeZone
            ? '✓ Alle Systeme im grünen Bereich — Stabilisierung möglich'
            : '⚠ Systeme noch außerhalb des sicheren Bereichs'}
        </div>

        {stabilizeError && (
          <div style={{ color: '#f44336', marginBottom: '10px' }}>{stabilizeError}</div>
        )}

        <button
          onClick={handleExecuteFinalAction}
          disabled={!inSafeZone}
          style={btn(inSafeZone ? '#2196F3' : '#bbb', { cursor: inSafeZone ? 'pointer' : 'not-allowed' })}
        >
          Reaktor stabilisieren
        </button>
      </div>
    );
  };

  const renderRoleView = () => {
    switch (role) {
      case 'Ingenieur':       return renderEngineerView();
      case 'Techniker':       return renderTechnicianView();
      case 'Wissenschaftler': return renderScientistView();
      case 'Operator':        return renderOperatorView();
      default:                return null;
    }
  };

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#333' }}>Die Reaktorkammer</h1>

      {/* Connection status */}
      <div style={{
        padding: '10px', margin: '10px 0', borderRadius: '5px',
        backgroundColor: isConnected ? '#e6ffe6' : '#ffe6e6',
        border: `1px solid ${isConnected ? '#00cc00' : '#cc0000'}`
      }}>
        <p style={{ margin: 0 }}>
          Verbindung: {isConnected ? `Verbunden (${socketId})` : 'Nicht verbunden — bitte warten oder Seite neu laden'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px', margin: '10px 0', backgroundColor: '#ffe6e6', borderRadius: '5px', border: '1px solid #cc0000', color: '#cc0000' }}>
          {error}
        </div>
      )}

      {!currentRoom ? (
        // ── Lobby ──
        <div style={{ marginTop: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
              placeholder="Dein Nickname"
              style={{ padding: '8px', marginRight: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={handleCreateRoom} disabled={loading} style={btn('#4CAF50')}>
              {loading ? 'Bitte warten…' : 'Neuen Raum erstellen'}
            </button>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text" value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Raumcode"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase', width: '90px' }}
              />
              <button onClick={handleJoinRoom} disabled={loading} style={btn('#2196F3')}>
                Raum beitreten
              </button>
            </div>
          </div>
        </div>
      ) : (
        // ── In-room view ──
        <div style={{ marginTop: '20px' }}>
          <div style={{
            padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px', marginBottom: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
          }}>
            <div>
              <strong>Raum: {currentRoom}</strong>
              {role && <span style={{ marginLeft: '15px', color: '#555' }}>Deine Rolle: <strong>{role}</strong></span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              {timeLeft !== null && (
                <span style={{ fontSize: '1.1em', fontWeight: 'bold', color: timeLeft < 60000 ? '#f44336' : '#333' }}>
                  ⏱ {formatTime(timeLeft)}
                </span>
              )}
              <button onClick={handleLeaveRoom} style={btn('#f44336')}>Verlassen</button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>Spieler ({players.length}/4):</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
              {players.map((player) => (
                <div key={player.id} style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', backgroundColor: '#4CAF50', borderRadius: '50%' }} />
                    <div>
                      <div>{player.nickname}</div>
                      {player.role && <div style={{ fontSize: '0.85em', color: '#666' }}>{player.role}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!role && players.length < 4 && (
            <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              Warten auf Spieler… ({players.length}/4)
            </div>
          )}

          {role && gameState && renderRoleView()}
        </div>
      )}
    </div>
  );
}

export default App;
