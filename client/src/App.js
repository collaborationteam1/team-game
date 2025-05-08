import React from 'react';
import { socket } from './socket';

function App() {
  return (
    <div>
      <h1>Kooperatives Spiel</h1>
      <p>Verbindung zum Server: {socket.connected ? 'Verbunden' : 'Nicht verbunden'}</p>
    </div>
  );
}

export default App;
