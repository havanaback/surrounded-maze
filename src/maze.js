export const DIRECTIONS = [
  { dx: 0, dz: -1, wall: 0, opposite: 2 },
  { dx: 1, dz: 0, wall: 1, opposite: 3 },
  { dx: 0, dz: 1, wall: 2, opposite: 0 },
  { dx: -1, dz: 0, wall: 3, opposite: 1 },
];

export function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function cellIndex(maze, x, z) {
  return z * maze.size + x;
}

export function getCell(maze, x, z) {
  if (x < 0 || z < 0 || x >= maze.size || z >= maze.size) return null;
  return maze.cells[cellIndex(maze, x, z)];
}

export function sameEdge(edge, a, b) {
  if (!edge) return false;
  return (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a);
}

export function getNeighbors(maze, cell, blockedEdge = null) {
  const result = [];
  for (const direction of DIRECTIONS) {
    if (cell.walls[direction.wall]) continue;
    const neighbor = getCell(maze, cell.x + direction.dx, cell.z + direction.dz);
    if (!neighbor || sameEdge(blockedEdge, cell.index, neighbor.index)) continue;
    result.push(neighbor);
  }
  return result;
}

export function breadthFirst(maze, start, blockedEdge = null) {
  const distances = new Array(maze.cells.length).fill(-1);
  const parents = new Array(maze.cells.length).fill(-1);
  const queue = [start];
  distances[start.index] = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    for (const neighbor of getNeighbors(maze, cell, blockedEdge)) {
      if (distances[neighbor.index] !== -1) continue;
      distances[neighbor.index] = distances[cell.index] + 1;
      parents[neighbor.index] = cell.index;
      queue.push(neighbor);
    }
  }
  return { distances, parents, reached: queue };
}

function reconstructPath(parents, target) {
  const path = [];
  let current = target.index;
  while (current !== -1) {
    path.push(current);
    current = parents[current];
  }
  return path.reverse();
}

export function generateMaze(size = 11, seed = Math.floor(Math.random() * 0xffffff)) {
  const random = mulberry32(seed);
  const cells = [];
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      cells.push({ x, z, index: z * size + x, walls: [true, true, true, true] });
    }
  }
  const maze = { size, seed, cells };
  const start = cells[Math.floor(random() * cells.length)];
  const visited = new Set([start.index]);
  const stack = [start];

  // Iterative recursive-backtracker: the result is a spanning tree, so every cell is connected.
  while (stack.length) {
    const current = stack[stack.length - 1];
    const candidates = shuffle([...DIRECTIONS], random).filter((direction) => {
      const next = getCell(maze, current.x + direction.dx, current.z + direction.dz);
      return next && !visited.has(next.index);
    });
    if (!candidates.length) {
      stack.pop();
      continue;
    }
    const direction = candidates[0];
    const next = getCell(maze, current.x + direction.dx, current.z + direction.dz);
    current.walls[direction.wall] = false;
    next.walls[direction.opposite] = false;
    visited.add(next.index);
    stack.push(next);
  }

  const fromStart = breadthFirst(maze, start);
  const exit = cells[fromStart.distances.indexOf(Math.max(...fromStart.distances))];
  const exitPath = reconstructPath(fromStart.parents, exit);
  const doorIndex = Math.max(3, Math.min(exitPath.length - 3, Math.floor(exitPath.length * 0.58)));
  const door = { a: exitPath[doorIndex], b: exitPath[doorIndex + 1], locked: true };
  const beforeDoor = breadthFirst(maze, start, door);
  const candidates = beforeDoor.reached.filter((cell) => cell.index !== start.index && beforeDoor.distances[cell.index] >= 3);
  candidates.sort((a, b) => beforeDoor.distances[b.index] - beforeDoor.distances[a.index]);
  const keyCell = candidates[Math.floor(random() * Math.min(3, candidates.length))] || beforeDoor.reached[beforeDoor.reached.length - 1];
  const enemyCandidates = beforeDoor.reached.filter((cell) =>
    cell.index !== start.index && cell.index !== keyCell.index && beforeDoor.distances[cell.index] >= Math.min(7, beforeDoor.distances[keyCell.index]),
  );
  const enemyCell = enemyCandidates[Math.floor(random() * enemyCandidates.length)] || keyCell;

  return {
    ...maze,
    start: start.index,
    exit: exit.index,
    exitPath,
    door,
    key: keyCell.index,
    enemyStart: enemyCell.index,
  };
}

export function findPath(maze, startIndex, targetIndex, blockedEdge = null) {
  if (startIndex === targetIndex) return [startIndex];
  const target = maze.cells[targetIndex];
  const open = new Set([startIndex]);
  const cameFrom = new Map();
  const gScore = new Map([[startIndex, 0]]);
  const fScore = new Map([[startIndex, Math.abs(maze.cells[startIndex].x - target.x) + Math.abs(maze.cells[startIndex].z - target.z)]]);

  while (open.size) {
    let currentIndex = null;
    let bestScore = Infinity;
    for (const index of open) {
      const score = fScore.get(index) ?? Infinity;
      if (score < bestScore) {
        bestScore = score;
        currentIndex = index;
      }
    }
    if (currentIndex === targetIndex) {
      const path = [currentIndex];
      while (cameFrom.has(currentIndex)) {
        currentIndex = cameFrom.get(currentIndex);
        path.unshift(currentIndex);
      }
      return path;
    }
    open.delete(currentIndex);
    const current = maze.cells[currentIndex];
    for (const neighbor of getNeighbors(maze, current, blockedEdge)) {
      const tentative = (gScore.get(currentIndex) ?? Infinity) + 1;
      if (tentative >= (gScore.get(neighbor.index) ?? Infinity)) continue;
      cameFrom.set(neighbor.index, currentIndex);
      gScore.set(neighbor.index, tentative);
      fScore.set(neighbor.index, tentative + Math.abs(neighbor.x - target.x) + Math.abs(neighbor.z - target.z));
      open.add(neighbor.index);
    }
  }
  return [];
}
