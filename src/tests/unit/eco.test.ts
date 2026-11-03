import { describe, expect, it } from 'vitest';
import { createWorld, DEFAULT_ECO_PARAMS } from '../../eco/agents';
import { lotkaStep, solveLotka } from '../../eco/lotka';
import { mulberry32 } from '../../eco/rng';
import { applyEcoEvent, tickEco } from '../../eco/rules';
import { chartTicks } from '../../ui/PopChart';

describe('ecosystem — zero foxes lets rabbits grow', () => {
  it('rabbit count increases without predators', () => {
    const rng = mulberry32(7);
    const world = createWorld(7, { grass: 250, rabbits: 30, foxes: 0, rng });
    const before = world.rabbits.length;
    for (let t = 0; t < 120; t++) tickEco(world, DEFAULT_ECO_PARAMS, rng);
    expect(world.rabbits.length).toBeGreaterThan(before);
  });

  it('foxes decline to extinction without any food', () => {
    const rng = mulberry32(9);
    const world = createWorld(9, { grass: 0, rabbits: 0, foxes: 8, rng });
    for (let t = 0; t < 400; t++) {
      tickEco(world, { ...DEFAULT_ECO_PARAMS, grassGrowth: 0 }, rng);
    }
    expect(world.foxes.length).toBe(0);
  });

  it('event cards disturb populations', () => {
    const rng = mulberry32(11);
    const world = createWorld(11, { grass: 200, rabbits: 100, foxes: 20, rng });
    const g0 = world.grass.length;
    const r0 = world.rabbits.length;
    const f0 = world.foxes.length;
    applyEcoEvent(world, 'drought', rng);
    applyEcoEvent(world, 'disease', rng);
    applyEcoEvent(world, 'hunter', rng);
    expect(world.grass.length).toBeLessThan(g0);
    expect(world.rabbits.length).toBeLessThan(r0);
    expect(world.foxes.length).toBeLessThan(f0);
  });
});

describe('population chart — renders 300 ticks', () => {
  it('history accumulates 300+ entries over 300 ticks', () => {
    const rng = mulberry32(5);
    const world = createWorld(5, { grass: 160, rabbits: 40, foxes: 10, rng });
    const history = {
      grass: [world.grass.length],
      rabbits: [world.rabbits.length],
      foxes: [world.foxes.length],
      lvRabbits: [world.rabbits.length],
      lvFoxes: [world.foxes.length],
    };
    for (let t = 0; t < 300; t++) {
      const s = tickEco(world, DEFAULT_ECO_PARAMS, rng);
      history.grass.push(s.grass);
      history.rabbits.push(s.rabbits);
      history.foxes.push(s.foxes);
      history.lvRabbits.push(s.rabbits);
      history.lvFoxes.push(s.foxes);
    }
    expect(chartTicks(history)).toBeGreaterThanOrEqual(300);
    expect(history.grass).toHaveLength(301);
  });
});

describe('lotka-volterra overlay', () => {
  it('stays non-negative and bounded for classroom params', () => {
    const traj = solveLotka({ rabbits: 40, foxes: 10 }, { alpha: 0.12, beta: 0.004, delta: 0.002, gamma: 0.1 }, 300);
    expect(traj).toHaveLength(300);
    for (const s of traj) {
      expect(s.rabbits).toBeGreaterThanOrEqual(0);
      expect(s.foxes).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(s.rabbits)).toBe(true);
      expect(Number.isFinite(s.foxes)).toBe(true);
    }
    // single step sanity: prey grows without predators
    const next = lotkaStep({ rabbits: 50, foxes: 0 }, { alpha: 0.12, beta: 0.004, delta: 0.002, gamma: 0.1 }, 1);
    expect(next.rabbits).toBeGreaterThan(50);
  });
});
