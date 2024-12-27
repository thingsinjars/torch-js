async function main() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Resize canvas
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const maze = await fetch("/maze/1").then((res) => res.json());

  const tileSize = 50; // Pixels per tile
  const rayCount = 120; // Number of rays in light cone
  const fov = Math.PI / 2; // 90-degree field of view
  const traversableTiles = [" ", "*"];

  // Player state
  let playerX = 1.5,
    playerY = 1.5; // Player's position in tiles
  let mouseX = canvas.width / 2,
    mouseY = canvas.height / 2;
  let velY = 0,
    velX = 0;
  const speed = 1;
  const acc = 0.004;
  const friction = 0.9;
  const keys = [];
  let angle = 0;
  let state = "playing";

  // Track mouse movement for light direction
  canvas.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Player movement
  window.addEventListener("keydown", (e) => {
    // const speed = 0.2;
    keys[e.key.toLowerCase()] = true;
  });
  // Player movement
  window.addEventListener("keyup", (e) => {
    // const speed = 0.2;
    keys[e.key.toLowerCase()] = false;
  });

  function movePlayer() {
    if (state === "playing") {
      let nextX = playerX;
      let nextY = playerY;

      // Calculate facing angle from player to mouse
      const playerScreenX = playerX * tileSize;
      const playerScreenY = playerY * tileSize;
      angle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);

      // Calculate forward/backward movement vector
      const forwardX = Math.cos(angle);
      const forwardY = Math.sin(angle);

      // Calculate right vector (perpendicular to forward)
      const rightX = Math.cos(angle + Math.PI / 2);
      const rightY = Math.sin(angle + Math.PI / 2);

      // Calculate distance between player and cursor
      const cursorTileX = mouseX / tileSize;
      const cursorTileY = mouseY / tileSize;
      const distToCursor = Math.sqrt(
        Math.pow(cursorTileX - playerX, 2) + Math.pow(cursorTileY - playerY, 2),
      );

      // Forward/Backward movement
      if (keys["arrowup"] || keys["w"]) {
        if (distToCursor >= 1) {
          if (velY > -speed) {
            velX += forwardX * acc;
            velY += forwardY * acc;
          }
        }
      }
      if (keys["arrowdown"] || keys["s"]) {
        if (velY < speed) {
          velX -= forwardX * acc;
          velY -= forwardY * acc;
        }
      }

      // Strafe Left/Right movement
      if (keys["arrowleft"] || keys["a"]) {
        if (velX > -speed) {
          velX -= rightX * acc;
          velY -= rightY * acc;
        }
      }
      if (keys["arrowright"] || keys["d"]) {
        if (velX < speed) {
          velX += rightX * acc;
          velY += rightY * acc;
        }
      }

      // Apply friction and update position
      velX *= friction;
      velY *= friction;

      nextX += velX;
      nextY += velY;

      // Check collision with walls
      if (
        traversableTiles.includes(maze[Math.floor(nextY)][Math.floor(nextX)])
      ) {
        playerX = nextX;
        playerY = nextY;
      }

      // Check for win state
      if (maze[Math.floor(playerY)][Math.floor(playerX)] === "*") {
        state = "won";
        alert("You win!");
        window.location.reload();
      }
    }
  }

  function castRay(angle, startX = playerX, startY = playerY) {
    const stepSize = 0.05; // Ray increment size
    let distance = 0;
    let hit = false;

    let rayX = startX;
    let rayY = startY;

    while (!hit && distance < 10) {
      // Max ray length
      rayX += Math.cos(angle) * stepSize;
      rayY += Math.sin(angle) * stepSize;
      distance += stepSize;

      // Check if the ray hits a wall
      if (maze[Math.floor(rayY)]?.[Math.floor(rayX)] === "#") {
        hit = true;
      }
    }

    return {
      x: rayX * tileSize,
      y: rayY * tileSize,
      distance: distance,
    };
  }

  function get360VisibilityPolygon(x, y) {
    const rayCount = 360; // More rays for smoother visibility polygon
    const points = [];

    // Cast rays in all directions
    for (
      let angle = 0;
      angle < Math.PI * 2;
      angle += (Math.PI * 2) / rayCount
    ) {
      const ray = castRay(angle, x, y);
      points.push([ray.x, ray.y]);
    }

    return points;
  }

  function getLightConePolygon(x, y, angle) {
    const points = [[x * tileSize, y * tileSize]]; // Start with player position

    // Cast rays for the light cone
    for (let i = -rayCount / 2; i < rayCount / 2; i++) {
      const rayAngle = angle + (i / rayCount) * fov;
      const ray = castRay(rayAngle, x, y);
      points.push([ray.x, ray.y]);
    }

    return points;
  }

  function drawOtherPlayerTorchLight(
    otherPlayerX,
    otherPlayerY,
    otherPlayerHeading,
  ) {
    const otherPlayerScreenX = otherPlayerX * tileSize;
    const otherPlayerScreenY = otherPlayerY * tileSize;

    // Get the main player's visibility polygon using the MAIN player's position
    const visibilityPolygon = get360VisibilityPolygon(playerX, playerY);

    // Get the other player's light cone polygon using the OTHER player's position
    const lightConePolygon = getLightConePolygon(
      otherPlayerX,
      otherPlayerY,
      otherPlayerHeading,
    );

    ctx.save();

    // Create a clipping path from the main player's visibility polygon
    ctx.beginPath();
    ctx.moveTo(visibilityPolygon[0][0], visibilityPolygon[0][1]);
    for (const point of visibilityPolygon) {
      ctx.lineTo(point[0], point[1]);
    }
    ctx.closePath();
    ctx.clip(); // Apply the clipping mask

    // Draw the other player's light cone within the clipping path
    ctx.beginPath();
    ctx.moveTo(lightConePolygon[0][0], lightConePolygon[0][1]);
    for (const point of lightConePolygon) {
      ctx.lineTo(point[0], point[1]);
    }
    ctx.closePath();

    // Create and apply the gradient from the other player's position
    const gradient = ctx.createRadialGradient(
      otherPlayerScreenX,
      otherPlayerScreenY,
      0,
      otherPlayerScreenX,
      otherPlayerScreenY,
      tileSize * 10,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }

  function drawPlayerTorchLight() {
    const playerScreenX = playerX * tileSize;
    const playerScreenY = playerY * tileSize;

    // Calculate light direction as angel between player and cursor
    const dx = mouseX - playerScreenX;
    const dy = mouseY - playerScreenY;
    const angle = Math.atan2(dy, dx);
    drawTorchlight(playerScreenX, playerScreenY, angle);
    // Draw goal tile if visible
    const rays = Array.from({ length: rayCount }, (_, i) => {
      const rayAngle = angle + ((i - rayCount / 2) / rayCount) * fov;
      return castRay(rayAngle);
    });
    drawGoalTile(rays);
  }

  function drawTorchlight(playerScreenX, playerScreenY, angle) {
    const tileX = playerScreenX / tileSize;
    const tileY = playerScreenY / tileSize;

    ctx.save();
    ctx.beginPath();

    // Create a radial gradient for light falloff
    const gradient = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      0,
      playerScreenX,
      playerScreenY,
      tileSize * 10,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");

    // Draw the light cone as a polygon
    ctx.moveTo(playerScreenX, playerScreenY);
    for (let i = -rayCount / 2; i < rayCount / 2; i++) {
      const rayAngle = angle + (i / rayCount) * fov;
      const rayEnd = castRay(rayAngle, tileX, tileY);
      ctx.lineTo(rayEnd.x, rayEnd.y);
    }

    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    ctx.restore();
  }

  function drawGoalTile(rays) {
    const goalPosition = findTilePosition("*");
    if (!goalPosition) return;
    const [goalX, goalY] = goalPosition;
    const goalScreenX = goalX * tileSize + tileSize / 2;
    const goalScreenY = goalY * tileSize + tileSize / 2;
    const playerScreenX = playerX * tileSize;
    const playerScreenY = playerY * tileSize;

    // Calculate angle to goal
    const goalAngle = Math.atan2(
      goalScreenY - playerScreenY,
      goalScreenX - playerScreenX,
    );

    // Calculate angle to mouse (center of light cone)
    const mouseAngle = Math.atan2(
      mouseY - playerScreenY,
      mouseX - playerScreenX,
    );

    // Check if goal is within the light cone angle
    const angleDiff = Math.abs(
      ((goalAngle - mouseAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI,
    );

    if (angleDiff <= fov / 2) {
      // Only then check if any ray reaches it
      for (const ray of rays) {
        const distX = goalScreenX - playerScreenX;
        const distY = goalScreenY - playerScreenY;
        const rayDistX = ray.x - playerScreenX;
        const rayDistY = ray.y - playerScreenY;

        // Calculate the dot product to check if the goal is along the ray's direction
        const rayLength = Math.sqrt(rayDistX ** 2 + rayDistY ** 2);
        const goalLength = Math.sqrt(distX ** 2 + distY ** 2);

        if (rayLength === 0 || goalLength === 0) continue;

        const dotProduct =
          (distX * rayDistX + distY * rayDistY) / (rayLength * goalLength);

        // Check if the goal is along the ray's path (dot product close to 1)
        // and within the ray's length
        if (dotProduct > 0.99 && rayLength >= goalLength) {
          ctx.fillStyle = "cyan";
          ctx.beginPath();
          ctx.arc(goalScreenX, goalScreenY, tileSize / 3, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
      }
    }
  }

  function findTilePosition(char) {
    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        if (maze[y][x] === char) return [x, y];
      }
    }
    return null;
  }

  function drawMaze() {
    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        if (maze[y][x] === "#") {
          ctx.fillStyle = "black";
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  function drawPlayer() {
    const playerScreenX = playerX * tileSize;
    const playerScreenY = playerY * tileSize;

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, tileSize / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function gameLoop() {
    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw player's torch light
    drawPlayerTorchLight();

    // Draw other players' torch lights
    // if (Math.random() < 0.1) {
    if (window.players) {
      Object.entries(window.players).forEach(([id, player]) => {
        if (id !== playerId) {
          drawOtherPlayerTorchLight(
            player.position[0],
            player.position[1],
            player.heading,
          );
        }
      });
      sendPositionUpdates(playerId, [playerX, playerY], angle, [velX, velY]);
    }
    // }

    drawMaze();
    movePlayer();
    requestAnimationFrame(gameLoop);
  }

  gameLoop();
}

main();
