/**
 * Pathfinding step generators — BFS / DFS / A* yielding visit/frontier events.
 * Grid encoding: 0 = empty, 1 = wall. Index = y * w + x.
 */

export type PathAlgoId = 'bfs' | 'dfs' | 'astar';

export interface PathStep {
  type: 'visit' | 'frontier' | 'path';
  index: number;
}

export interface PathResult {
  steps: PathStep[];
  visitedOrder: number[];
  path: number[];
  visitedCount: number;
  pathLength: number;
  found: boolean;
}

export const PATH_NAMES: Record<PathAlgoId, string> = {
  bfs: 'BFS (너비 우선)',
  dfs: 'DFS (깊이 우선)',
  astar: 'A* (별)',
};

function neighbors(index: number, w: number, h: number): number[] {
  const x = index % w;
  const y = (index / w) | 0;
  const out: number[] = [];
  if (x + 1 < w) out.push(index + 1);
  if (x - 1 >= 0) out.push(index - 1);
  if (y + 1 < h) out.push(index + w);
  if (y - 1 >= 0) out.push(index - w);
  return out;
}

function reconstruct(parent: Int32Array, start: number, goal: number): number[] {
  const path: number[] = [];
  let cur = goal;
  let guard = parent.length + 5;
  while (cur !== -1 && guard-- > 0) {
    path.push(cur);
    if (cur === start) break;
    cur = parent[cur]!;
  }
  path.reverse();
  return path[0] === start ? path : [];
}

function manhattan(a: number, b: number, w: number): number {
  const ax = a % w;
  const ay = (a / w) | 0;
  const bx = b % w;
  const by = (b / w) | 0;
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function runSearch(
  grid: Uint8Array,
  w: number,
  h: number,
  start: number,
  goal: number,
  algo: PathAlgoId,
): PathResult {
  const steps: PathStep[] = [];
  const visitedOrder: number[] = [];
  const visited = new Uint8Array(w * h);
  const parent = new Int32Array(w * h).fill(-1);

  if (grid[start] === 1 || grid[goal] === 1) {
    return { steps, visitedOrder, path: [], visitedCount: 0, pathLength: 0, found: false };
  }

  if (algo === 'astar') {
    // Binary-ish heap via sorted array is fine for classroom grid sizes.
    const g = new Float64Array(w * h).fill(Infinity);
    const inOpen = new Uint8Array(w * h);
    const open: number[] = [start];
    g[start] = 0;
    inOpen[start] = 1;
    visited[start] = 1;
    while (open.length > 0) {
      let best = 0;
      let bestF = g[open[0]!]! + manhattan(open[0]!, goal, w);
      for (let k = 1; k < open.length; k++) {
        const f = g[open[k]!]! + manhattan(open[k]!, goal, w);
        if (f < bestF) {
          bestF = f;
          best = k;
        }
      }
      const cur = open.splice(best, 1)[0]!;
      inOpen[cur] = 0;
      visitedOrder.push(cur);
      steps.push({ type: 'visit', index: cur });
      if (cur === goal) break;
      for (const nb of neighbors(cur, w, h)) {
        if (grid[nb] === 1 || visited[nb] === 1) continue;
        const ng = g[cur]! + 1;
        if (ng < g[nb]!) {
          g[nb] = ng;
          parent[nb] = cur;
          if (inOpen[nb] !== 1) {
            open.push(nb);
            inOpen[nb] = 1;
            steps.push({ type: 'frontier', index: nb });
          }
        } else if (parent[nb] === -1) {
          parent[nb] = cur;
        }
      }
      visited[cur] = 1;
    }
  } else {
    // BFS (queue) / DFS (stack)
    const container: number[] = [start];
    visited[start] = 1;
    while (container.length > 0) {
      const cur = (algo === 'bfs' ? container.shift()! : container.pop())!;
      visitedOrder.push(cur);
      steps.push({ type: 'visit', index: cur });
      if (cur === goal) {
        break;
      }
      const nbs = neighbors(cur, w, h);
      for (const nb of nbs) {
        if (grid[nb] === 1 || visited[nb] === 1) continue;
        visited[nb] = 1;
        parent[nb] = cur;
        container.push(nb);
        steps.push({ type: 'frontier', index: nb });
      }
    }
  }

  const path = reconstruct(parent, start, goal);
  const found = path.length > 0;
  if (found) for (const p of path) steps.push({ type: 'path', index: p });
  return {
    steps,
    visitedOrder,
    path,
    visitedCount: visitedOrder.length,
    pathLength: found ? path.length - 1 : 0,
    found,
  };
}

export function bfsSteps(
  grid: Uint8Array,
  w: number,
  h: number,
  start: number,
  goal: number,
): PathResult {
  return runSearch(grid, w, h, start, goal, 'bfs');
}

export function dfsSteps(
  grid: Uint8Array,
  w: number,
  h: number,
  start: number,
  goal: number,
): PathResult {
  return runSearch(grid, w, h, start, goal, 'dfs');
}

export function astarSteps(
  grid: Uint8Array,
  w: number,
  h: number,
  start: number,
  goal: number,
): PathResult {
  return runSearch(grid, w, h, start, goal, 'astar');
}

export function runPath(
  algo: PathAlgoId,
  grid: Uint8Array,
  w: number,
  h: number,
  start: number,
  goal: number,
): PathResult {
  return runSearch(grid, w, h, start, goal, algo);
}
