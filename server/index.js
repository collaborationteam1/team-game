const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {
  console.log('Ein Spieler hat sich verbunden:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Ein Spieler hat die Verbindung getrennt:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('Server läuft auf Port 3001');
});
