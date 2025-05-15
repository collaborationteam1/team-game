# Team Game Server

This is the server component for the Team Game application. It handles real-time communication between players using Socket.IO.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Start the production server:
```bash
npm start
```

## Environment Variables

- `PORT`: The port the server runs on (default: 3001)
- `NODE_ENV`: The environment (development/production)

## API Endpoints

- `GET /`: Health check endpoint
- `GET /health`: Health check endpoint

## Socket.IO Events

### Client to Server
- `createRoom`: Create a new game room
- `joinRoom`: Join an existing game room
- `leaveRoom`: Leave the current room
- `toggleLever`: Toggle a game lever
- `executeFinalAction`: Execute the final game action

### Server to Client
- `createRoomResponse`: Response to room creation
- `joinRoomResponse`: Response to room join
- `playerJoined`: Notification when a player joins
- `playerLeft`: Notification when a player leaves
- `roleAssigned`: Notification when a role is assigned
- `gameStarted`: Notification when the game starts
- `gameStateUpdate`: Update of the game state 