/** Seeded maze generation (recursive backtracker) — reproducible via ?seed=. */

import { mulberry32 } from '../eco/rng';

export interface Maze {
  grid: Uint8Array; // 0 empty, 1 wall
  cols: number;
  rows: number;
  start: number;
  goal: number;
  seed: number;
}

/** Generate an odd-sized maze; cols/rows are rounded up to odd numbers (min 9). */
export function generateMaze(cols: number, rows: number, seed: number): Maze {
  const c = Math.max(9, cols % 2 === 0 ? cols + 1 : cols);
  const r = Math.max(9, rows % 2 === 0 ? rows + 1 : rows);
  const grid = new Uint8Array(c * r).fill(1);
  const rng = mulberry32(seed);
  const idx = (x: number, y: number): number => y * c + x;

  const stack: Array<[number, number]> = [[1, 1]];
  grid[idx(1, 1)] = 0;
  const dirs: Array<[number, number]> = [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ];
  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1]!;
    const options: Array<[number, number]> = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx > 0 && ny > 0 && nx < c - 1 && ny < r - 1 && grid[idx(nx, ny)] === 1) {
        options.push([dx, dy]);
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [dx, dy] = options[(rng() * options.length) | 0]!;
    grid[idx(cx + dx / 2, cy + dy / 2)] = 0;
    grid[idx(cx + dx, cy + dy)] = 0;
    stack.push([cx + dx, cy + dy]);
  }
  // Knock a few extra loops so BFS/A* paths differ interestingly.
  const loops = ((c * r) / 90) | 0;
  for (let k = 0; k < loops; k++) {
    const x = 1 + (((rng() * (c - 2)) | 0) as number);
    const y = 1 + (((rng() * (r - 2)) | 0) as number);
    grid[idx(x, y)] = 0;
  }
  const start = idx(1, 1);
  const goal = idx(c - 2, r - 2);
  grid[start] = 0;
  grid[goal] = 0;
  return { grid, cols: c, rows: r, start, goal, seed: seed >>> 0 };
}

/** Fingerprint for tests: same seed must reproduce the same maze. */
export function mazeFingerprint(m: Maze): string {
  let h = 2166136261;
  for (let i = 0; i < m.grid.length; i++) {
    h ^= m.grid[i]!;
    h = Math.imul(h, 16777619);
  }
  return `${m.cols}x${m.rows}:${(h >>> 0).toString(16)}`;
}
