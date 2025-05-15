const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Get port from environment variable or use 3001 as fallback
const PORT = process.env.PORT || 3001;

// Spielrollen
const ROLES = {
  ENGINEER: 'Ingenieur',
  TECHNICIAN: 'Techniker',
  SCIENTIST: 'Wissenschaftler',
  OPERATOR: 'Operator'
};

// Spielzustand
const gameState = {
  temperature: 50, // Starttemperatur
  pressure: 50,    // Startdruck
  reactorStatus: 'normal', // normal, warning, critical
  levers: {
    A: false,
    B: false,
    C: false,
    D: false
  },
  errorMessages: [],
  statusLights: {
    red: false,
    yellow: false,
    blue: false,
    green: false
  },
  gamePhase: 'setup', // setup, running, completed, failed
  startTime: null,
  endTime: null
};

// Speicherung der aktiven Räume
const rooms = new Map();

// Funktion zum Generieren eines Raumcodes
function generateRoomCode() {
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Funktion zum Aufräumen inaktiver Räume
function cleanupInactiveRooms() {
  const now = Date.now();
  for (const [roomCode, room] of rooms.entries()) {
    if (now - room.lastActivity > 30 * 60 * 1000) { // 30 Minuten
      rooms.delete(roomCode);
      console.log(`Raum ${roomCode} wurde aufgeräumt wegen Inaktivität`);
    }
  }
}

// Regelmäßige Überprüfung auf inaktive Räume
setInterval(cleanupInactiveRooms, 5 * 60 * 1000); // Alle 5 Minuten prüfen

// Funktion zum Aktualisieren des Spielzustands
function updateGameState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;

  const state = room.gameState;
  
  // Temperatur und Druck basierend auf Hebel-Positionen
  if (state.levers.A) state.temperature += 2;
  if (state.levers.B) state.temperature -= 1;
  if (state.levers.C) state.pressure += 2;
  if (state.levers.D) state.pressure -= 1;

  // Statusleuchten basierend auf Werten
  state.statusLights.red = state.temperature > 80;
  state.statusLights.yellow = state.pressure > 70;
  state.statusLights.blue = state.temperature < 30;
  state.statusLights.green = state.temperature >= 30 && state.temperature <= 80 && 
                            state.pressure >= 30 && state.pressure <= 70;

  // Reaktor-Status
  if (state.temperature > 90 || state.pressure > 90) {
    state.reactorStatus = 'critical';
  } else if (state.temperature > 80 || state.pressure > 80) {
    state.reactorStatus = 'warning';
  } else {
    state.reactorStatus = 'normal';
  }

  // Fehlermeldungen generieren
  state.errorMessages = [];
  if (state.temperature > 80) {
    state.errorMessages.push('Warnung: Temperatur zu hoch!');
  }
  if (state.pressure > 80) {
    state.errorMessages.push('Warnung: Druck zu hoch!');
  }
  if (state.temperature < 30) {
    state.errorMessages.push('Warnung: Temperatur zu niedrig!');
  }
  if (state.pressure < 30) {
    state.errorMessages.push('Warnung: Druck zu niedrig!');
  }

  // Spielende prüfen
  if (state.gamePhase === 'running') {
    if (state.temperature >= 30 && state.temperature <= 80 && 
        state.pressure >= 30 && state.pressure <= 70 && 
        state.statusLights.green) {
      state.gamePhase = 'completed';
      state.endTime = Date.now();
    } else if (state.temperature > 95 || state.pressure > 95) {
      state.gamePhase = 'failed';
      state.endTime = Date.now();
    }
  }

  return state;
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for all routes
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://team-game.vercel.app',
    'https://team-game-beta.vercel.app'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Add basic routes before socket.io setup
app.get('/', (req, res) => {
  console.log('Root route accessed');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  console.log('Health check accessed');
  res.status(200).send('OK');
});

const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://team-game.vercel.app",
      "https://team-game-beta.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  path: '/socket.io/',
  connectTimeout: 10000,
  ackTimeout: 10000
});

// Add error handling
io.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

io.on('connection', (socket) => {
  console.log('Ein Spieler hat sich verbunden:', socket.id);
  console.log('Transport:', socket.conn.transport.name);
  
  // Raum erstellen
  socket.on('createRoom', (nickname) => {
    try {
      console.log('Create room request received from:', socket.id);
      console.log('Nickname:', nickname);
      
      if (!nickname || typeof nickname !== 'string') {
        console.log('Error: Invalid nickname');
        socket.emit('createRoomResponse', { success: false, error: 'Ungültiger Nickname' });
        return;
      }

      const roomCode = generateRoomCode();
      const roomData = {
        players: [{ id: socket.id, nickname, role: null }],
        lastActivity: Date.now(),
        createdAt: Date.now(),
        gameState: { ...gameState }
      };
      
      rooms.set(roomCode, roomData);
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.nickname = nickname;
      
      console.log(`Raum ${roomCode} wurde erstellt von ${nickname}`);
      
      // Send response as a separate event
      const response = { success: true, roomCode };
      console.log('Sending response:', response);
      socket.emit('createRoomResponse', response);
    } catch (error) {
      console.error('Error in createRoom:', error);
      socket.emit('createRoomResponse', { success: false, error: 'Interner Serverfehler' });
    }
  });

  // Raum beitreten
  socket.on('joinRoom', ({ roomCode, nickname }) => {
    try {
      console.log('Join room request received:', { roomCode, nickname });
      const room = rooms.get(roomCode);
      
      if (!room) {
        console.log('Room not found:', roomCode);
        socket.emit('joinRoomResponse', { success: false, error: 'Raum nicht gefunden' });
        return;
      }

      if (room.players.some(p => p.nickname === nickname)) {
        console.log('Nickname already taken:', nickname);
        socket.emit('joinRoomResponse', { success: false, error: 'Nickname bereits vergeben' });
        return;
      }

      if (room.players.length >= 4) {
        console.log('Room is full:', roomCode);
        socket.emit('joinRoomResponse', { success: false, error: 'Raum ist voll' });
        return;
      }

      room.players.push({ id: socket.id, nickname, role: null });
      room.lastActivity = Date.now();
      
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.nickname = nickname;

      console.log(`Player ${nickname} joined room ${roomCode}`);
      console.log('Players in room:', room.players.length);

      // Send success response
      socket.emit('joinRoomResponse', { success: true, players: room.players });

      // Informiere alle Spieler im Raum
      io.to(roomCode).emit('playerJoined', {
        players: room.players,
        newPlayer: { id: socket.id, nickname }
      });

      // If we now have exactly 4 players, start the game
      if (room.players.length === 4) {
        console.log('Starting game in room:', roomCode);
        
        // Rollen zufällig verteilen
        const roles = Object.values(ROLES);
        room.players.forEach(player => {
          const randomIndex = Math.floor(Math.random() * roles.length);
          player.role = roles.splice(randomIndex, 1)[0];
          console.log(`Assigned role ${player.role} to player ${player.nickname}`);
        });

        // Spielzustand initialisieren
        room.gameState = { ...gameState };
        room.gameState.gamePhase = 'running';
        room.gameState.startTime = Date.now();

        // Spieler über ihre Rollen informieren
        room.players.forEach(player => {
          io.to(player.id).emit('roleAssigned', {
            role: player.role,
            gameState: getRoleSpecificState(room.gameState, player.role)
          });
        });

        // Allen Spielern den aktualisierten Spieler-Status senden
        io.to(roomCode).emit('gameStarted', {
          players: room.players,
          gameState: room.gameState
        });
      }
    } catch (error) {
      console.error('Error in joinRoom:', error);
      socket.emit('joinRoomResponse', { success: false, error: 'Interner Serverfehler' });
    }
  });

  // Spiel starten
  socket.on('startGame', (callback) => {
    try {
      console.log('Start game request received from:', socket.id);
      console.log('Current room:', socket.roomCode);
      
      if (!socket.roomCode) {
        console.log('Error: Player not in a room');
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Nicht in einem Raum' });
        }
        return;
      }

      const room = rooms.get(socket.roomCode);
      if (!room) {
        console.log('Error: Room not found');
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Raum nicht gefunden' });
        }
        return;
      }

      console.log('Players in room:', room.players.length);
      if (room.players.length !== 4) {
        console.log('Error: Not enough players');
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Genau 4 Spieler benötigt' });
        }
        return;
      }

      // Rollen zufällig verteilen
      const roles = Object.values(ROLES);
      room.players.forEach(player => {
        const randomIndex = Math.floor(Math.random() * roles.length);
        player.role = roles.splice(randomIndex, 1)[0];
        console.log(`Assigned role ${player.role} to player ${player.nickname}`);
      });

      // Spielzustand initialisieren
      room.gameState = { ...gameState };
      room.gameState.gamePhase = 'running';
      room.gameState.startTime = Date.now();

      // Spieler über ihre Rollen informieren
      room.players.forEach(player => {
        io.to(player.id).emit('roleAssigned', {
          role: player.role,
          gameState: getRoleSpecificState(room.gameState, player.role)
        });
      });

      // Allen Spielern den aktualisierten Spieler-Status senden
      io.to(socket.roomCode).emit('gameStarted', {
        players: room.players,
        gameState: room.gameState
      });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
      console.log(`Spiel in Raum ${socket.roomCode} gestartet`);
    } catch (error) {
      console.error('Error in startGame:', error);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Interner Serverfehler' });
      }
    }
  });

  // Hebel umschalten
  socket.on('toggleLever', ({ lever }, callback) => {
    if (!socket.roomCode) {
      callback({ success: false, error: 'Nicht in einem Raum' });
      return;
    }

    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameState) {
      callback({ success: false, error: 'Spiel nicht aktiv' });
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (player.role !== ROLES.ENGINEER) {
      callback({ success: false, error: 'Nur der Ingenieur kann Hebel umschalten' });
      return;
    }

    room.gameState.levers[lever] = !room.gameState.levers[lever];
    const updatedState = updateGameState(socket.roomCode);

    // Allen Spielern den aktualisierten Zustand senden
    room.players.forEach(player => {
      io.to(player.id).emit('gameStateUpdate', {
        gameState: getRoleSpecificState(updatedState, player.role)
      });
    });

    callback({ success: true });
  });

  // Finale Aktion ausführen
  socket.on('executeFinalAction', ({ action }, callback) => {
    if (!socket.roomCode) {
      callback({ success: false, error: 'Nicht in einem Raum' });
      return;
    }

    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameState) {
      callback({ success: false, error: 'Spiel nicht aktiv' });
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (player.role !== ROLES.OPERATOR) {
      callback({ success: false, error: 'Nur der Operator kann finale Aktionen ausführen' });
      return;
    }

    // Hier können finale Aktionen implementiert werden
    // z.B. PIN-Eingabe, Knopfdruckreihenfolge, etc.

    callback({ success: true });
  });

  // Spieler verlässt den Raum
  socket.on('leaveRoom', () => {
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        room.lastActivity = Date.now();

        if (room.players.length === 0) {
          rooms.delete(socket.roomCode);
          console.log(`Raum ${socket.roomCode} wurde gelöscht (leer)`);
        } else {
          io.to(socket.roomCode).emit('playerLeft', {
            players: room.players,
            leftPlayer: { id: socket.id, nickname: socket.nickname }
          });
        }
      }
      socket.leave(socket.roomCode);
      delete socket.roomCode;
      delete socket.nickname;
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Ein Spieler hat die Verbindung getrennt:', socket.id);
    console.log('Disconnect reason:', reason);
    
    // Behandle das Verlassen des Raums beim Disconnect
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        room.lastActivity = Date.now();

        if (room.players.length === 0) {
          rooms.delete(socket.roomCode);
          console.log(`Raum ${socket.roomCode} wurde gelöscht (leer)`);
        } else {
          io.to(socket.roomCode).emit('playerLeft', {
            players: room.players,
            leftPlayer: { id: socket.id, nickname: socket.nickname }
          });
        }
      }
    }
  });

  // Add ping/pong for connection health check
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Hilfsfunktion für rollenspezifische Spielzustände
function getRoleSpecificState(gameState, role) {
  const state = { ...gameState };
  
  switch (role) {
    case ROLES.ENGINEER:
      // Ingenieur sieht Fehlermeldungen und Hebel-Status
      return {
        ...state,
        errorMessages: state.errorMessages,
        levers: state.levers
      };
    
    case ROLES.TECHNICIAN:
      // Techniker sieht Statusleuchten
      return {
        ...state,
        statusLights: state.statusLights
      };
    
    case ROLES.SCIENTIST:
      // Wissenschaftler sieht Live-Daten
      return {
        ...state,
        temperature: state.temperature,
        pressure: state.pressure,
        reactorStatus: state.reactorStatus
      };
    
    case ROLES.OPERATOR:
      // Operator sieht alles, aber kann nur finale Aktionen ausführen
      return state;
    
    default:
      return state;
  }
}

// Add a catch-all route for undefined routes
app.use((req, res) => {
  console.log('Undefined route accessed:', req.url);
  res.status(404).send('Route not found');
});

// Add error handling for the server
server.on('error', (error) => {
  console.error('Server error:', error);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`Root endpoint available at: http://localhost:${PORT}/`);
  console.log(`Static files directory: ${path.join(__dirname, 'public')}`);
});
