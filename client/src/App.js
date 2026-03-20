import React, { useState, useEffect } from 'react';
import { socket } from './socket';

const GAME_DURATION_MS = 5 * 60 * 1000;

const LEVER_INFO = {
  A: 'Temp +2',
  B: 'Temp −1',
  C: 'Druck +2',
  D: 'Druck −1',
};

const LIGHT_META = {
  red:    { label: 'ROT',  meaning: 'Temp zu hoch (>80°C)',         tw: 'bg-rose-500',   glow: 'shadow-glow-red',   ring: 'ring-rose-500' },
  yellow: { label: 'GELB', meaning: 'Druck zu hoch (>70 bar)',       tw: 'bg-amber-400',  glow: 'shadow-glow-yellow',ring: 'ring-amber-400' },
  blue:   { label: 'BLAU', meaning: 'Temp zu niedrig (<30°C)',       tw: 'bg-sky-400',    glow: 'shadow-glow-blue',  ring: 'ring-sky-400' },
  green:  { label: 'GRÜN', meaning: 'Alle Systeme im sicheren Bereich', tw: 'bg-emerald-400', glow: 'shadow-glow-green', ring: 'ring-emerald-400' },
};

function valueState(val, lo, hi) {
  if (val < lo || val > hi) return 'danger';
  if (val < lo + 10 || val > hi - 10) return 'warning';
  return 'safe';
}

function valueColor(state) {
  if (state === 'danger')  return 'text-rose-400';
  if (state === 'warning') return 'text-amber-400';
  return 'text-emerald-400';
}

function barColor(state) {
  if (state === 'danger')  return 'bg-rose-500';
  if (state === 'warning') return 'bg-amber-400';
  return 'bg-emerald-400';
}

function roleBadge(role) {
  const base = 'text-xs px-2.5 py-1 rounded border font-mono uppercase tracking-widest';
  switch (role) {
    case 'Ingenieur':       return `${base} text-amber-400  border-amber-400  bg-amber-400/10`;
    case 'Techniker':       return `${base} text-sky-400    border-sky-400    bg-sky-400/10`;
    case 'Wissenschaftler': return `${base} text-teal-400   border-teal-400   bg-teal-400/10`;
    case 'Operator':        return `${base} text-emerald-400 border-emerald-400 bg-emerald-400/10`;
    default: return base;
  }
}

export default function App() {
  const [isConnected, setIsConnected]           = useState(socket.connected);
  const [socketId, setSocketId]                 = useState('');
  const [nickname, setNickname]                 = useState('');
  const [roomCode, setRoomCode]                 = useState('');
  const [currentRoom, setCurrentRoom]           = useState(null);
  const [players, setPlayers]                   = useState([]);
  const [error, setError]                       = useState('');
  const [role, setRole]                         = useState(null);
  const [gameState, setGameState]               = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [stabilizeError, setStabilizeError]     = useState('');
  const [timeLeft, setTimeLeft]                 = useState(null);

  useEffect(() => {
    if (!gameState?.startTime || gameState.gamePhase !== 'running') { setTimeLeft(null); return; }
    const id = setInterval(() => setTimeLeft(Math.max(0, GAME_DURATION_MS - (Date.now() - gameState.startTime))), 500);
    return () => clearInterval(id);
  }, [gameState?.startTime, gameState?.gamePhase]);

  useEffect(() => {
    const onConnect    = () => { setIsConnected(true);  setSocketId(socket.id); };
    const onDisconnect = () => { setIsConnected(false); setSocketId(''); setCurrentRoom(null); setPlayers([]); setRole(null); setGameState(null); setTimeLeft(null); };
    const onPlayerJoined    = (d) => setPlayers(d.players);
    const onPlayerLeft      = (d) => setPlayers(d.players);
    const onRoleAssigned    = (d) => { setRole(d.role); setGameState(d.gameState); };
    const onGameStarted     = (d) => { setPlayers(d.players); setGameState(d.gameState); };
    const onGameStateUpdate = (d) => setGameState(d.gameState);
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
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect);
      socket.off('playerJoined', onPlayerJoined); socket.off('playerLeft', onPlayerLeft);
      socket.off('roleAssigned', onRoleAssigned); socket.off('gameStarted', onGameStarted);
      socket.off('gameStateUpdate', onGameStateUpdate);
      socket.off('createRoomResponse', onCreateRoomResponse);
      socket.off('joinRoomResponse', onJoinRoomResponse);
    };
  }, []);

  const handleCreateRoom       = () => { if (!nickname.trim()) { setError('Nickname erforderlich'); return; } setLoading(true); setError(''); socket.emit('createRoom', nickname.trim()); };
  const handleJoinRoom         = () => { if (!nickname.trim()) { setError('Nickname erforderlich'); return; } if (!roomCode.trim()) { setError('Raumcode erforderlich'); return; } setLoading(true); setError(''); socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), nickname: nickname.trim() }); };
  const handleLeaveRoom        = () => { socket.emit('leaveRoom'); setCurrentRoom(null); setPlayers([]); setRole(null); setGameState(null); setTimeLeft(null); setRoomCode(''); setError(''); };
  const handleToggleLever      = (l) => socket.emit('toggleLever', { lever: l }, (r) => { if (!r?.success) setError(r?.error || 'Fehler'); });
  const handleExecuteFinalAction = () => { setStabilizeError(''); socket.emit('executeFinalAction', {}, (r) => { if (!r?.success) setStabilizeError(r?.error || 'Fehler'); }); };

  const fmt = (ms) => { if (ms === null) return '--:--'; const s = Math.ceil(ms / 1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  const timerClass = timeLeft === null ? '' : timeLeft < 30000 ? 'text-rose-400 animate-blink-fast' : timeLeft < 90000 ? 'text-amber-400 animate-blink' : 'text-slate-200';

  // ── Shared input / button primitives ────────────────────────────────────────

  const Input = ({ value, onChange, placeholder, className = '', ...rest }) => (
    <input
      value={value} onChange={onChange} placeholder={placeholder}
      className={`w-full bg-reactor-bg border border-reactor-b2 rounded px-3 py-2.5 text-slate-200 font-mono text-sm placeholder-slate-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors ${className}`}
      {...rest}
    />
  );

  const Btn = ({ onClick, disabled, variant = 'teal', children, className = '' }) => {
    const variants = {
      teal:    'border-teal-500   text-teal-400   bg-teal-500/10   hover:bg-teal-500/20   hover:shadow-glow-teal',
      green:   'border-emerald-500 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:shadow-glow-green',
      red:     'border-rose-500   text-rose-400   bg-rose-500/10   hover:bg-rose-500/20   hover:shadow-glow-red',
      ghost:   'border-reactor-b2 text-slate-400  bg-transparent   hover:border-slate-500',
    };
    return (
      <button onClick={onClick} disabled={disabled}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2 border rounded font-mono text-sm uppercase tracking-widest transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${variants[variant]} ${className}`}>
        {children}
      </button>
    );
  };

  // ── End screens ──────────────────────────────────────────────────────────────

  if (gameState?.gamePhase === 'completed') {
    const secs = Math.floor((gameState.endTime - gameState.startTime) / 1000);
    return (
      <div className="min-h-screen bg-reactor-bg flex flex-col items-center justify-center text-center px-6 font-mono">
        <div className="text-5xl font-display font-black uppercase tracking-widest text-emerald-400 shadow-glow-green mb-3">
          Reaktor Stabilisiert
        </div>
        <p className="text-slate-400 text-sm tracking-widest uppercase mb-2">Kritische Situation abgewendet</p>
        <p className="text-2xl font-display text-slate-200 mb-10">
          {Math.floor(secs/60)}:{String(secs%60).padStart(2,'0')}
        </p>
        <Btn variant="green" onClick={handleLeaveRoom}>Neues Spiel</Btn>
      </div>
    );
  }
  if (gameState?.gamePhase === 'failed') {
    return (
      <div className="min-h-screen bg-reactor-bg flex flex-col items-center justify-center text-center px-6 font-mono">
        <div className="text-5xl font-display font-black uppercase tracking-widest text-rose-400 shadow-glow-red mb-3 animate-pulse-fast">
          Reaktor Ausgefallen
        </div>
        <p className="text-slate-400 text-sm tracking-widest uppercase mb-2">Der Reaktor ist außer Kontrolle geraten</p>
        <p className="text-xl font-display text-rose-500 mb-10 animate-blink">KRITISCHER FEHLER</p>
        <Btn variant="red" onClick={handleLeaveRoom}>Neues Spiel</Btn>
      </div>
    );
  }

  // ── Role views ────────────────────────────────────────────────────────────────

  const renderEngineerView = () => (
    <div className="bg-reactor-surface border border-reactor-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-reactor-s2 border-b border-reactor-border">
        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-glow-yellow" />
        <span className="font-display text-xs uppercase tracking-widest text-amber-400">Ingenieur-Konsole</span>
      </div>
      <div className="p-5">
        {/* Lever grid */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          {Object.entries(gameState.levers || {}).map(([lever, isActive]) => (
            <button key={lever} onClick={() => handleToggleLever(lever)}
              className={`relative flex flex-col items-center gap-2 py-5 px-2 rounded-lg border font-mono transition-all duration-150 active:scale-95
                ${isActive
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-400 shadow-glow-green'
                  : 'bg-reactor-s3 border-reactor-b2 text-slate-500 hover:border-slate-400'}`}>
              <span className={`absolute top-2 right-2 w-2 h-2 rounded-full transition-all ${isActive ? 'bg-emerald-400 shadow-glow-green' : 'bg-slate-600'}`} />
              <span className="font-display text-2xl font-bold leading-none">{lever}</span>
              <span className="text-xs uppercase tracking-widest">{isActive ? 'Aktiv' : 'Aus'}</span>
            </button>
          ))}
        </div>
        {/* Lever descriptions */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {Object.entries(LEVER_INFO).map(([l, desc]) => (
            <div key={l} className="text-center text-xs text-slate-500 tracking-wide">{desc}/tick</div>
          ))}
        </div>
        {/* Error log */}
        <div className="bg-reactor-bg border border-reactor-border rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Systemlog</div>
          {gameState.errorMessages?.length === 0
            ? <div className="flex items-center gap-2 text-sm text-emerald-400"><span>✓</span> Alle Systeme nominal</div>
            : gameState.errorMessages?.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-rose-400 py-1.5 border-b border-rose-950 last:border-0 animate-pulse-fast">
                  <span className="text-xs">▲</span>{msg}
                </div>
              ))}
        </div>
      </div>
    </div>
  );

  const renderTechnicianView = () => (
    <div className="bg-reactor-surface border border-reactor-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-reactor-s2 border-b border-reactor-border">
        <span className="w-2 h-2 rounded-full bg-sky-400 shadow-glow-blue" />
        <span className="font-display text-xs uppercase tracking-widest text-sky-400">Techniker-Konsole</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(gameState.statusLights || {}).map(([color, isActive]) => {
            const meta = LIGHT_META[color];
            return (
              <div key={color} className="flex items-center gap-4 bg-reactor-s2 border border-reactor-border rounded-lg p-4">
                <div className={`w-12 h-12 rounded-full flex-shrink-0 border-2 transition-all duration-300
                  ${isActive ? `${meta.tw} ${meta.glow} border-white/20 animate-pulse-slow` : 'bg-slate-800 border-slate-700'}`} />
                <div>
                  <div className={`font-display text-sm uppercase tracking-widest font-bold transition-colors ${isActive ? `text-${color === 'yellow' ? 'amber' : color === 'red' ? 'rose' : color === 'blue' ? 'sky' : 'emerald'}-400` : 'text-slate-500'}`}>
                    {meta.label}
                  </div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">{isActive ? 'AN' : 'AUS'}</div>
                  <div className="text-xs text-slate-600 mt-1 leading-tight">{meta.meaning}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderScientistView = () => {
    const temp = gameState.temperature ?? 0;
    const pres = gameState.pressure    ?? 0;
    const tState = valueState(temp, 30, 80);
    const pState = valueState(pres, 30, 70);

    const Gauge = ({ label, value, state, unit, lo, hi, safeLeft, safeWidth, target }) => (
      <div className="bg-reactor-s2 border border-reactor-border rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">{label}</div>
        <div className={`font-display text-4xl font-bold mb-4 transition-colors ${valueColor(state)} ${state === 'danger' ? 'animate-blink' : ''}`}>
          {Math.round(value)}<span className="text-lg ml-1">{unit}</span>
        </div>
        <div className="relative h-2.5 bg-reactor-bg rounded-full mb-1.5 overflow-hidden">
          {/* safe zone */}
          <div className="absolute top-0 h-full bg-emerald-900/40 border-l border-r border-emerald-700/40 rounded"
            style={{ left: `${safeLeft}%`, width: `${safeWidth}%` }} />
          {/* fill */}
          <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${barColor(state)}`}
            style={{ width: `${Math.min(100, Math.max(1, value))}%` }} />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>0</span><span>100</span>
        </div>
        <div className="text-xs text-emerald-600">Ziel: {target}</div>
      </div>
    );

    return (
      <div className="bg-reactor-surface border border-reactor-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-reactor-s2 border-b border-reactor-border">
          <span className="w-2 h-2 rounded-full bg-teal-400 shadow-glow-teal" />
          <span className="font-display text-xs uppercase tracking-widest text-teal-400">Wissenschaftler-Konsole</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Gauge label="Temperatur" value={temp} state={tState} unit="°C"  lo={30} hi={80} safeLeft={30} safeWidth={50} target="30 – 80°C" />
            <Gauge label="Druck"      value={pres} state={pState} unit=" bar" lo={30} hi={70} safeLeft={30} safeWidth={40} target="30 – 70 bar" />
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-reactor-s2 border border-reactor-border rounded-lg">
            <span className="text-xs text-slate-500 uppercase tracking-widest">Reaktor-Status</span>
            <span className={`font-display text-sm uppercase tracking-widest font-bold
              ${gameState.reactorStatus === 'critical' ? 'text-rose-400 animate-blink-fast' :
                gameState.reactorStatus === 'warning'  ? 'text-amber-400' : 'text-emerald-400'}`}>
              {gameState.reactorStatus?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderOperatorView = () => {
    const temp = gameState.temperature ?? 0;
    const pres = gameState.pressure    ?? 0;
    const tState = valueState(temp, 30, 80);
    const pState = valueState(pres, 30, 70);
    const inSafeZone = temp >= 30 && temp <= 80 && pres >= 30 && pres <= 70;

    return (
      <div className="bg-reactor-surface border border-reactor-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-reactor-s2 border-b border-reactor-border">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-glow-green" />
          <span className="font-display text-xs uppercase tracking-widest text-emerald-400">Operator-Konsole</span>
        </div>
        <div className="p-5 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Temperatur', value: `${Math.round(temp)}°C`,    state: tState, target: 'Ziel: 30–80' },
              { label: 'Druck',      value: `${Math.round(pres)} bar`,  state: pState, target: 'Ziel: 30–70' },
              { label: 'Status',     value: gameState.reactorStatus?.toUpperCase(),
                state: gameState.reactorStatus === 'critical' ? 'danger' : gameState.reactorStatus === 'warning' ? 'warning' : 'safe',
                target: '' },
            ].map(({ label, value, state, target }) => (
              <div key={label} className="bg-reactor-s2 border border-reactor-border rounded-lg p-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-1.5">{label}</div>
                <div className={`font-display text-xl font-bold ${valueColor(state)} ${state === 'danger' ? 'animate-blink' : ''}`}>{value}</div>
                {target && <div className="text-xs text-slate-600 mt-1">{target}</div>}
              </div>
            ))}
          </div>

          {/* Status banner */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all
            ${inSafeZone
              ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400'
              : 'bg-amber-950/30 border-amber-800/50 text-amber-400'}`}>
            <span className="text-base">{inSafeZone ? '✓' : '⚠'}</span>
            <span className="font-mono tracking-wide">
              {inSafeZone
                ? 'Alle Systeme im sicheren Bereich — Stabilisierung möglich'
                : 'Systeme noch außerhalb des sicheren Bereichs'}
            </span>
          </div>

          {stabilizeError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-950/40 border border-rose-800 rounded-lg text-sm text-rose-400">
              {stabilizeError}
            </div>
          )}

          {/* Stabilize button */}
          <button
            onClick={handleExecuteFinalAction}
            disabled={!inSafeZone}
            className={`w-full py-4 font-display text-base uppercase tracking-widest rounded-lg border-2 transition-all duration-200
              ${inSafeZone
                ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400 shadow-glow-green hover:bg-emerald-500/20 hover:shadow-[0_0_30px_rgba(52,211,153,0.4)] active:scale-[.98]'
                : 'bg-transparent border-slate-700 text-slate-600 cursor-not-allowed'}`}>
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
    <div className="min-h-screen bg-reactor-bg font-mono text-slate-200">

      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 bg-reactor-surface border-b border-reactor-border">
        <span className="font-display text-sm font-bold uppercase tracking-widest text-teal-400" style={{textShadow:'0 0 20px rgba(45,212,191,.4)'}}>
          ☢ Reaktorkammer
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-400 shadow-glow-green' : 'bg-rose-500'}`} />
          <span>{isConnected ? `Verbunden · ${socketId.slice(0,8)}` : 'Getrennt'}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-5 bg-rose-950/40 border border-rose-800 rounded-lg text-sm text-rose-400">
            <span>⚠</span> {error}
          </div>
        )}

        {!currentRoom ? (
          // ── Lobby ──
          <div className="max-w-sm mx-auto">
            <div className="text-center mb-10">
              <h1 className="font-display text-3xl font-black uppercase tracking-widest text-teal-400 mb-2"
                style={{textShadow:'0 0 30px rgba(45,212,191,.5)'}}>
                Die Reaktorkammer
              </h1>
              <p className="text-xs text-slate-500 tracking-widest uppercase">Kooperatives Kontrollraum-Spiel · 4 Spieler</p>
            </div>

            <div className="space-y-3">
              <div className="bg-reactor-surface border border-reactor-border rounded-lg p-5">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-0.5 h-3 bg-teal-400 rounded" />Identifikation
                </div>
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Dein Nickname"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()} />
              </div>

              <div className="bg-reactor-surface border border-reactor-border rounded-lg p-5">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-0.5 h-3 bg-teal-400 rounded" />Neuen Raum erstellen
                </div>
                <Btn variant="teal" onClick={handleCreateRoom} disabled={loading} className="w-full">
                  {loading ? 'Bitte warten…' : '+ Raum erstellen'}
                </Btn>
              </div>

              <div className="bg-reactor-surface border border-reactor-border rounded-lg p-5">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-0.5 h-3 bg-teal-400 rounded" />Raum beitreten
                </div>
                <Input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Raumcode (z.B. AB12)" className="mb-3 uppercase tracking-widest"
                  maxLength={4} onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()} />
                <Btn variant="teal" onClick={handleJoinRoom} disabled={loading} className="w-full">
                  Beitreten
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          // ── In-room ──
          <div className="space-y-5">
            {/* Room header */}
            <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 bg-reactor-surface border border-reactor-border rounded-lg">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-display text-lg font-bold text-teal-400 tracking-widest">#{currentRoom}</span>
                {role && <span className={roleBadge(role)}>{role}</span>}
              </div>
              <div className="flex items-center gap-4">
                {timeLeft !== null && (
                  <span className={`font-display text-xl font-bold tracking-widest ${timerClass}`}>
                    {fmt(timeLeft)}
                  </span>
                )}
                <Btn variant="red" onClick={handleLeaveRoom}>Verlassen</Btn>
              </div>
            </div>

            {/* Players */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-slate-500 uppercase tracking-widest">Besatzung ({players.length}/4)</span>
                <div className="flex-1 h-px bg-reactor-border" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {players.map((p) => (
                  <div key={p.id} className="bg-reactor-s2 border border-reactor-border rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="text-sm truncate">{p.nickname}</span>
                    </div>
                    {p.role && <div className="text-xs text-slate-500 uppercase tracking-wide mt-0.5 pl-3.5">{p.role}</div>}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                  <div key={`e${i}`} className="border border-dashed border-reactor-border rounded-lg px-3 py-2.5 text-xs text-slate-700 text-center tracking-wide">
                    — leer —
                  </div>
                ))}
              </div>
            </div>

            {/* Waiting / role view */}
            {!role ? (
              <div className="text-center py-10 border border-dashed border-reactor-b2 rounded-lg">
                <div className="text-3xl font-display font-bold text-teal-400 mb-1">{players.length} / 4</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">Warten auf Spieler…</div>
                <div className="text-xs text-slate-600 mt-2">Spiel startet automatisch bei 4 Spielern</div>
              </div>
            ) : gameState ? renderRoleView() : null}
          </div>
        )}
      </div>
    </div>
  );
}
