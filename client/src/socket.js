import { io } from 'socket.io-client';

// Remove port number from production URL
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://team-game.onrender.com'  // Correct Render URL
  : 'http://localhost:3001';

console.log('Environment:', process.env.NODE_ENV);
console.log('Socket URL:', SOCKET_URL);

export const socket = io(SOCKET_URL, {
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
  secure: true,
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  extraHeaders: {
    'Content-Type': 'application/json'
  }
});

// Enhanced connection status logging
socket.on('connect', () => {
  console.log('=== Socket Connected ===');
  console.log('Socket ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
  console.log('Socket state:', socket.connected ? 'connected' : 'disconnected');
  console.log('Socket rooms:', socket.rooms);
  console.log('Socket options:', socket.io.opts);
  console.log('Engine state:', {
    transport: socket.io.engine.transport.name,
    readyState: socket.io.engine.readyState,
    protocol: socket.io.engine.protocol,
    upgrades: socket.io.engine.upgrades
  });
});

socket.on('connect_error', (error) => {
  console.error('=== Connection Error ===');
  console.error('Error:', error);
  console.error('Error details:', {
    message: error.message,
    description: error.description,
    type: error.type,
    transport: socket.io.engine.transport.name,
    context: error.context
  });
  console.error('Socket state:', {
    connected: socket.connected,
    id: socket.id,
    transport: socket.io.engine.transport.name
  });
  
  // Try to reconnect with different transport if polling fails
  if (socket.io.engine.transport.name === 'polling') {
    console.log('Switching to WebSocket transport...');
    socket.io.opts.transports = ['websocket'];
    socket.connect();
  }
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
