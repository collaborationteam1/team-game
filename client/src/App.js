import React, { useState, useEffect } from 'react';
import { socket } from './socket';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState('');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [role, setRole] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);

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
    }

    function onPlayerJoined(data) {
      console.log('Player joined:', data);
      setPlayers(data.players);
    }

    function onPlayerLeft(data) {
      console.log('Player left:', data);
      setPlayers(data.players);
    }

    function onRoleAssigned(data) {
      console.log('Role assigned:', data);
      setRole(data.role);
      setGameState(data.gameState);
    }

    function onGameStarted(data) {
      console.log('Game started:', data);
      setPlayers(data.players);
      setGameState(data.gameState);
    }

    function onGameStateUpdate(data) {
      console.log('Game state updated:', data);
      setGameState(data.gameState);
    }

    function onCreateRoomResponse(response) {
      console.log('Create room response:', response);
      if (response && response.success) {
        console.log('Room created successfully:', response.roomCode);
        setRoomCode(response.roomCode);
        setCurrentRoom(response.roomCode);
        setGameState(prev => ({ ...prev, phase: 'waiting' }));
      } else {
        console.error('Failed to create room:', response?.error);
        setError(response?.error || 'Fehler beim Erstellen des Raums');
      }
      setLoading(false);
    }

    function onJoinRoomResponse(response) {
      console.log('Join room response:', response);
      if (response && response.success) {
        setCurrentRoom(roomCode.toUpperCase());
        setPlayers(response.players);
        setError('');
      } else {
        setError(response?.error || 'Fehler beim Beitreten des Raums');
      }
      setLoading(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('roleAssigned', onRoleAssigned);
    socket.on('gameStarted', onGameStarted);
    socket.on('gameStateUpdate', onGameStateUpdate);
    socket.on('createRoomResponse', onCreateRoomResponse);
    socket.on('joinRoomResponse', onJoinRoomResponse);

    // Set initial state
    setIsConnected(socket.connected);
    if (socket.connected) {
      setSocketId(socket.id);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('roleAssigned', onRoleAssigned);
      socket.off('gameStarted', onGameStarted);
      socket.off('gameStateUpdate', onGameStateUpdate);
      socket.off('createRoomResponse', onCreateRoomResponse);
      socket.off('joinRoomResponse', onJoinRoomResponse);
    };
  }, [roomCode]);

  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      setError('Bitte gib einen Nickname ein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Creating room with nickname:', nickname);
      socket.emit('createRoom', nickname);
    } catch (error) {
      console.error('Error creating room:', error);
      setError(error.message || 'Fehler beim Erstellen des Raums');
      setLoading(false);
    }
  };

  const handleJoinRoom = () => {
    if (!nickname.trim()) {
      setError('Bitte gib einen Nickname ein');
      return;
    }
    if (!roomCode.trim()) {
      setError('Bitte gib einen Raumcode ein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Joining room:', { roomCode: roomCode.toUpperCase(), nickname });
      socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), nickname });
    } catch (error) {
      console.error('Error joining room:', error);
      setError(error.message || 'Fehler beim Beitreten des Raums');
      setLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    socket.emit('leaveRoom');
    setCurrentRoom(null);
    setPlayers([]);
    setRole(null);
    setGameState(null);
  };

  const handleToggleLever = (lever) => {
    socket.emit('toggleLever', { lever }, (response) => {
      if (!response.success) {
        setError(response.error);
      }
    });
  };

  const handleExecuteFinalAction = (action) => {
    socket.emit('executeFinalAction', { action }, (response) => {
      if (!response.success) {
        setError(response.error);
      }
    });
  };

  // Rollenspezifische UI-Komponenten
  const EngineerView = () => (
    <div>
      <h3>Ingenieur-Konsole</h3>
      <div style={{ marginBottom: '20px' }}>
        <h4>Fehlermeldungen:</h4>
        {gameState.errorMessages.map((msg, index) => (
          <div key={index} style={{ color: 'red', margin: '5px 0' }}>{msg}</div>
        ))}
      </div>
      <div>
        <h4>Hebel-Steuerung:</h4>
        {Object.entries(gameState.levers).map(([lever, isActive]) => (
          <button
            key={lever}
            onClick={() => handleToggleLever(lever)}
            style={{
              padding: '10px 20px',
              margin: '5px',
              backgroundColor: isActive ? '#4CAF50' : '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Hebel {lever}: {isActive ? 'Aktiv' : 'Inaktiv'}
          </button>
        ))}
      </div>
    </div>
  );

  const TechnicianView = () => (
    <div>
      <h3>Techniker-Konsole</h3>
      <div>
        <h4>Statusleuchten:</h4>
        {Object.entries(gameState.statusLights).map(([color, isActive]) => (
          <div
            key={color}
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '10px 0'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: isActive ? color : '#ccc',
                marginRight: '10px'
              }}
            />
            <span>{color.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const ScientistView = () => (
    <div>
      <h3>Wissenschaftler-Konsole</h3>
      <div style={{ marginBottom: '20px' }}>
        <h4>Live-Daten:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h5>Temperatur</h5>
            <div style={{
              padding: '10px',
              backgroundColor: gameState.temperature > 80 ? '#ffebee' : '#e8f5e9',
              borderRadius: '4px'
            }}>
              {gameState.temperature}°C
            </div>
          </div>
          <div>
            <h5>Druck</h5>
            <div style={{
              padding: '10px',
              backgroundColor: gameState.pressure > 80 ? '#ffebee' : '#e8f5e9',
              borderRadius: '4px'
            }}>
              {gameState.pressure} bar
            </div>
          </div>
        </div>
      </div>
      <div>
        <h4>Reaktor-Status:</h4>
        <div style={{
          padding: '10px',
          backgroundColor: 
            gameState.reactorStatus === 'critical' ? '#ffebee' :
            gameState.reactorStatus === 'warning' ? '#fff3e0' : '#e8f5e9',
          borderRadius: '4px'
        }}>
          {gameState.reactorStatus.toUpperCase()}
        </div>
      </div>
    </div>
  );

  const OperatorView = () => (
    <div>
      <h3>Operator-Konsole</h3>
      <div style={{ marginBottom: '20px' }}>
        <h4>System-Übersicht:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h5>Temperatur</h5>
            <div>{gameState.temperature}°C</div>
          </div>
          <div>
            <h5>Druck</h5>
            <div>{gameState.pressure} bar</div>
          </div>
        </div>
      </div>
      <div>
        <h4>Finale Aktion:</h4>
        <button
          onClick={() => handleExecuteFinalAction('stabilize')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reaktor stabilisieren
        </button>
      </div>
    </div>
  );

  // Rollenspezifische View auswählen
  const RoleView = () => {
    switch (role) {
      case 'Ingenieur':
        return <EngineerView />;
      case 'Techniker':
        return <TechnicianView />;
      case 'Wissenschaftler':
        return <ScientistView />;
      case 'Operator':
        return <OperatorView />;
      default:
        return null;
    }
  };

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ color: '#333' }}>Die Reaktorkammer</h1>
      
      {/* Verbindungsstatus */}
      <div style={{ 
        padding: '10px',
        margin: '10px 0',
        backgroundColor: isConnected ? '#e6ffe6' : '#ffe6e6',
        borderRadius: '5px',
        border: `1px solid ${isConnected ? '#00cc00' : '#cc0000'}`
      }}>
        <p style={{ margin: '0' }}>
          Verbindung zum Server: {isConnected ? 'Verbunden' : 'Nicht verbunden'}
        </p>
        {isConnected && (
          <p style={{ margin: '5px 0 0 0', fontSize: '0.9em', color: '#666' }}>
            Socket ID: {socketId}
          </p>
        )}
      </div>

      {/* Fehlermeldung */}
      {error && (
        <div style={{
          padding: '10px',
          margin: '10px 0',
          backgroundColor: '#ffe6e6',
          borderRadius: '5px',
          border: '1px solid #cc0000',
          color: '#cc0000'
        }}>
          {error}
        </div>
      )}

      {/* Hauptbereich */}
      {!currentRoom ? (
        <div style={{ marginTop: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Dein Nickname"
              style={{
                padding: '8px',
                marginRight: '10px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Raum wird erstellt...' : 'Neuen Raum erstellen'}
            </button>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Raumcode"
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  textTransform: 'uppercase'
                }}
              />
              <button
                onClick={handleJoinRoom}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Raum beitreten
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#f5f5f5',
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Raum: {currentRoom}</h3>
            <button
              onClick={handleLeaveRoom}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Raum verlassen
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>Spieler im Raum:</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '10px'
            }}>
              {players.map((player) => (
                <div
                  key={player.id}
                  style={{
                    padding: '10px',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: '#4CAF50',
                    borderRadius: '50%'
                  }} />
                  <div>
                    <div>{player.nickname}</div>
                    {player.role && (
                      <div style={{ fontSize: '0.9em', color: '#666' }}>
                        {player.role}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rollenspezifische View */}
          {role && gameState && <RoleView />}
        </div>
      )}
    </div>
  );
}

export default App;
