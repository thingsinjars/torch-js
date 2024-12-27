const playerId = `player-${Math.floor(Math.random() * 1000)}`;
const mazeId = "test-maze";
const socket = new WebSocket(`ws://${window.location.host}?mazeId=${mazeId}`);

socket.onopen = () => {
  console.log("Connected to WebSocket server");

  // initial player state
  const initialState = {
    playerId,
    position: [0, 0],
    heading: 0,
    velocity: [1, 0],
  };
  socket.send(JSON.stringify(initialState));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received update:", data);

  // Update other players' positions
  if (data.players) {
    Object.entries(data.players).forEach(([id, state]) => {
      if (id !== playerId) {
        console.log(
          `Player ${id}: Position=${state.position}, Heading=${state.heading}`,
        );
        window.players = data.players;
      }
    });
  }
};

function leave() {
  socket.send(JSON.stringify({ playerId, state: "leave" }));
}

function sendPositionUpdates(playerId, position, heading, velocity) {
  socket.send(
    JSON.stringify({
      playerId,
      position,
      heading,
      velocity,
    }),
  );
}
