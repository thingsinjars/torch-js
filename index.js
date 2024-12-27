import express from "express";
import seedrandom from "seedrandom";
import { WebSocketServer } from "ws";

const app = express();
app.use(express.static("ui"));
const port = 3000;

// Maze parameters
const MAZE_WIDTH = 20;
const MAZE_HEIGHT = 13;

// Store player state in-memory
const mazeStates = {};

// Generate a maze using the seed
function generateMaze(seed) {
  const rng = seedrandom(seed); // Use seedrandom to ensure deterministic randomness

  // Initialize maze with walls ('#')
  const maze = Array.from({ length: MAZE_HEIGHT }, () =>
    Array(MAZE_WIDTH).fill("#"),
  );

  // Carve out paths in the maze using a random walk (basic algorithm)
  const carvePaths = (x, y) => {
    maze[y][x] = " "; // Make this cell a floor
    const directions = [
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0], // Up, Down, Left, Right (2-step moves)
    ];

    // Shuffle directions
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    // Move in each direction
    for (const [dx, dy] of directions) {
      const nx = x + dx,
        ny = y + dy;
      if (
        nx > 0 &&
        nx < MAZE_WIDTH - 1 &&
        ny > 0 &&
        ny < MAZE_HEIGHT - 1 &&
        maze[ny][nx] === "#"
      ) {
        maze[y + dy / 2][x + dx / 2] = " "; // Carve intermediate cell
        carvePaths(nx, ny);
      }
    }
  };

  // Start carving from a random odd position
  carvePaths(1, 1);

  // Place an exit somewhere
  maze[MAZE_HEIGHT - 2][MAZE_WIDTH - 2] = "*"; // Bottom-right corner

  return maze;
}

// Route: GET /maze/:id
app.get("/maze/:id", (req, res) => {
  const { id } = req.params;
  const maze = generateMaze(id); // Generate maze using seed 'id'
  res.json(maze.map((row) => row.join("")));
});

const server = app.listen(port, () => {
  console.log(`Torch server listening at http://localhost:${port}`);
});

// WebSocket setup
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const urlParams = new URL(req.url, `http://${req.headers.host}`);
  const mazeId = urlParams.searchParams.get("mazeId");

  if (!mazeId) {
    ws.send(JSON.stringify({ error: "Maze ID required to connect." }));
    ws.close();
    return;
  }

  console.log(`Player connected to maze: ${mazeId}`);

  // Initialize room state
  if (!mazeStates[mazeId]) mazeStates[mazeId] = {};

  // Handle incoming messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      const { playerId, position, heading, velocity, state } = message;
      if (state === "leave") {
        delete mazeStates[mazeId][playerId];
      } else {
        // Update player state
        mazeStates[mazeId][playerId] = { position, heading, velocity };
      }

      // Broadcast updated state to all clients in the same maze
      const stateUpdate = {
        players: mazeStates[mazeId],
      };

      wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
          client.send(JSON.stringify(stateUpdate));
        }
      });
    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  // Handle disconnect
  ws.on("close", (data) => {
    console.log(`Player disconnected from maze: ${mazeId}`);
    // Remove player data (optional cleanup)
    if (mazeStates[mazeId].length === 0) {
      delete mazeStates[mazeId];
    }
  });
});
