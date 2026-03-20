const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const TICK_INTERVAL_MS = 2000;           // 2 seconds per tick

const ROLES = {
  ENGINEER: 'Ingenieur',
  TECHNICIAN: 'Techniker',
  SCIENTIST: 'Wissenschaftler',
  OPERATOR: 'Operator'
};

const VALID_LEVERS = new Set(['A', 'B', 'C', 'D']);

// Factory — always returns a fresh, independent game state (no shared references)
function createGameState() {
  return {
    temperature: 20,        // starts too cold — must raise above 30
    pressure: 75,           // starts too high — must reduce below 70
    reactorStatus: 'warning',
    levers: { A: false, B: false, C: false, D: false },
    errorMessages: [],
    statusLights: { red: false, yellow: false, blue: false, green: false },
    gamePhase: 'setup',
    startTime: null,
    endTime: null
  };
}

const rooms = new Map();

function generateRoomCode() {
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

function cleanupInactiveRooms() {
  const now = Date.now();
  for (const [roomCode, room] of rooms.entries()) {
    if (now - room.lastActivity > 30 * 60 * 1000) {
      rooms.delete(roomCode);
      console.log(`Raum ${roomCode} aufgeräumt wegen Inaktivität`);
    }
  }
}
setInterval(cleanupInactiveRooms, 5 * 60 * 1000);

function updateGameState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return null;

  const state = room.gameState;

  // Lever effects
  if (state.levers.A) state.temperature += 2;
  if (state.levers.B) state.temperature -= 1;
  if (state.levers.C) state.pressure += 2;
  if (state.levers.D) state.pressure -= 1;

  // Natural drift — reactor slowly cools and pressure builds without intervention
  state.temperature -= 0.2;
  state.pressure += 0.2;

  // Clamp
  state.temperature = Math.max(0, Math.min(100, state.temperature));
  state.pressure = Math.max(0, Math.min(100, state.pressure));

  // Status lights
  state.statusLights.red    = state.temperature > 80;
  state.statusLights.yellow = state.pressure > 70;
  state.statusLights.blue   = state.temperature < 30;
  state.statusLights.green  = state.temperature >= 30 && state.temperature <= 80 &&
                               state.pressure >= 30 && state.pressure <= 70;

  // Reactor status
  if (state.temperature > 90 || state.pressure > 90) {
    state.reactorStatus = 'critical';
  } else if (state.temperature > 80 || state.pressure > 80 ||
             state.temperature < 30 || state.pressure < 30) {
    state.reactorStatus = 'warning';
  } else {
    state.reactorStatus = 'normal';
  }

  // Error messages
  state.errorMessages = [];
  if (state.temperature > 80) state.errorMessages.push('Warnung: Temperatur zu hoch!');
  if (state.pressure > 70)    state.errorMessages.push('Warnung: Druck zu hoch!');
  if (state.temperature < 30) state.errorMessages.push('Warnung: Temperatur zu niedrig!');
  if (state.pressure < 30)    state.errorMessages.push('Warnung: Druck zu niedrig!');

  // Catastrophic failure (hits the ceiling)
  if (state.gamePhase === 'running' && (state.temperature >= 100 || state.pressure >= 100)) {
    state.gamePhase = 'failed';
    state.endTime = Date.now();
  }

  return state;
}

// Role-specific views — each role only receives what they should know
function getRoleSpecificState(gameState, role) {
  const { gamePhase, startTime, endTime } = gameState;

  switch (role) {
    case ROLES.ENGINEER:
      return {
        gamePhase, startTime, endTime,
        errorMessages: [...gameState.errorMessages],
        levers: { ...gameState.levers }
      };
    case ROLES.TECHNICIAN:
      return {
        gamePhase, startTime, endTime,
        statusLights: { ...gameState.statusLights }
      };
    case ROLES.SCIENTIST:
      return {
        gamePhase, startTime, endTime,
        temperature: gameState.temperature,
        pressure: gameState.pressure,
        reactorStatus: gameState.reactorStatus
      };
    case ROLES.OPERATOR:
      // Operator sees everything — they are the one who pulls the trigger
      return {
        ...gameState,
        levers: { ...gameState.levers },
        statusLights: { ...gameState.statusLights },
        errorMessages: [...gameState.errorMessages]
      };
    default:
      return { gamePhase, startTime, endTime };
  }
}

function startGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Shuffle and assign roles
  const shuffled = Object.values(ROLES).sort(() => Math.random() - 0.5);
  room.players.forEach((player, i) => {
    player.role = shuffled[i];
    console.log(`Rolle ${player.role} → ${player.nickname}`);
  });

  room.gameState = createGameState();
  room.gameState.gamePhase = 'running';
  room.gameState.startTime = Date.now();

  // Send each player their own role-filtered view
  room.players.forEach(player => {
    io.to(player.id).emit('roleAssigned', {
      role: player.role,
      gameState: getRoleSpecificState(room.gameState, player.role)
    });
  });

  io.to(roomCode).emit('gameStarted', {
    players: room.players,
    gameState: room.gameState
  });

  console.log(`Spiel in Raum ${roomCode} gestartet`);
}

function handlePlayerLeave(socket) {
  if (!socket.roomCode) return;
  const room = rooms.get(socket.roomCode);
  if (room) {
    room.players = room.players.filter(p => p.id !== socket.id);
    room.lastActivity = Date.now();
    if (room.players.length === 0) {
      rooms.delete(socket.roomCode);
      console.log(`Raum ${socket.roomCode} gelöscht (leer)`);
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

// CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://team-game.vercel.app',
    'https://team-game-beta.vercel.app',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).send('Internal Server Error');
});

const io = socketIo(server, {
  cors: {
    origin: [
      'https://team-game.vercel.app',
      'https://team-game-beta.vercel.app',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io/',
  connectTimeout: 10000,
  ackTimeout: 10000,
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: {
    name: 'io',
    path: '/',
    httpOnly: true,
    sameSite: 'none',
    secure: true
  }
});

// Game tick — runs every TICK_INTERVAL_MS for all active rooms
setInterval(() => {
  for (const [roomCode, room] of rooms.entries()) {
    if (!room.gameState || room.gameState.gamePhase !== 'running') continue;

    const state = room.gameState;

    // Time-limit failure
    if (Date.now() - state.startTime > GAME_DURATION_MS) {
      state.gamePhase = 'failed';
      state.endTime = Date.now();
    } else {
      updateGameState(roomCode);
    }

    room.players.forEach(player => {
      io.to(player.id).emit('gameStateUpdate', {
        gameState: getRoleSpecificState(room.gameState, player.role)
      });
    });
  }
}, TICK_INTERVAL_MS);

io.engine.on('connection_error', (err) => {
  console.error('Socket.IO connection error:', err.message);
});

io.on('connection', (socket) => {
  console.log('Spieler verbunden:', socket.id);

  socket.on('createRoom', (nickname) => {
    try {
      if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
        socket.emit('createRoomResponse', { success: false, error: 'Ungültiger Nickname' });
        return;
      }
      const roomCode = generateRoomCode();
      rooms.set(roomCode, {
        players: [{ id: socket.id, nickname: nickname.trim(), role: null }],
        lastActivity: Date.now(),
        createdAt: Date.now(),
        gameState: createGameState()
      });
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.nickname = nickname.trim();
      console.log(`Raum ${roomCode} erstellt von ${nickname}`);
      socket.emit('createRoomResponse', { success: true, roomCode });
    } catch (error) {
      console.error('Error in createRoom:', error);
      socket.emit('createRoomResponse', { success: false, error: 'Interner Serverfehler' });
    }
  });

  socket.on('joinRoom', ({ roomCode, nickname }) => {
    try {
      const room = rooms.get(roomCode);
      if (!room) {
        socket.emit('joinRoomResponse', { success: false, error: 'Raum nicht gefunden' });
        return;
      }
      if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
        socket.emit('joinRoomResponse', { success: false, error: 'Ungültiger Nickname' });
        return;
      }
      if (room.players.some(p => p.nickname === nickname.trim())) {
        socket.emit('joinRoomResponse', { success: false, error: 'Nickname bereits vergeben' });
        return;
      }
      if (room.players.length >= 4) {
        socket.emit('joinRoomResponse', { success: false, error: 'Raum ist voll' });
        return;
      }

      room.players.push({ id: socket.id, nickname: nickname.trim(), role: null });
      room.lastActivity = Date.now();
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.nickname = nickname.trim();

      // Send roomCode back so the client doesn't need to track it separately
      socket.emit('joinRoomResponse', { success: true, players: room.players, roomCode });

      io.to(roomCode).emit('playerJoined', {
        players: room.players,
        newPlayer: { id: socket.id, nickname: nickname.trim() }
      });

      if (room.players.length === 4) {
        startGame(roomCode);
      }
    } catch (error) {
      console.error('Error in joinRoom:', error);
      socket.emit('joinRoomResponse', { success: false, error: 'Interner Serverfehler' });
    }
  });

  socket.on('toggleLever', ({ lever }, callback) => {
    if (typeof callback !== 'function') return;

    if (!socket.roomCode) {
      callback({ success: false, error: 'Nicht in einem Raum' });
      return;
    }
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameState || room.gameState.gamePhase !== 'running') {
      callback({ success: false, error: 'Spiel nicht aktiv' });
      return;
    }
    if (!VALID_LEVERS.has(lever)) {
      callback({ success: false, error: 'Ungültiger Hebel' });
      return;
    }
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      callback({ success: false, error: 'Spieler nicht gefunden' });
      return;
    }
    if (player.role !== ROLES.ENGINEER) {
      callback({ success: false, error: 'Nur der Ingenieur kann Hebel umschalten' });
      return;
    }

    room.gameState.levers[lever] = !room.gameState.levers[lever];
    room.lastActivity = Date.now();
    const updatedState = updateGameState(socket.roomCode);

    room.players.forEach(p => {
      io.to(p.id).emit('gameStateUpdate', {
        gameState: getRoleSpecificState(updatedState, p.role)
      });
    });

    callback({ success: true });
  });

  // Operator-only action — wins the game if reactor is in the safe zone
  socket.on('executeFinalAction', (data, callback) => {
    if (typeof callback !== 'function') return;

    if (!socket.roomCode) {
      callback({ success: false, error: 'Nicht in einem Raum' });
      return;
    }
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameState || room.gameState.gamePhase !== 'running') {
      callback({ success: false, error: 'Spiel nicht aktiv' });
      return;
    }
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      callback({ success: false, error: 'Spieler nicht gefunden' });
      return;
    }
    if (player.role !== ROLES.OPERATOR) {
      callback({ success: false, error: 'Nur der Operator kann finale Aktionen ausführen' });
      return;
    }

    const state = room.gameState;
    const inSafeZone = state.temperature >= 30 && state.temperature <= 80 &&
                       state.pressure >= 30 && state.pressure <= 70;

    if (!inSafeZone) {
      callback({ success: false, error: 'Reaktor noch nicht im sicheren Bereich' });
      return;
    }

    state.gamePhase = 'completed';
    state.endTime = Date.now();

    room.players.forEach(p => {
      io.to(p.id).emit('gameStateUpdate', {
        gameState: getRoleSpecificState(state, p.role)
      });
    });

    callback({ success: true });
  });

  socket.on('leaveRoom', () => handlePlayerLeave(socket));

  socket.on('disconnect', (reason) => {
    console.log('Spieler getrennt:', socket.id, '—', reason);
    handlePlayerLeave(socket);
  });

  socket.on('ping', () => socket.emit('pong'));
});

app.use((req, res) => {
  res.status(404).send('Route not found');
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
