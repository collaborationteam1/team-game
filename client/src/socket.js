import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'https://team-game.onrender.com'
  : 'http://localhost:3001';

console.log('Connecting to:', SOCKET_URL);

export const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 30000,           // allow for Render cold-start (~30s)
  autoConnect: true,
  withCredentials: true,
  forceNew: true,
  path: '/socket.io/',
  ackTimeout: 10000,
  secure: true,
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id, '— transport:', socket.io.engine.transport.name);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    socket.connect();
  }
});

socket.on('reconnect', (n) => {
  console.log('Reconnected after', n, 'attempts');
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect after all attempts');
});

// Log all outgoing events and their acknowledgment responses
const originalEmit = socket.emit.bind(socket);
socket.emit = function (eventName, ...args) {
  const lastArg = args[args.length - 1];
  if (typeof lastArg === 'function') {
    args[args.length - 1] = (response) => {
      console.log(`[ack] ${eventName}`, response);
      lastArg(response);
    };
  }
  console.log(`[emit] ${eventName}`, args.slice(0, -1));
  return originalEmit(eventName, ...args);
};
