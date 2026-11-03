/** Race store — shared initial array + per-algo results + playback state. */

import { runSort, type SortAlgoId, type SortResult } from '../algo/sortSteps';
import { mulberry32, shuffled } from '../eco/rng';
import { Store } from './store';

export interface RaceState {
  seed: number;
  size: number;
  initial: number[];
  results: Record<SortAlgoId, SortResult>;
  positions: Record<SortAlgoId, number>;
  playing: boolean;
  speed: number; // steps per second (per lane)
  selected: SortAlgoId;
  winner: SortAlgoId | null;
}

function build(seed: number, size: number): Pick<RaceState, 'initial' | 'results'> {
  const rng = mulberry32(seed);
  const base = Array.from({ length: size }, (_, i) => i + 1);
  const initial = shuffled(base, rng);
  return {
    initial,
    results: {
      bubble: runSort('bubble', initial),
      quick: runSort('quick', initial),
      merge: runSort('merge', initial),
    },
  };
}

export function createRaceStore(seed: number, size = 28): Store<RaceState> {
  const b = build(seed, size);
  return new Store<RaceState>({
    seed,
    size,
    ...b,
    positions: { bubble: 0, quick: 0, merge: 0 },
    playing: false,
    speed: 60,
    selected: 'bubble',
    winner: null,
  });
}

export function reshuffleRace(store: Store<RaceState>, seed: number, size?: number): void {
  const s = size ?? store.get().size;
  store.set({
    seed,
    size: s,
    ...build(seed, s),
    positions: { bubble: 0, quick: 0, merge: 0 },
    playing: false,
    winner: null,
  });
}

export function resetRace(store: Store<RaceState>): void {
  store.set({ positions: { bubble: 0, quick: 0, merge: 0 }, playing: false, winner: null });
}
