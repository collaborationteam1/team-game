import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://team-game.onrender.com'
  : 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  withCredentials: true,
  forceNew: true,
  path: '/socket.io/'
});

// Add connection status logging
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  console.error('Error details:', {
    message: error.message,
    description: error.description,
    type: error.type,
    transport: socket.io.engine.transport.name
  });
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // the disconnection was initiated by the server, reconnect manually
    socket.connect();
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Reconnection attempt:', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect');
});

// Add connection attempt logging
console.log('Attempting to connect to:', SOCKET_URL);
