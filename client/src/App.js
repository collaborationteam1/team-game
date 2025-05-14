import React, { useState, useEffect } from 'react';
import { socket } from './socket';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState('');

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id);
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId('');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Set initial state
    setIsConnected(socket.connected);
    if (socket.connected) {
      setSocketId(socket.id);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ color: '#333' }}>Kooperatives Spiel</h1>
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
    </div>
  );
}

export default App;
