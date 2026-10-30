import './style.css';
import * as THREE from 'three';
import { generateMaze, findPath, getNeighbors } from './maze.js';
import { AudioSystem } from './audio.js';

const CELL_SIZE = 3.15;
const WALL_HEIGHT = 3.55;
const PLAYER_RADIUS = 0.31;
const EYE_HEIGHT = 1.64;
const MAZE_SIZE = 17;

const ui = {
  game: document.querySelector('#game'),
  start: document.querySelector('#start-screen'),
  pause: document.querySelector('#pause-screen'),
  death: document.querySelector('#death-screen'),
  win: document.querySelector('#win-screen'),
  hud: document.querySelector('#hud'),
  objective: document.querySelector('#objective-text'),
  objectiveSub: document.querySelector('#objective-sub'),
  minimap: document.querySelector('#minimap'),
  explored: document.querySelector('#explored-count'),
  seed: document.querySelector('#seed-label'),
  keyIcon: document.querySelector('#key-icon'),
  keyStatus: document.querySelector('#key-status'),
  flashlightStatus: document.querySelector('#flashlight-status'),
  stamina: document.querySelector('#stamina-bar'),
  interaction: document.querySelector('#interaction-prompt'),
  interactionText: document.querySelector('#interaction-prompt span'),
  crosshair: document.querySelector('#crosshair'),
  threat: document.querySelector('#threat-indicator'),
  toast: document.querySelector('#message-toast'),
  danger: document.querySelector('#danger-vignette'),
  deathStats: document.querySelector('#death-stats'),
  winTime: document.querySelector('#win-time'),
  winExplored: document.querySelector('#win-explored'),
};

const audio = new AudioSystem();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020403);
scene.fog = new THREE.FogExp2(0x030604, 0.035);

const camera = new THREE.PerspectiveCamera(73, window.innerWidth / window.innerHeight, 0.06, 75);
camera.rotation.order = 'YXZ';
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.game.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight(0x728073, 0x080a08, 0.14);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xffe8c2, 105, 28, Math.PI / 5.4, 0.48, 1.25);
flashlight.position.set(0.2, -0.13, -0.05);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.camera.near = 0.12;
flashlight.shadow.camera.far = 28;
flashlight.shadow.bias = -0.00025;
flashlight.shadow.normalBias = 0.025;
const flashlightTarget = new THREE.Object3D();
flashlightTarget.position.set(0, -0.12, -10);
camera.add(flashlight, flashlightTarget);
flashlight.target = flashlightTarget;

const handLight = new THREE.PointLight(0xffd8a3, 0.32, 2.2, 2);
handLight.position.set(0.1, -0.2, -0.3);
camera.add(handLight);

// 狙击枪 + 挂载手电筒模型
const sniperRifle = new THREE.Group();
const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1a1d1b, roughness: 0.38, metalness: 0.82 });
const darkPolymer = new THREE.MeshStandardMaterial({ color: 0x0f1110, roughness: 0.7, metalness: 0.15 });
const scopeMetal = new THREE.MeshStandardMaterial({ color: 0x222622, roughness: 0.32, metalness: 0.85 });

// 机匣
const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.062, 0.26), gunMetal);
receiver.position.set(0, 0, -0.05);
// 枪管
const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.55, 10), gunMetal);
gunBarrel.rotation.x = Math.PI / 2;
gunBarrel.position.set(0, 0.012, -0.44);
// 枪口制退器
const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), scopeMetal);
muzzleBrake.rotation.x = Math.PI / 2;
muzzleBrake.position.set(0, 0.012, -0.71);
// 瞄准镜
const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.19, 12), scopeMetal);
scopeBody.rotation.x = Math.PI / 2;
scopeBody.position.set(0, 0.068, -0.08);
const scopeLensFront = new THREE.Mesh(
  new THREE.CircleGeometry(0.019, 12),
  new THREE.MeshBasicMaterial({ color: 0x0d1f16 }),
);
scopeLensFront.position.set(0, 0.068, -0.176);
const scopeLensRear = new THREE.Mesh(
  new THREE.CircleGeometry(0.017, 12),
  new THREE.MeshBasicMaterial({ color: 0x0a0d0b }),
);
scopeLensRear.position.set(0, 0.068, 0.016);
scopeLensRear.rotation.y = Math.PI;
// 镜架
const scopeMount1 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.03), darkPolymer);
scopeMount1.position.set(0, 0.04, -0.14);
const scopeMount2 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.03), darkPolymer);
scopeMount2.position.set(0, 0.04, -0.01);
// 握把
const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.095, 0.045), darkPolymer);
pistolGrip.position.set(0, -0.075, 0.03);
pistolGrip.rotation.x = 0.32;
// 弹匣
const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.085, 0.06), gunMetal);
magazine.position.set(0, -0.075, -0.11);
magazine.rotation.x = -0.12;
// 枪托
const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.075, 0.19), darkPolymer);
stock.position.set(0, -0.018, 0.2);
const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.095, 0.025), darkPolymer);
stockPad.position.set(0, -0.022, 0.3);
// 扳机护圈
const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.06), gunMetal);
triggerGuard.position.set(0, -0.048, -0.02);

sniperRifle.add(
  receiver, gunBarrel, muzzleBrake,
  scopeBody, scopeLensFront, scopeLensRear, scopeMount1, scopeMount2,
  pistolGrip, magazine, stock, stockPad, triggerGuard,
);

// ---- 挂载在枪管上方的手电筒 ----
const mountedFlashlight = new THREE.Group();
const flBody = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 10), gunMetal);
flBody.rotation.x = Math.PI / 2;
const flHead = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.015, 0.032, 12), scopeMetal);
flHead.rotation.x = Math.PI / 2;
flHead.position.z = -0.062;
const flLens = new THREE.Mesh(
  new THREE.CircleGeometry(0.016, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff3c8 }),
);
flLens.position.z = -0.079;
// 固定夹
const flClamp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.02), darkPolymer);
flClamp.position.y = -0.02;
mountedFlashlight.add(flBody, flHead, flLens, flClamp);
mountedFlashlight.position.set(0, 0.048, -0.55);
sniperRifle.add(mountedFlashlight);

sniperRifle.position.set(0.32, -0.28, -0.55);
sniperRifle.rotation.set(-0.04, -0.04, -0.1);
sniperRifle.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
camera.add(sniperRifle);

const worldGroup = new THREE.Group();
scene.add(worldGroup);
const clock = new THREE.Clock();
const keysDown = new Set();
const mapContext = ui.minimap.getContext('2d');

let gameState = 'menu';
let maze = null;
let player = null;
let enemy = null;
let door = null;
let keyObject = null;
let exitObject = null;
let colliders = [];
let visited = new Set();
let currentInteraction = null;
let elapsed = 0;
let toastTimer = 0;
let mapTimer = 0;
let stepDistance = 0;
let lastPosition = new THREE.Vector3();
let enemyAwakeNotified = false;
let worldTextures = [];

function cellToWorld(index, y = 0) {
  const cell = maze.cells[index];
  return new THREE.Vector3(
    (cell.x - (maze.size - 1) / 2) * CELL_SIZE,
    y,
    (cell.z - (maze.size - 1) / 2) * CELL_SIZE,
  );
}

function worldToCell(position) {
  const x = THREE.MathUtils.clamp(Math.round(position.x / CELL_SIZE + (maze.size - 1) / 2), 0, maze.size - 1);
  const z = THREE.MathUtils.clamp(Math.round(position.z / CELL_SIZE + (maze.size - 1) / 2), 0, maze.size - 1);
  return z * maze.size + x;
}

function makeTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const base = kind === 'floor' ? '#343a34' : '#454b43';
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  const image = context.getImageData(0, 0, 256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * (kind === 'floor' ? 31 : 24);
    image.data[i] += noise;
    image.data[i + 1] += noise;
    image.data[i + 2] += noise;
  }
  context.putImageData(image, 0, 0);
  context.globalAlpha = 0.2;
  for (let i = 0; i < 34; i += 1) {
    context.strokeStyle = Math.random() > 0.5 ? '#0b100c' : '#788073';
    context.lineWidth = Math.random() * 2 + 0.3;
    context.beginPath();
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    context.moveTo(x, y);
    context.lineTo(x + (Math.random() - 0.5) * 70, y + Math.random() * 85);
    context.stroke();
  }
  if (kind === 'floor') {
    context.globalAlpha = 0.32;
    context.strokeStyle = '#101611';
    context.lineWidth = 3;
    context.strokeRect(2, 2, 252, 252);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  worldTextures.push(texture);
  return texture;
}

function disposeWorld() {
  worldGroup.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
  worldGroup.clear();
  worldTextures.forEach((texture) => texture.dispose());
  worldTextures = [];
  renderer.renderLists.dispose();
}

function addCollider(x, z, width, depth, type = 'wall') {
  const collider = {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    disabled: false,
    type,
  };
  colliders.push(collider);
  return collider;
}

function buildArchitecture() {
  const worldSize = maze.size * CELL_SIZE;
  const floorTexture = makeTexture('floor');
  floorTexture.repeat.set(maze.size, maze.size);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize),
    new THREE.MeshStandardMaterial({ map: floorTexture, color: 0x697166, roughness: 0.93, metalness: 0.06 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  worldGroup.add(floor);

  const ceilingTexture = makeTexture('wall');
  ceilingTexture.repeat.set(maze.size * 0.7, maze.size * 0.7);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize),
    new THREE.MeshStandardMaterial({ map: ceilingTexture, color: 0x333a33, roughness: 1, side: THREE.FrontSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT;
  ceiling.receiveShadow = true;
  worldGroup.add(ceiling);

  const wallTexture = makeTexture('wall');
  wallTexture.repeat.set(1.4, 1);
  const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0x737b6f, roughness: 0.91, metalness: 0.04 });
  const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
  const walls = [];
  const addWall = (x, z, width, depth) => walls.push({ x, z, width, depth });

  for (const cell of maze.cells) {
    const center = cellToWorld(cell.index);
    if (cell.walls[0]) addWall(center.x, center.z - CELL_SIZE / 2, CELL_SIZE + 0.12, 0.18);
    if (cell.walls[3]) addWall(center.x - CELL_SIZE / 2, center.z, 0.18, CELL_SIZE + 0.12);
    if (cell.z === maze.size - 1 && cell.walls[2]) addWall(center.x, center.z + CELL_SIZE / 2, CELL_SIZE + 0.12, 0.18);
    if (cell.x === maze.size - 1 && cell.walls[1]) addWall(center.x + CELL_SIZE / 2, center.z, 0.18, CELL_SIZE + 0.12);
  }

  const wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, walls.length);
  const matrix = new THREE.Matrix4();
  walls.forEach((wall, index) => {
    matrix.compose(
      new THREE.Vector3(wall.x, WALL_HEIGHT / 2, wall.z),
      new THREE.Quaternion(),
      new THREE.Vector3(wall.width, WALL_HEIGHT, wall.depth),
    );
    wallMesh.setMatrixAt(index, matrix);
    addCollider(wall.x, wall.z, wall.width, wall.depth);
  });
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  worldGroup.add(wallMesh);

  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x20271f, roughness: 0.65, metalness: 0.45 });
  const trimMesh = new THREE.InstancedMesh(wallGeometry, trimMaterial, walls.length);
  walls.forEach((wall, index) => {
    matrix.compose(
      new THREE.Vector3(wall.x, 0.17, wall.z),
      new THREE.Quaternion(),
      new THREE.Vector3(wall.width + 0.025, 0.34, wall.depth + 0.025),
    );
    trimMesh.setMatrixAt(index, matrix);
  });
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  worldGroup.add(trimMesh);

  addEnvironmentalDetails();
}

function addEnvironmentalDetails() {
  const redMaterial = new THREE.MeshStandardMaterial({ color: 0x3d0d08, emissive: 0x9b180d, emissiveIntensity: 2.2 });
  const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0x191d18, metalness: 0.75, roughness: 0.4 });
  const candidates = maze.cells.filter((cell) => cell.index !== maze.start && getNeighbors(maze, cell).length === 1);
  for (let i = 0; i < Math.min(5, candidates.length); i += 1) {
    const cell = candidates[Math.floor(Math.random() * candidates.length)];
    const position = cellToWorld(cell.index, WALL_HEIGHT - 0.3);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.18), fixtureMaterial);
    fixture.position.copy(position);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.12), redMaterial);
    lamp.position.copy(position).add(new THREE.Vector3(0, -0.065, 0));
    const light = new THREE.PointLight(0xa12616, 2.8, 5.2, 2);
    light.position.copy(position).add(new THREE.Vector3(0, -0.2, 0));
    worldGroup.add(fixture, lamp, light);
  }

  const dustCount = 650;
  const positions = new Float32Array(dustCount * 3);
  const half = maze.size * CELL_SIZE * 0.5;
  for (let i = 0; i < dustCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * half * 2;
    positions[i * 3 + 1] = Math.random() * WALL_HEIGHT;
    positions[i * 3 + 2] = (Math.random() - 0.5) * half * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xb8c0ad, size: 0.018, transparent: true, opacity: 0.28, depthWrite: false }));
  dust.name = 'dust';
  worldGroup.add(dust);
}

function buildDoor() {
  const a = cellToWorld(maze.door.a);
  const b = cellToWorld(maze.door.b);
  const position = a.clone().add(b).multiplyScalar(0.5);
  const vertical = maze.cells[maze.door.a].x !== maze.cells[maze.door.b].x;
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = vertical ? Math.PI / 2 : 0;

  const material = new THREE.MeshStandardMaterial({ color: 0x39423a, roughness: 0.52, metalness: 0.72 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE - 0.08, WALL_HEIGHT - 0.08, 0.2), material);
  panel.position.y = WALL_HEIGHT / 2;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);
  for (let y = 0.45; y < WALL_HEIGHT; y += 0.62) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE - 0.03, 0.065, 0.25), new THREE.MeshStandardMaterial({ color: 0x171c18, metalness: 0.8, roughness: 0.4 }));
    strip.position.set(0, y, 0);
    group.add(strip);
  }
  const warning = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, 0.025), new THREE.MeshStandardMaterial({ color: 0x8c6b32, emissive: 0x2e1a04, emissiveIntensity: 0.5 }));
  warning.position.set(0, 1.75, -0.12);
  group.add(warning);
  const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ color: 0xa3130a, emissive: 0xd92113, emissiveIntensity: 3 }));
  indicator.position.set(0.45, 1.75, -0.15);
  group.add(indicator);
  const light = new THREE.PointLight(0xc52517, 2.2, 3.2, 2);
  light.position.set(0.45, 1.75, -0.3);
  group.add(light);
  worldGroup.add(group);

  const collider = vertical
    ? addCollider(position.x, position.z, 0.27, CELL_SIZE, 'door')
    : addCollider(position.x, position.z, CELL_SIZE, 0.27, 'door');
  door = { group, panel, indicator, light, collider, opening: false, open: false, progress: 0 };
}

function buildKey() {
  const group = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xc69b4c, emissive: 0x5f3909, emissiveIntensity: 0.65, roughness: 0.27, metalness: 0.88 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.038, 8, 20), brass);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.42, 0.055), brass);
  stem.position.y = -0.28;
  const toothA = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.055), brass);
  toothA.position.set(0.05, -0.43, 0);
  const toothB = toothA.clone();
  toothB.position.set(0.04, -0.32, 0);
  group.add(ring, stem, toothA, toothB);
  group.position.copy(cellToWorld(maze.key, 1.15));
  group.rotation.z = -0.25;
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  const light = new THREE.PointLight(0xe5ad51, 4.2, 4.5, 2);
  light.position.y = 0.1;
  group.add(light);
  worldGroup.add(group);
  keyObject = { group, collected: false, baseY: group.position.y };
}

function buildExit() {
  const group = new THREE.Group();
  group.position.copy(cellToWorld(maze.exit));
  const exitCell = maze.cells[maze.exit];
  const neighbor = getNeighbors(maze, exitCell)[0];
  if (neighbor) group.rotation.y = Math.atan2(-(neighbor.x - exitCell.x), -(neighbor.z - exitCell.z));
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x34443a, metalness: 0.76, roughness: 0.42 });
  const glowMaterial = new THREE.MeshStandardMaterial({ color: 0x70977b, emissive: 0x548968, emissiveIntensity: 2.4, transparent: true, opacity: 0.48, side: THREE.DoubleSide });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.65, 0.18), frameMaterial);
  left.position.set(-0.85, 1.325, 0);
  const right = left.clone();
  right.position.x = 0.85;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.14, 0.18), frameMaterial);
  top.position.y = 2.65;
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.5), glowMaterial);
  portal.position.y = 1.3;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.025, 6, 40), glowMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.025;
  group.add(left, right, top, portal, ring);
  const light = new THREE.PointLight(0x70b88b, 7, 7, 2);
  light.position.y = 1.5;
  group.add(light);
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  worldGroup.add(group);
  exitObject = { group, portal, ring };
}

function buildEnemy() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x11150f, roughness: 0.86, metalness: 0.02 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 1.05, 5, 9), skin);
  body.position.y = 1.25;
  body.scale.set(0.82, 1, 0.65);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10), skin);
  head.position.set(0, 2.14, -0.03);
  head.scale.set(0.82, 1.25, 0.82);
  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 1.35, 7), skin);
    arm.position.set(side * 0.38, 1.17, 0);
    arm.rotation.z = side * -0.1;
    limbs.push(arm);
    group.add(arm);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.105, 1.05, 7), skin);
    leg.position.set(side * 0.14, 0.52, 0);
    limbs.push(leg);
    group.add(leg);
  }
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xe8d6b0 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 7, 7), eyeMaterial);
    eye.position.set(side * 0.095, 2.18, -0.265);
    group.add(eye);
  }
  const eyeLight = new THREE.PointLight(0x9e160d, 1.7, 3.2, 2);
  eyeLight.position.set(0, 2.1, -0.25);
  group.add(body, head, eyeLight);
  group.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  group.position.copy(cellToWorld(maze.enemyStart));
  worldGroup.add(group);
  enemy = {
    group,
    limbs,
    path: [],
    repathTimer: 0,
    stepTimer: 0,
    breathTimer: 2 + Math.random() * 3,
    active: false,
    speed: 1.35,
    phase: 0,
  };
}

function setObjective(stage) {
  if (stage === 'key') {
    ui.objective.textContent = '寻找黄铜钥匙';
    ui.objectiveSub.textContent = '循着微光，不要停下脚步';
  } else if (stage === 'door') {
    ui.objective.textContent = '打开封锁门';
    ui.objectiveSub.textContent = '钥匙上的锈迹还没有干';
  } else {
    ui.objective.textContent = '抵达绿色出口';
    ui.objectiveSub.textContent = '离开这里，立刻';
  }
}

function newGame() {
  disposeWorld();
  maze = generateMaze(MAZE_SIZE);
  colliders = [];
  visited = new Set([maze.start]);
  elapsed = 0;
  stepDistance = 0;
  toastTimer = 0;
  mapTimer = 0;
  currentInteraction = null;
  enemyAwakeNotified = false;
  buildArchitecture();
  buildDoor();
  buildKey();
  buildExit();
  buildEnemy();

  const start = cellToWorld(maze.start, EYE_HEIGHT);
  const startCell = maze.cells[maze.start];
  const firstNeighbor = getNeighbors(maze, startCell)[0];
  const yaw = firstNeighbor ? Math.atan2(-(firstNeighbor.x - startCell.x), -(firstNeighbor.z - startCell.z)) : 0;
  player = {
    position: start.clone(),
    yaw,
    pitch: 0,
    stamina: 100,
    hasKey: false,
    flashlightOn: true,
    moving: false,
    bob: 0,
  };
  camera.position.copy(start);
  camera.rotation.set(0, yaw, 0);
  flashlight.visible = true;
  handLight.visible = true;
  sniperRifle.visible = true;
  lastPosition.copy(start);
  gameState = 'playing';
  keysDown.clear();
  setObjective('key');
  ui.keyIcon.classList.remove('found');
  ui.keyStatus.textContent = '尚未找到钥匙';
  ui.flashlightStatus.textContent = '照明正常';
  ui.seed.textContent = `#${maze.seed.toString(16).toUpperCase().padStart(6, '0').slice(-6)}`;
  ui.explored.textContent = '1';
  ui.threat.classList.remove('visible');
  ui.danger.style.opacity = '0';
  ui.interaction.classList.remove('visible');
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  ui.hud.classList.add('active');
  drawMinimap();
  clock.getDelta();
  showToast('找到钥匙。别让它听见你。', 3.5);
}

function requestMouse() {
  const request = renderer.domElement.requestPointerLock?.();
  if (request?.catch) {
    request.catch(() => {
      if (gameState === 'playing') showToast('点击游戏画面以锁定鼠标', 3);
    });
  }
}

function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  keysDown.clear();
  ui.pause.classList.add('active');
  ui.interaction.classList.remove('visible');
}

function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'playing';
  ui.pause.classList.remove('active');
  audio.init();
  requestMouse();
  clock.getDelta();
}

function showToast(message, duration = 2.2) {
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  toastTimer = duration;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function collides(x, z) {
  for (const collider of colliders) {
    if (collider.disabled) continue;
    const nearestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
    const nearestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
    const dx = x - nearestX;
    const dz = z - nearestZ;
    if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
  }
  return false;
}

function updatePlayer(delta) {
  let forwardInput = Number(keysDown.has('KeyW') || keysDown.has('ArrowUp')) - Number(keysDown.has('KeyS') || keysDown.has('ArrowDown'));
  let rightInput = Number(keysDown.has('KeyD') || keysDown.has('ArrowRight')) - Number(keysDown.has('KeyA') || keysDown.has('ArrowLeft'));
  const inputLength = Math.hypot(forwardInput, rightInput);
  if (inputLength > 1) {
    forwardInput /= inputLength;
    rightInput /= inputLength;
  }
  const wantsSprint = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
  const sprinting = wantsSprint && inputLength > 0 && player.stamina > 0.5;
  const speed = sprinting ? 4.45 : 2.85;
  player.stamina = THREE.MathUtils.clamp(player.stamina + (sprinting ? -25 : 16) * delta, 0, 100);
  ui.stamina.style.width = `${player.stamina}%`;
  ui.stamina.style.background = player.stamina < 25 ? '#9b473d' : '#9aab99';

  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const dx = (forwardX * forwardInput + rightX * rightInput) * speed * delta;
  const dz = (forwardZ * forwardInput + rightZ * rightInput) * speed * delta;
  player.moving = inputLength > 0.01;
  if (!collides(player.position.x + dx, player.position.z)) player.position.x += dx;
  if (!collides(player.position.x, player.position.z + dz)) player.position.z += dz;

  const traveled = Math.hypot(player.position.x - lastPosition.x, player.position.z - lastPosition.z);
  lastPosition.copy(player.position);
  if (player.moving) {
    player.bob += traveled * (sprinting ? 8.8 : 7.2);
    stepDistance += traveled;
    const stride = sprinting ? 1.65 : 1.82;
    if (stepDistance >= stride) {
      stepDistance %= stride;
      audio.footstep({ x: player.position.x, y: EYE_HEIGHT, z: player.position.z, yaw: player.yaw }, sprinting);
    }
  }
  const bobY = player.moving ? Math.sin(player.bob) * (sprinting ? 0.047 : 0.028) : 0;
  camera.position.set(player.position.x, EYE_HEIGHT + bobY, player.position.z);
  camera.rotation.set(player.pitch + (player.moving ? Math.cos(player.bob * 0.5) * 0.003 : 0), player.yaw, 0);
  sniperRifle.position.y = -0.28 + Math.sin(player.bob) * 0.012;
  sniperRifle.position.x = 0.32 + Math.cos(player.bob * 0.5) * 0.008;
  audio.updateListener(camera.position, player.yaw, player.pitch);

  const cellIndex = worldToCell(player.position);
  if (!visited.has(cellIndex)) {
    visited.add(cellIndex);
    ui.explored.textContent = visited.size.toString();
  }
}

function updateDoor(delta) {
  if (!door.opening || door.open) return;
  door.progress = Math.min(1, door.progress + delta / 1.55);
  const eased = 1 - Math.pow(1 - door.progress, 3);
  door.group.position.y = eased * (WALL_HEIGHT + 0.18);
  if (door.progress >= 1) door.open = true;
}

function updateInteraction() {
  currentInteraction = null;
  let bestDistance = Infinity;
  const consider = (type, object, range, label) => {
    const position = object.group.position;
    const distance = Math.hypot(player.position.x - position.x, player.position.z - position.z);
    if (distance < range && distance < bestDistance) {
      bestDistance = distance;
      currentInteraction = { type, object };
      ui.interactionText.textContent = label;
    }
  };
  if (!keyObject.collected) consider('key', keyObject, 1.65, '拾取黄铜钥匙');
  if (!door.opening) consider('door', door, 1.95, player.hasKey ? '使用黄铜钥匙' : '锁住了 — 需要钥匙');
  consider('exit', exitObject, 1.65, '离开迷宫');
  ui.interaction.classList.toggle('visible', Boolean(currentInteraction));
  ui.crosshair.classList.toggle('crosshair-active', Boolean(currentInteraction));
}

function interact() {
  if (!currentInteraction || gameState !== 'playing') return;
  if (currentInteraction.type === 'key') {
    keyObject.collected = true;
    keyObject.group.visible = false;
    player.hasKey = true;
    ui.keyIcon.classList.add('found');
    ui.keyStatus.textContent = '黄铜钥匙 × 1';
    setObjective('door');
    audio.key();
    showToast('已取得黄铜钥匙 — 它的脚步声变快了');
    enemy.speed = 1.65;
  } else if (currentInteraction.type === 'door') {
    if (!player.hasKey) {
      audio.denied();
      showToast('冰冷的锁孔。你需要一把钥匙。');
      return;
    }
    door.opening = true;
    door.collider.disabled = true;
    maze.door.locked = false;
    door.indicator.material.color.setHex(0x4a9b62);
    door.indicator.material.emissive.setHex(0x42c86c);
    door.light.color.setHex(0x55bd73);
    setObjective('exit');
    audio.door();
    showToast('封锁门已打开 — 前往绿色出口', 3);
  } else if (currentInteraction.type === 'exit') {
    winGame();
  }
  currentInteraction = null;
  ui.interaction.classList.remove('visible');
}

function updateEnemy(delta) {
  if (!enemy.active && elapsed > 6) {
    enemy.active = true;
    if (!enemyAwakeNotified) {
      showToast('远处传来了一声不属于你的脚步……', 3.2);
      enemyAwakeNotified = true;
    }
  }
  const enemyPosition = enemy.group.position;
  const dx = player.position.x - enemyPosition.x;
  const dz = player.position.z - enemyPosition.z;
  const distance = Math.hypot(dx, dz);
  const threat = THREE.MathUtils.clamp(1 - distance / 13, 0, 1);
  ui.danger.style.opacity = (threat * 0.75).toFixed(2);
  ui.threat.classList.toggle('visible', enemy.active && distance < 7.5);

  if (enemy.active) {
    enemy.repathTimer -= delta;
    if (enemy.repathTimer <= 0) {
      const from = worldToCell(enemyPosition);
      const to = worldToCell(player.position);
      enemy.path = findPath(maze, from, to, maze.door.locked ? maze.door : null);
      enemy.repathTimer = 0.34 + Math.random() * 0.12;
    }
    let target = null;
    const from = worldToCell(enemyPosition);
    const to = worldToCell(player.position);
    if (from === to) {
      target = player.position;
    } else if (enemy.path.length > 1) {
      target = cellToWorld(enemy.path[1]);
    }
    if (target) {
      const move = new THREE.Vector3(target.x - enemyPosition.x, 0, target.z - enemyPosition.z);
      const remaining = move.length();
      if (remaining > 0.025) {
        move.normalize();
        const proximityBoost = distance < 4 ? 0.18 : 0;
        const amount = Math.min(remaining, (enemy.speed + proximityBoost) * delta);
        enemyPosition.addScaledVector(move, amount);
        enemy.group.rotation.y = Math.atan2(-move.x, -move.z);
        enemy.phase += amount * 7;
        enemy.limbs.forEach((limb, index) => {
          limb.rotation.x = Math.sin(enemy.phase + (index % 2) * Math.PI) * 0.38;
        });
        enemy.stepTimer -= delta;
        if (enemy.stepTimer <= 0) {
          audio.enemyStep({ x: enemyPosition.x, y: 1.7, z: enemyPosition.z });
          enemy.stepTimer = 0.68 - Math.min(0.18, enemy.speed * 0.06);
        }
      }
    }
    enemy.breathTimer -= delta;
    if (enemy.breathTimer <= 0 && distance < 15) {
      audio.breath({ x: enemyPosition.x, y: 2, z: enemyPosition.z });
      enemy.breathTimer = 3.5 + Math.random() * 3;
    }
    if (distance < 0.72 && worldToCell(enemyPosition) === worldToCell(player.position)) {
      triggerDeath();
      return;
    }
  }

  const now = performance.now() / 1000;
  if (threat > 0.25 && now - audio.lastHeartbeat > 1.25 - threat * 0.7) {
    audio.heartbeat(threat);
    audio.lastHeartbeat = now;
  }
}

function updateWorld(delta) {
  if (keyObject && !keyObject.collected) {
    keyObject.group.rotation.y += delta * 1.2;
    keyObject.group.position.y = keyObject.baseY + Math.sin(elapsed * 2) * 0.08;
  }
  if (exitObject) {
    exitObject.portal.material.opacity = 0.4 + Math.sin(elapsed * 2.4) * 0.1;
    exitObject.ring.rotation.z += delta * 0.22;
  }
  const dust = worldGroup.getObjectByName('dust');
  if (dust) dust.rotation.y += delta * 0.006;
  if (toastTimer > 0) {
    toastTimer -= delta;
    if (toastTimer <= 0) ui.toast.classList.remove('visible');
  }
}

function drawMinimap() {
  if (!maze || !player) return;
  const context = mapContext;
  const width = ui.minimap.width;
  const height = ui.minimap.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#060a07';
  context.fillRect(0, 0, width, height);
  const scale = Math.min((width - 24) / maze.size, (height - 24) / maze.size);
  const offsetX = (width - scale * maze.size) / 2;
  const offsetY = (height - scale * maze.size) / 2;
  const px = (x) => offsetX + x * scale;
  const pz = (z) => offsetY + z * scale;

  for (const index of visited) {
    const cell = maze.cells[index];
    const x = px(cell.x);
    const z = pz(cell.z);
    context.fillStyle = index === worldToCell(player.position) ? '#46574a' : '#29372d';
    context.fillRect(x, z, scale, scale);
    context.strokeStyle = '#819486';
    context.lineWidth = 1.3;
    context.beginPath();
    if (cell.walls[0]) { context.moveTo(x, z); context.lineTo(x + scale, z); }
    if (cell.walls[1]) { context.moveTo(x + scale, z); context.lineTo(x + scale, z + scale); }
    if (cell.walls[2]) { context.moveTo(x, z + scale); context.lineTo(x + scale, z + scale); }
    if (cell.walls[3]) { context.moveTo(x, z); context.lineTo(x, z + scale); }
    context.stroke();
  }

  const drawMarker = (index, color, radius) => {
    if (!visited.has(index)) return;
    const cell = maze.cells[index];
    context.fillStyle = color;
    context.beginPath();
    context.arc(px(cell.x + 0.5), pz(cell.z + 0.5), radius, 0, Math.PI * 2);
    context.fill();
  };
  if (!keyObject.collected) drawMarker(maze.key, '#c5a35d', 2.7);
  drawMarker(maze.exit, '#76aa88', 2.8);
  if (visited.has(maze.door.a) || visited.has(maze.door.b)) {
    const a = maze.cells[maze.door.a];
    const b = maze.cells[maze.door.b];
    context.strokeStyle = door.opening ? '#6d9b79' : '#a55b4c';
    context.lineWidth = 2.4;
    context.beginPath();
    context.moveTo(px((a.x + b.x + 1) / 2), pz((a.z + b.z + 1) / 2));
    if (a.x === b.x) {
      context.lineTo(px(a.x + 1), pz((a.z + b.z + 1) / 2));
    } else {
      context.lineTo(px((a.x + b.x + 1) / 2), pz(a.z + 1));
    }
    context.stroke();
  }

  const current = maze.cells[worldToCell(player.position)];
  context.save();
  context.translate(px(current.x + 0.5), pz(current.z + 0.5));
  context.rotate(-player.yaw);
  context.fillStyle = '#e1e9dc';
  context.shadowColor = '#b8d1b9';
  context.shadowBlur = 5;
  context.beginPath();
  context.moveTo(0, -5.5);
  context.lineTo(3.7, 4);
  context.lineTo(0, 2.2);
  context.lineTo(-3.7, 4);
  context.closePath();
  context.fill();
  context.restore();
}

function triggerDeath() {
  if (gameState !== 'playing') return;
  gameState = 'dead';
  keysDown.clear();
  audio.death();
  ui.hud.classList.remove('active');
  ui.danger.style.opacity = '1';
  ui.deathStats.textContent = `你在迷宫里坚持了 ${formatTime(elapsed)} · 探索了 ${visited.size} 个区域`;
  ui.death.classList.remove('active');
  void ui.death.offsetWidth;
  ui.death.classList.add('active');
  if (document.pointerLockElement) document.exitPointerLock();
}

function winGame() {
  if (gameState !== 'playing') return;
  gameState = 'won';
  keysDown.clear();
  audio.escape();
  ui.hud.classList.remove('active');
  ui.danger.style.opacity = '0';
  ui.winTime.textContent = formatTime(elapsed);
  ui.winExplored.textContent = `${Math.round((visited.size / maze.cells.length) * 100)}%`;
  ui.win.classList.add('active');
  if (document.pointerLockElement) document.exitPointerLock();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (gameState === 'playing') {
    elapsed += delta;
    updatePlayer(delta);
    updateDoor(delta);
    updateInteraction();
    updateEnemy(delta);
    updateWorld(delta);
    mapTimer -= delta;
    if (mapTimer <= 0) {
      drawMinimap();
      mapTimer = 0.06;
    }
  }
  renderer.render(scene, camera);
}

document.querySelector('#start-button').addEventListener('click', () => {
  newGame();
  audio.init();
  requestMouse();
});
document.querySelector('#resume-button').addEventListener('click', resumeGame);
for (const selector of ['#death-restart-button', '#win-restart-button', '#pause-restart-button']) {
  document.querySelector(selector).addEventListener('click', () => {
    newGame();
    audio.init();
    requestMouse();
  });
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    if (gameState === 'paused') {
      gameState = 'playing';
      ui.pause.classList.remove('active');
      clock.getDelta();
    }
  } else if (gameState === 'playing') {
    pauseGame();
  }
});

renderer.domElement.addEventListener('click', () => {
  if (gameState === 'playing' && document.pointerLockElement !== renderer.domElement) requestMouse();
});

document.addEventListener('mousemove', (event) => {
  if (gameState !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= event.movementX * 0.00215;
  player.pitch -= event.movementY * 0.00195;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI * 0.47, Math.PI * 0.47);
});

document.addEventListener('keydown', (event) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' && gameState === 'playing' && !document.pointerLockElement) {
    pauseGame();
    return;
  }
  keysDown.add(event.code);
  if (event.repeat || gameState !== 'playing') return;
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyF') {
    player.flashlightOn = !player.flashlightOn;
    flashlight.visible = player.flashlightOn;
    handLight.visible = player.flashlightOn;
    flLens.material.color.setHex(player.flashlightOn ? 0xfff3c8 : 0x3a403a);
    ui.flashlightStatus.textContent = player.flashlightOn ? '照明正常' : '手电已关闭';
    audio.flashlight();
  }
});
document.addEventListener('keyup', (event) => keysDown.delete(event.code));
window.addEventListener('blur', () => keysDown.clear());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
});

animate();
