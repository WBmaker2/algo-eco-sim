/** Eco store — world + params + population history + mission tracking. */

import { createWorld, DEFAULT_ECO_PARAMS, type EcoParams, type EcoWorld } from '../eco/agents';
import { mulberry32 } from '../eco/rng';
import missionsData from '../data/missions.json';
import { Store } from './store';

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  species: 'rabbits' | 'foxes' | 'grass';
  min: number;
  max?: number;
  sustainSec: number;
  hint: string;
}

export interface MissionStatus {
  missionId: string;
  holdingSec: number;
  done: boolean;
}

export interface EcoHistory {
  grass: number[];
  rabbits: number[];
  foxes: number[];
  lvRabbits: number[];
  lvFoxes: number[];
}

export interface EcoState {
  seed: number;
  world: EcoWorld;
  params: EcoParams;
  history: EcoHistory;
  running: boolean;
  speed: number; // tick multiplier (1 = 10 ticks/sec)
  mission: MissionStatus;
  notice: string;
  showTheory: boolean;
  elapsedSec: number;
}

export function missionList(): MissionDef[] {
  return (missionsData as { missions: MissionDef[] }).missions;
}

export function createEcoStore(seed: number, missionId = 'rabbit-stable'): Store<EcoState> {
  const rng = mulberry32(seed);
  const world = createWorld(seed, {
    grass: 160,
    rabbits: 40,
    foxes: 10,
    rng,
  });
  return new Store<EcoState>({
    seed,
    world,
    params: { ...DEFAULT_ECO_PARAMS },
    history: {
      grass: [world.grass.length],
      rabbits: [world.rabbits.length],
      foxes: [world.foxes.length],
      lvRabbits: [world.rabbits.length],
      lvFoxes: [world.foxes.length],
    },
    running: false,
    speed: 1,
    mission: { missionId, holdingSec: 0, done: false },
    notice: '시작 버튼을 눌러 생태계를 깨워 보세요.',
    showTheory: true,
    elapsedSec: 0,
  });
}

export function resetEco(store: Store<EcoState>, seed?: number): void {
  const s = store.get();
  const nextSeed = seed ?? s.seed;
  const rng = mulberry32(nextSeed);
  const world = createWorld(nextSeed, { grass: 160, rabbits: 40, foxes: 10, rng });
  store.set({
    seed: nextSeed,
    world,
    history: {
      grass: [world.grass.length],
      rabbits: [world.rabbits.length],
      foxes: [world.foxes.length],
      lvRabbits: [world.rabbits.length],
      lvFoxes: [world.foxes.length],
    },
    running: false,
    mission: { ...s.mission, holdingSec: 0, done: false },
    notice: '새 초원이 준비되었습니다.',
    elapsedSec: 0,
  });
}

export function currentMission(store: Store<EcoState>): MissionDef {
  const list = missionList();
  return list.find((m) => m.id === store.get().mission.missionId) ?? list[0]!;
}

/** Mission check called once per tick (dtSec = simulated seconds). */
export function checkMission(
  store: Store<EcoState>,
  counts: { grass: number; rabbits: number; foxes: number },
  dtSec: number,
): void {
  const s = store.get();
  if (s.mission.done) return;
  const def = currentMission(store);
  const value = counts[def.species];
  const ok = value >= def.min && (def.max === undefined || value <= def.max);
  const holdingSec = ok ? s.mission.holdingSec + dtSec : 0;
  const done = holdingSec >= def.sustainSec;
  store.set({
    mission: { ...s.mission, holdingSec, done },
    notice: done ? `미션 성공! “${def.title}” 달성` : s.notice,
  });
}
