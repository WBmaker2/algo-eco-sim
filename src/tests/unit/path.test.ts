import { describe, expect, it } from 'vitest';
import { generateMaze, mazeFingerprint } from '../../algo/mazeGen';
import { astarSteps, bfsSteps, dfsSteps } from '../../algo/pathSteps';

describe('pathfinding — A* path <= BFS path length', () => {
  it('on open grids and seeded mazes', () => {
    const seeds = [1, 7, 1234, 99999];
    for (const seed of seeds) {
      const m = generateMaze(21, 15, seed);
      const bfs = bfsSteps(m.grid, m.cols, m.rows, m.start, m.goal);
      const astar = astarSteps(m.grid, m.cols, m.rows, m.start, m.goal);
      expect(bfs.found).toBe(true);
      expect(astar.found).toBe(true);
      expect(astar.pathLength).toBeLessThanOrEqual(bfs.pathLength);
    }
  });

  it('DFS finds a (possibly longer) path on open grid', () => {
    const w = 9;
    const h = 9;
    const grid = new Uint8Array(w * h); // fully open
    const start = 0;
    const goal = w * h - 1;
    const bfs = bfsSteps(grid, w, h, start, goal);
    const dfs = dfsSteps(grid, w, h, start, goal);
    expect(bfs.found).toBe(true);
    expect(dfs.found).toBe(true);
    expect(bfs.pathLength).toBe((w - 1) + (h - 1));
    expect(dfs.pathLength).toBeGreaterThanOrEqual(bfs.pathLength);
  });

  it('reports no path when goal is walled off', () => {
    const w = 5;
    const h = 5;
    const grid = new Uint8Array(w * h);
    // wall column x=2 fully closed
    for (let y = 0; y < h; y++) grid[y * w + 2] = 1;
    const bfs = bfsSteps(grid, w, h, 0, w * h - 1);
    expect(bfs.found).toBe(false);
    expect(bfs.pathLength).toBe(0);
  });
});

describe('maze — ?seed= reproduces the same maze', () => {
  it('same seed gives identical fingerprint', () => {
    const a = generateMaze(25, 19, 20260501);
    const b = generateMaze(25, 19, 20260501);
    expect(mazeFingerprint(a)).toBe(mazeFingerprint(b));
  });

  it('different seeds (almost surely) differ', () => {
    const a = generateMaze(25, 19, 111);
    const b = generateMaze(25, 19, 222);
    expect(mazeFingerprint(a)).not.toBe(mazeFingerprint(b));
  });
});
