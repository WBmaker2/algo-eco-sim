/** Maze store — seeded maze + per-algo path result + playback progress. */

import { generateMaze, type Maze } from '../algo/mazeGen';
import { runPath, type PathAlgoId, type PathResult } from '../algo/pathSteps';
import { Store } from './store';

export interface MazeState {
  seed: number;
  maze: Maze;
  algo: PathAlgoId;
  result: PathResult;
  progress: number; // revealed steps
  playing: boolean;
  speed: number; // steps per second
}

export function createMazeStore(seed: number, cols = 25, rows = 19): Store<MazeState> {
  const maze = generateMaze(cols, rows, seed);
  const result = runPath('bfs', maze.grid, maze.cols, maze.rows, maze.start, maze.goal);
  return new Store<MazeState>({
    seed,
    maze,
    algo: 'bfs',
    result,
    progress: 0,
    playing: false,
    speed: 120,
  });
}

export function setMazeAlgo(store: Store<MazeState>, algo: PathAlgoId): void {
  const { maze } = store.get();
  store.set({
    algo,
    result: runPath(algo, maze.grid, maze.cols, maze.rows, maze.start, maze.goal),
    progress: 0,
    playing: false,
  });
}

export function newMaze(store: Store<MazeState>, seed: number): void {
  const { maze } = store.get();
  const fresh = generateMaze(maze.cols, maze.rows, seed);
  const { algo } = store.get();
  store.set({
    seed,
    maze: fresh,
    result: runPath(algo, fresh.grid, fresh.cols, fresh.rows, fresh.start, fresh.goal),
    progress: 0,
    playing: false,
  });
}
