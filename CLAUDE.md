# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Die Reaktorkammer" (The Reactor Chamber) is a 4-player cooperative real-time game. Players are assigned roles and must collaborate to stabilize a reactor by managing temperature and pressure within safe bounds. The game uses Socket.IO for real-time communication between a React frontend and a Node.js backend.

## Architecture

This is a monorepo with two separate Node.js projects:

- **`client/`** — React app (Create React App), deployed to Vercel at `https://team-game.vercel.app`
- **`server/`** — Express + Socket.IO server, deployed to Render at `https://team-game.onrender.com`

The client connects to the server exclusively via Socket.IO (no REST API calls for game logic). All game state lives on the server and is pushed to clients via events. Each player receives a **role-filtered view** of the game state — `getRoleSpecificState()` in `server/index.js` controls what each role can see.

### Game Flow

1. A player creates a room → server generates a 4-char hex room code
2. Up to 4 players join by entering the room code
3. When the 4th player joins, roles are assigned randomly and the game starts automatically
4. The **Engineer** (Ingenieur) toggles levers A/B/C/D to affect temperature/pressure
5. The **Scientist** (Wissenschaftler) sees live temperature/pressure readings
6. The **Technician** (Techniker) sees status lights
7. The **Operator** can see all data and execute the final stabilization action
8. Win condition: temperature 30–80°C AND pressure 30–70 bar simultaneously; lose if either exceeds 95

### Socket.IO Events

Client → Server: `createRoom`, `joinRoom`, `leaveRoom`, `toggleLever`, `executeFinalAction`, `startGame`

Server → Client: `createRoomResponse`, `joinRoomResponse`, `playerJoined`, `playerLeft`, `roleAssigned`, `gameStarted`, `gameStateUpdate`

### CORS / Connection

The server's allowed origins are hardcoded in `server/index.js` (both in the Express CORS middleware and in the Socket.IO config). When adding new deployment URLs, update both places. The client's socket URL is set in `client/src/socket.js` — it uses `REACT_APP_SOCKET_URL` env var or falls back to `http://localhost:3001` in development and `https://team-game.onrender.com` in production.

## Development Commands

### Server
```bash
cd server
npm install
npm run dev      # nodemon (auto-restart on changes)
npm start        # plain node (production)
```

### Client
```bash
cd client
npm install
npm start        # dev server on http://localhost:3000
npm run build    # production build
npm test         # run tests
```

### Environment Variables

- **Server**: `PORT` (default: 3001), `NODE_ENV`
- **Client**: `REACT_APP_SOCKET_URL` (overrides the hardcoded URL in `socket.js`)
