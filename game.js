// Slope Mini – four-color spiky ball

const container = document.getElementById("game-container");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const centerMessageEl = document.getElementById("center-message");
const startBtn = document.getElementById("start-btn");

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x05050a, 1);
container.appendChild(renderer.domElement);

// Scene & camera
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05050a, 0.02);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 3, 8);
camera.lookAt(0, 0, 0);

// Lighting
const hemiLight = new THREE.HemisphereLight(0x66aaff, 0x080808, 0.7);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Slope + borders
const slopeLength = 200;
const slopeWidth = 10;

const track = new THREE.Group();

const slopeGeo = new THREE.BoxGeometry(slopeWidth, 0.5, slopeLength);
const slopeMat = new THREE.MeshStandardMaterial({
  color: 0x020617,
  metalness: 0.4,
  roughness: 0.4,
});
const slope = new THREE.Mesh(slopeGeo, slopeMat);
slope.receiveShadow = true;
track.add(slope);

// Glowing side rails to visually mark borders
const railThickness = 0.25;
const railHeight = 0.6;
const railOffsetX = slopeWidth / 2 + railThickness * 0.4;
const railGeo = new THREE.BoxGeometry(railThickness, railHeight, slopeLength);

const leftRailMat = new THREE.MeshStandardMaterial({
  color: 0x22c55e,
  emissive: 0x22c55e,
  emissiveIntensity: 0.5,
  metalness: 0.7,
  roughness: 0.3,
});
const rightRailMat = new THREE.MeshStandardMaterial({
  color: 0x3b82f6,
  emissive: 0x3b82f6,
  emissiveIntensity: 0.5,
  metalness: 0.7,
  roughness: 0.3,
});

const leftRail = new THREE.Mesh(railGeo, leftRailMat);
leftRail.position.set(-railOffsetX, railHeight / 2, 0);

const rightRail = new THREE.Mesh(railGeo, rightRailMat);
rightRail.position.set(railOffsetX, railHeight / 2, 0);

track.add(leftRail);
track.add(rightRail);

// Tilt the play surface, but keep ball/obstacles in the same world plane
const slopeTilt = -0.4;
slope.rotation.x = slopeTilt;
leftRail.rotation.x = slopeTilt;
rightRail.rotation.x = slopeTilt;

scene.add(track);

// === Four-color spiky ball ===
const ball = new THREE.Group();

// Core 4-color sphere
const coreRadius = 0.35;
const coreGeo = new THREE.SphereGeometry(coreRadius, 32, 32);

const colors = [];
const color = new THREE.Color();
const pos = coreGeo.attributes.position;

// Quadrants in X/Z: blue, yellow, green, orange
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);

  let hex;
  if (x >= 0 && z >= 0) {
    hex = 0x3b82f6; // blue
  } else if (x < 0 && z >= 0) {
    hex = 0xfacc15; // yellow
  } else if (x < 0 && z < 0) {
    hex = 0x22c55e; // green
  } else {
    hex = 0xf97316; // orange
  }

  color.setHex(hex);
  colors.push(color.r, color.g, color.b);
}

coreGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

const coreMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  emissive: 0x111111,
  roughness: 0.2,
  metalness: 0.5,
});

const coreMesh = new THREE.Mesh(coreGeo, coreMat);
coreMesh.castShadow = true;
ball.add(coreMesh);

// Spikes (cones) with matching colors
const spikeCount = 80;
const spikeLength = 0.25;
const spikeRadius = 0.06;
const spikeGeo = new THREE.ConeGeometry(spikeRadius, spikeLength, 8);

for (let i = 0; i < spikeCount; i++) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);

  const dir = new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ).normalize();

  let hex;
  if (dir.x >= 0 && dir.z >= 0) {
    hex = 0x3b82f6; // blue
  } else if (dir.x < 0 && dir.z >= 0) {
    hex = 0xfacc15; // yellow
  } else if (dir.x < 0 && dir.z < 0) {
    hex = 0x22c55e; // green
  } else {
    hex = 0xf97316; // orange
  }

  const spikeMat = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.6,
  });

  const spike = new THREE.Mesh(spikeGeo, spikeMat);
  spike.castShadow = true;

  const baseDistance = coreRadius;
  spike.position.copy(dir).multiplyScalar(baseDistance + spikeLength * 0.5);

  spike.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir
  );

  ball.add(spike);
}

ball.position.set(0, 1, 2);
scene.add(ball);

// Obstacles
const obstacles = [];
let obstacleSpawnZ = -20;

// Obstacle spacing (wider gaps, fewer obstacles)
const obstacleSpacingMin = 18;
const obstacleSpacingMax = 26;

// Game state
let isRunning = false;
let speed = 0.25;
let speedIncrease = 0.0005;
let lateralSpeed = 0;
const maxLateralSpeed = 0.35;
let input = { left: false, right: false };
let score = 0;
let highScore = 0;
let lastTime = performance.now();

// Helpers
function resetGame() {
  ball.position.set(0, 1, 2);
  ball.rotation.set(0, 0, 0);
  lateralSpeed = 0;
  speed = 0.25;
  score = 0;
  scoreEl.textContent = "Score: 0";

  for (const obs of obstacles) {
    scene.remove(obs.mesh);
  }
  obstacles.length = 0;
  obstacleSpawnZ = -20;

  camera.position.set(0, 3, 8);
  camera.lookAt(ball.position);
}

function setRunning(running) {
  isRunning = running;
  centerMessageEl.style.display = running ? "none" : "block";
  if (!running) {
    centerMessageEl.querySelector("#subtitle").textContent = "Run ended.";
    centerMessageEl.querySelector("#hint").innerHTML =
      'Press <span class="pill" id="start-btn">Try Again</span><br/>' +
      'Use <strong>A / D</strong> or <strong>← / →</strong> to steer.';
    setTimeout(() => {
      const newBtn = document.getElementById("start-btn");
      if (newBtn) {
        newBtn.addEventListener("click", () => {
          resetGame();
          setRunning(true);
        });
      }
    }, 0);
  }
}

function spawnObstacle() {
  const width = 0.6 + Math.random() * 1.2;
  const height = 0.8 + Math.random() * 1.5;
  const depth = 0.8 + Math.random() * 1.2;

  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const maxX = slopeWidth / 2 - width;
  const x = (Math.random() * 2 - 1) * maxX;

  mesh.position.set(x, height / 2 + 0.25, obstacleSpawnZ);
  obstacles.push({ mesh, width, depth });
  scene.add(mesh);

  // Advance spawn position with generous but regular spacing
  const spacing =
    obstacleSpacingMin +
    Math.random() * (obstacleSpacingMax - obstacleSpacingMin);
  obstacleSpawnZ -= spacing;
}

function updateObstacles(delta) {
  for (const obs of obstacles) {
    obs.mesh.position.z += speed * 60 * delta;
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].mesh.position.z > 10) {
      scene.remove(obstacles[i].mesh);
      obstacles.splice(i, 1);
    }
  }

  const farthestZ = obstacles.reduce(
    (minZ, o) => Math.min(minZ, o.mesh.position.z),
    0
  );
  // Keep obstacles spanning a bit less of the slope so there are fewer overall.
  const maxSpan = slopeLength - 90;
  while (farthestZ - obstacleSpawnZ < maxSpan) {
    spawnObstacle();
  }
}

function checkCollisions() {
  const ballRadius = 0.4; // physics uses smooth sphere

  for (const obs of obstacles) {
    const o = obs.mesh.position;
    const halfW = obs.width / 2 + ballRadius;
    const halfD = obs.depth / 2 + ballRadius;

    const dx = Math.abs(ball.position.x - o.x);
    const dz = Math.abs(ball.position.z - o.z);

    if (dx < halfW && dz < halfD) {
      endRun();
      return;
    }
  }
}

function endRun() {
  isRunning = false;
  if (score > highScore) {
    highScore = score;
    highScoreEl.textContent = "Best: " + highScore.toFixed(0);
  }
  setRunning(false);
}

// Input
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
});

// Resize
window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// Game loop
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (isRunning) {
    speed += speedIncrease;

    if (input.left && !input.right) {
      lateralSpeed -= 0.02;
    } else if (input.right && !input.left) {
      lateralSpeed += 0.02;
    } else {
      lateralSpeed *= 0.9;
    }
    lateralSpeed = Math.max(-maxLateralSpeed, Math.min(maxLateralSpeed, lateralSpeed));

    ball.position.x += lateralSpeed;
    const maxX = slopeWidth / 2 - 0.8;
    ball.position.x = Math.max(-maxX, Math.min(maxX, ball.position.x));

    ball.position.z -= speed * 60 * delta;

    ball.rotation.z -= lateralSpeed * 2;
    ball.rotation.x -= speed * 2;

    camera.position.lerp(
      new THREE.Vector3(ball.position.x * 0.5, 3, ball.position.z + 8),
      0.08
    );
    camera.lookAt(ball.position.x, ball.position.y, ball.position.z - 6);

    updateObstacles(delta);
    checkCollisions();

    score += speed * 100 * delta;
    scoreEl.textContent = "Score: " + score.toFixed(0);
  }

  renderer.render(scene, camera);
}

resetGame();
animate();

// Initial start button
if (startBtn) {
  startBtn.addEventListener("click", () => {
    resetGame();
    setRunning(true);
  });
}  