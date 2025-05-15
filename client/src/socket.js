import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://team-game-server.onrender.com'
  : 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  withCredentials: true,
  forceNew: true,
  path: '/socket.io/',
  ackTimeout: 10000,
  retries: 3,
  secure: true
});

// Add connection status logging
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
  console.log('Socket state:', socket.connected ? 'connected' : 'disconnected');
  console.log('Socket rooms:', socket.rooms);
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

// Override emit to add logging
const originalEmit = socket.emit;
socket.emit = function(eventName, ...args) {
  console.log('Emitting event:', eventName, args);
  
  // If the last argument is a callback function
  const callback = args[args.length - 1];
  if (typeof callback === 'function') {
    // Create a new callback that logs the response
    args[args.length - 1] = (response) => {
      console.log('Event response:', eventName, response);
      callback(response);
    };
  }
  
  return originalEmit.apply(this, [eventName, ...args]);
};
