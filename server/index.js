const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Get port from environment variable or use 3001 as fallback
const PORT = process.env.PORT || 3001;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for all routes
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'https://team-game.vercel.app'];
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
    origin: ["http://localhost:3000", "https://team-game.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  path: '/socket.io/'
});

// Add error handling
io.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

io.on('connection', (socket) => {
  console.log('Ein Spieler hat sich verbunden:', socket.id);
  console.log('Transport:', socket.conn.transport.name);
  
  socket.on('disconnect', (reason) => {
    console.log('Ein Spieler hat die Verbindung getrennt:', socket.id);
    console.log('Disconnect reason:', reason);
  });

  // Add ping/pong for connection health check
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

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
