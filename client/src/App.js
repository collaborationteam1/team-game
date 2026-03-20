import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import './App.css';

const GAME_DURATION_MS = 5 * 60 * 1000;

const LEVER_INFO = {
  A: { effect: 'Temp +2/tick' },
  B: { effect: 'Temp −1/tick' },
  C: { effect: 'Druck +2/tick' },
  D: { effect: 'Druck −1/tick' },
};

const LIGHT_INFO = {
  red:    { label: 'ROT',   meaning: 'Temperatur zu hoch (>80°C)' },
  yellow: { label: 'GELB',  meaning: 'Druck zu hoch (>70 bar)' },
  blue:   { label: 'BLAU',  meaning: 'Temperatur zu niedrig (<30°C)' },
  green:  { label: 'GRÜN',  meaning: 'Alle Systeme im sicheren Bereich' },
};

function getRoleBadgeClass(role) {
  switch (role) {
    case 'Ingenieur':       return 'role-badge role-badge-engineer';
    case 'Techniker':       return 'role-badge role-badge-technician';
    case 'Wissenschaftler': return 'role-badge role-badge-scientist';
    case 'Operator':        return 'role-badge role-badge-operator';
    default: return 'role-badge';
  }
}

function getValueClass(value, low, high) {
  if (value < low || value > high) return 'danger';
  if (value < low + 10 || value > high - 10) return 'warning';
  return 'safe';
}

function App() {
  const [isConnected, setIsConnected]       = useState(socket.connected);
  const [socketId, setSocketId]             = useState('');
  const [nickname, setNickname]             = useState('');
  const [roomCode, setRoomCode]             = useState('');
  const [currentRoom, setCurrentRoom]       = useState(null);
  const [players, setPlayers]               = useState([]);
  const [error, setError]                   = useState('');
  const [role, setRole]                     = useState(null);
  const [gameState, setGameState]           = useState(null);
  const [loading, setLoading]               = useState(false);
  const [stabilizeError, setStabilizeError] = useState('');
  const [timeLeft, setTimeLeft]             = useState(null);

  // Countdown timer
  useEffect(() => {
    if (!gameState?.startTime || gameState.gamePhase !== 'running') {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, GAME_DURATION_MS - (Date.now() - gameState.startTime)));
    }, 500);
    return () => clearInterval(interval);
  }, [gameState?.startTime, gameState?.gamePhase]);

  // Socket listeners
  useEffect(() => {
    const onConnect    = () => { setIsConnected(true);  setSocketId(socket.id); };
    const onDisconnect = () => {
      setIsConnected(false); setSocketId('');
      setCurrentRoom(null); setPlayers([]); setRole(null); setGameState(null); setTimeLeft(null);
    };
    const onPlayerJoined      = (d) => setPlayers(d.players);
    const onPlayerLeft        = (d) => setPlayers(d.players);
    const onRoleAssigned      = (d) => { setRole(d.role); setGameState(d.gameState); };
    const onGameStarted       = (d) => { setPlayers(d.players); setGameState(d.gameState); };
    const onGameStateUpdate   = (d) => setGameState(d.gameState);

    const onCreateRoomResponse = (r) => {
      if (r?.success) { setRoomCode(r.roomCode); setCurrentRoom(r.roomCode); setError(''); }
      else setError(r?.error || 'Fehler beim Erstellen des Raums');
      setLoading(false);
    };
    const onJoinRoomResponse = (r) => {
      if (r?.success) { setCurrentRoom(r.roomCode); setPlayers(r.players); setError(''); }
      else setError(r?.error || 'Fehler beim Beitreten des Raums');
      setLoading(false);
    };

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
    if (!nickname.trim()) { setError('Nickname erforderlich'); return; }
    setLoading(true); setError('');
    socket.emit('createRoom', nickname.trim());
  };
  const handleJoinRoom = () => {
    if (!nickname.trim()) { setError('Nickname erforderlich'); return; }
    if (!roomCode.trim()) { setError('Raumcode erforderlich'); return; }
    setLoading(true); setError('');
    socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), nickname: nickname.trim() });
  };
  const handleLeaveRoom = () => {
    socket.emit('leaveRoom');
    setCurrentRoom(null); setPlayers([]); setRole(null);
    setGameState(null); setTimeLeft(null); setRoomCode(''); setError('');
  };
  const handleToggleLever = (lever) => {
    socket.emit('toggleLever', { lever }, (r) => {
      if (!r?.success) setError(r?.error || 'Fehler');
    });
  };
  const handleExecuteFinalAction = () => {
    setStabilizeError('');
    socket.emit('executeFinalAction', {}, (r) => {
      if (!r?.success) setStabilizeError(r?.error || 'Fehler');
    });
  };

  const formatTime = (ms) => {
    if (ms === null) return '--:--';
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const countdownClass = () => {
    if (timeLeft === null) return 'countdown safe';
    if (timeLeft < 30000)  return 'countdown danger';
    if (timeLeft < 90000)  return 'countdown warning';
    return 'countdown safe';
  };

  // ── End screens ──────────────────────────────────────────────────────────────

  if (gameState?.gamePhase === 'completed') {
    const secs = Math.floor((gameState.endTime - gameState.startTime) / 1000);
    return (
      <div className="end-screen">
        <div className="end-title win">Reaktor Stabilisiert</div>
        <div className="end-subtitle">Kritische Situation abgewendet</div>
        <div className="end-time">Zeit: {Math.floor(secs/60)}:{String(secs%60).padStart(2,'0')}</div>
        <button className="btn btn-green" onClick={handleLeaveRoom}>Neues Spiel</button>
      </div>
    );
  }
  if (gameState?.gamePhase === 'failed') {
    return (
      <div className="end-screen">
        <div className="end-title lose">Reaktor Ausgefallen</div>
        <div className="end-subtitle">Der Reaktor ist außer Kontrolle geraten</div>
        <div className="end-time" style={{color:'var(--red)'}}>KRITISCHER FEHLER</div>
        <button className="btn btn-red" onClick={handleLeaveRoom}>Neues Spiel</button>
      </div>
    );
  }

  // ── Role views ────────────────────────────────────────────────────────────────

  const renderEngineerView = () => (
    <div className="console">
      <div className="console-header">
        <span className="console-title" style={{color:'var(--yellow)'}}>▶ Ingenieur-Konsole</span>
      </div>
      <div className="console-body">
        <div className="lever-grid">
          {Object.entries(gameState.levers || {}).map(([lever, isActive]) => (
            <button
              key={lever}
              className={`lever-btn ${isActive ? 'active' : 'inactive'}`}
              onClick={() => handleToggleLever(lever)}
            >
              <div className="lever-led" />
              <div className="lever-letter">{lever}</div>
              <div className="lever-label">{isActive ? 'AKTIV' : 'INAKTIV'}</div>
            </button>
          ))}
        </div>
        <div className="lever-desc">
          {Object.entries(LEVER_INFO).map(([lever, info]) => (
            <div key={lever} className="lever-desc-item">{info.effect}</div>
          ))}
        </div>
        <div className="error-log">
          <div className="error-log-header">Systemlog</div>
          {gameState.errorMessages?.length === 0
            ? <div className="no-errors">Alle Systeme nominal</div>
            : gameState.errorMessages?.map((msg, i) => (
                <div key={i} className="error-line">{msg}</div>
              ))}
        </div>
      </div>
    </div>
  );

  const renderTechnicianView = () => (
    <div className="console">
      <div className="console-header">
        <span className="console-title" style={{color:'var(--blue)'}}>▶ Techniker-Konsole</span>
      </div>
      <div className="console-body">
        <div className="light-panel">
          {Object.entries(gameState.statusLights || {}).map(([color, isActive]) => (
            <div key={color} className="light-cell">
              <div className={`indicator-light ${isActive ? `on-${color}` : ''}`} />
              <div className="light-info">
                <div className="light-name" style={{color: isActive ? `var(--${color === 'yellow' ? 'yellow' : color === 'red' ? 'red' : color === 'blue' ? 'blue' : 'green'})` : 'var(--text-dim)'}}>
                  {LIGHT_INFO[color]?.label}
                </div>
                <div className="light-status">{isActive ? 'AN' : 'AUS'}</div>
                <div className="light-meaning">{LIGHT_INFO[color]?.meaning}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderScientistView = () => {
    const temp = gameState.temperature ?? 0;
    const pres = gameState.pressure    ?? 0;
    const tempClass = getValueClass(temp, 30, 80);
    const presClass = getValueClass(pres, 30, 70);
    return (
      <div className="console">
        <div className="console-header">
          <span className="console-title" style={{color:'var(--cyan)'}}>▶ Wissenschaftler-Konsole</span>
        </div>
        <div className="console-body">
          <div className="gauge-row">
            {/* Temperature gauge */}
            <div className="gauge-card">
              <div className="gauge-title">Temperatur</div>
              <div className={`gauge-value ${tempClass}`}>{Math.round(temp)}°C</div>
              <div className="gauge-bar-wrap">
                <div className="gauge-bar-track" />
                {/* safe zone highlight: 30-80 of 0-100 range */}
                <div className="gauge-bar-safe-zone" style={{left:'30%', width:'50%'}} />
                <div
                  className={`gauge-bar-fill ${tempClass}`}
                  style={{width: `${Math.min(100, Math.max(0, temp))}%`}}
                />
              </div>
              <div className="gauge-range"><span>0°C</span><span>100°C</span></div>
              <div className="gauge-target">Ziel: 30 – 80°C</div>
            </div>
            {/* Pressure gauge */}
            <div className="gauge-card">
              <div className="gauge-title">Druck</div>
              <div className={`gauge-value ${presClass}`}>{Math.round(pres)} bar</div>
              <div className="gauge-bar-wrap">
                <div className="gauge-bar-track" />
                {/* safe zone highlight: 30-70 of 0-100 range */}
                <div className="gauge-bar-safe-zone" style={{left:'30%', width:'40%'}} />
                <div
                  className={`gauge-bar-fill ${presClass}`}
                  style={{width: `${Math.min(100, Math.max(0, pres))}%`}}
                />
              </div>
              <div className="gauge-range"><span>0 bar</span><span>100 bar</span></div>
              <div className="gauge-target">Ziel: 30 – 70 bar</div>
            </div>
          </div>
          <div className="reactor-status-bar">
            <div className="reactor-status-label">Reaktor-Status</div>
            <div className={`reactor-status-value status-${gameState.reactorStatus}`}>
              {gameState.reactorStatus?.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOperatorView = () => {
    const temp = gameState.temperature ?? 0;
    const pres = gameState.pressure    ?? 0;
    const tempClass = getValueClass(temp, 30, 80);
    const presClass = getValueClass(pres, 30, 70);
    const inSafeZone = temp >= 30 && temp <= 80 && pres >= 30 && pres <= 70;
    return (
      <div className="console">
        <div className="console-header">
          <span className="console-title" style={{color:'var(--green)'}}>▶ Operator-Konsole</span>
        </div>
        <div className="console-body">
          <div className="operator-stats">
            <div className="stat-card">
              <div className="stat-label">Temperatur</div>
              <div className={`stat-value ${tempClass}`}>{Math.round(temp)}°C</div>
              <div className="stat-target">Ziel: 30–80</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Druck</div>
              <div className={`stat-value ${presClass}`}>{Math.round(pres)} bar</div>
              <div className="stat-target">Ziel: 30–70</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Status</div>
              <div className={`stat-value status-${gameState.reactorStatus}`}>
                {gameState.reactorStatus?.toUpperCase()}
              </div>
            </div>
          </div>
          <div className={`stabilize-zone ${inSafeZone ? 'ready' : 'not-ready'}`}>
            {inSafeZone
              ? '✓  Alle Systeme im sicheren Bereich — Stabilisierung möglich'
              : '⚠  Systeme noch außerhalb des sicheren Bereichs'}
          </div>
          {stabilizeError && (
            <div className="alert alert-error" style={{marginBottom:'12px'}}>{stabilizeError}</div>
          )}
          <button
            className={`btn-stabilize ${inSafeZone ? 'ready' : 'not-ready'}`}
            onClick={handleExecuteFinalAction}
            disabled={!inSafeZone}
          >
            Reaktor Stabilisieren
          </button>
        </div>
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
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-title">☢ Reaktorkammer</div>
        <div className="conn-indicator">
          <div className={`conn-dot ${isConnected ? 'online' : ''}`} />
          <span>{isConnected ? `VERBUNDEN · ${socketId.slice(0, 8)}` : 'GETRENNT'}</span>
        </div>
      </header>

      <div className="app-body">
        {error && <div className="alert alert-error">{error}</div>}

        {!currentRoom ? (
          // ── Lobby ──
          <div className="lobby">
            <div className="lobby-logo">
              <h1>Die Reaktorkammer</h1>
              <div className="subtitle">Kooperatives Kontrollraum-Spiel · 4 Spieler</div>
            </div>

            <div className="lobby-section">
              <div className="section-title">Identifikation</div>
              <div className="field-label">Rufzeichen</div>
              <input
                className="input"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Dein Nickname"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
              />
            </div>

            <div className="lobby-section">
              <div className="section-title">Neuen Raum erstellen</div>
              <button className="btn btn-primary btn-full" onClick={handleCreateRoom} disabled={loading}>
                {loading ? 'Bitte warten…' : '+ Raum erstellen'}
              </button>
            </div>

            <div className="lobby-section">
              <div className="section-title">Bestehendem Raum beitreten</div>
              <div className="field-label" style={{marginBottom:'8px'}}>Raumcode</div>
              <input
                className="input input-room"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Z.B. AB12"
                maxLength={4}
                style={{marginBottom:'12px'}}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <button className="btn btn-primary btn-full" onClick={handleJoinRoom} disabled={loading}>
                Raum beitreten
              </button>
            </div>
          </div>
        ) : (
          // ── In-room ──
          <>
            {/* Room header */}
            <div className="room-header">
              <div className="room-meta">
                <div className="room-code-badge">#{currentRoom}</div>
                {role && <div className={getRoleBadgeClass(role)}>{role}</div>}
              </div>
              <div className="room-controls">
                {timeLeft !== null && (
                  <div className={countdownClass()}>{formatTime(timeLeft)}</div>
                )}
                <button className="btn btn-red" onClick={handleLeaveRoom}>Verlassen</button>
              </div>
            </div>

            {/* Player list */}
            <div className="player-section">
              <div className="section-header">Besatzung ({players.length}/4)</div>
              <div className="player-grid">
                {players.map((p) => (
                  <div key={p.id} className="player-card">
                    <div className="player-name">{p.nickname}</div>
                    {p.role && <div className="player-role-tag">{p.role}</div>}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="player-slot-empty">— leer —</div>
                ))}
              </div>
            </div>

            {/* Waiting / role view */}
            {!role ? (
              <div className="waiting-banner">
                <span>Warten auf Spieler…</span>
                <span className="waiting-count">{players.length} / 4</span>
                <span>Das Spiel startet automatisch wenn 4 Spieler beigetreten sind</span>
              </div>
            ) : gameState ? (
              renderRoleView()
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
