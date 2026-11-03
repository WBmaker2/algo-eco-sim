/**
 * Ecosystem tick rules — birth / hunger / death + predation.
 * Ticks run at 10 Hz; rendering runs at 60 fps (separation in EcoStage).
 */

import { DEFAULT_ECO_PARAMS, SpatialHash, type EcoParams, type EcoWorld } from './agents';

export type EcoEventKind = 'drought' | 'disease' | 'hunter';

export interface TickStats {
  grass: number;
  rabbits: number;
  foxes: number;
  births: number;
  deaths: number;
  eaten: number;
}

function moveRandom(a: { x: number; y: number }, rng: () => number, step: number): void {
  a.x = Math.min(0.99, Math.max(0.01, a.x + (rng() - 0.5) * 2 * step));
  a.y = Math.min(0.99, Math.max(0.01, a.y + (rng() - 0.5) * 2 * step));
}

function moveToward(
  a: { x: number; y: number },
  tx: number,
  ty: number,
  rng: () => number,
  step: number,
): void {
  const dx = tx - a.x;
  const dy = ty - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const jitter = 0.35;
  a.x = Math.min(
    0.99,
    Math.max(0.01, a.x + (dx / d) * step + (rng() - 0.5) * step * jitter),
  );
  a.y = Math.min(
    0.99,
    Math.max(0.01, a.y + (dy / d) * step + (rng() - 0.5) * step * jitter),
  );
}

export function tickEco(
  world: EcoWorld,
  params: EcoParams = DEFAULT_ECO_PARAMS,
  rng: () => number = Math.random,
): TickStats {
  let births = 0;
  let deaths = 0;
  let eaten = 0;
  world.tick++;

  // 1) Grass regrows logistically: sparse meadows recover slowly,
  // lush ones fill fast (up to cap). A small baseline keeps spores blowing in.
  const room = Math.max(0, params.grassCap - world.grass.length);
  const density = world.grass.length / Math.max(1, params.grassCap);
  const sprouts = Math.min(room, Math.round(params.grassGrowth * (0.5 + rng()) * (0.2 + 0.8 * density)));
  for (let i = 0; i < sprouts; i++) {
    world.grass.push({ x: rng(), y: rng(), energy: 1 + rng() * 2 });
    births++;
  }

  const hash = new SpatialHash(0.08);
  hash.buildGrass(world.grass);

  // 2) Rabbits: flee nearby foxes, else wander; eat grass when hungry.
  const eatenGrass = new Set<number>();
  const newbornRabbits: typeof world.rabbits = [];
  for (const r of world.rabbits) {
    r.age++;
    // nearest fox within scare radius → run directly away from it
    let threatX = 0;
    let threatY = 0;
    let threatD = 0.09 * 0.09;
    let threatened = false;
    for (const f of world.foxes) {
      const d = (f.x - r.x) ** 2 + (f.y - r.y) ** 2;
      if (d < threatD) {
        threatD = d;
        threatX = f.x;
        threatY = f.y;
        threatened = true;
      }
    }
    if (threatened) {
      const dx = r.x - threatX;
      const dy = r.y - threatY;
      const d = Math.hypot(dx, dy) || 1;
      r.x = Math.min(0.99, Math.max(0.01, r.x + (dx / d) * 0.024));
      r.y = Math.min(0.99, Math.max(0.01, r.y + (dy / d) * 0.024));
    } else if (r.energy < 10) {
      // hungry: seek the nearest grass within smell range, else wander
      let bestG: number | null = null;
      let bestD = 0.15 * 0.15;
      for (let gi = 0; gi < world.grass.length; gi++) {
        const g = world.grass[gi]!;
        const d = (g.x - r.x) ** 2 + (g.y - r.y) ** 2;
        if (d < bestD) {
          bestD = d;
          bestG = gi;
        }
      }
      if (bestG !== null) {
        const g = world.grass[bestG]!;
        moveToward(r, g.x, g.y, rng, 0.03);
      } else {
        moveRandom(r, rng, 0.03);
      }
    } else {
      moveRandom(r, rng, 0.02);
    }
    if (r.energy < 10) {
      const near = hash.nearGrass(r.x, r.y, 0.04, world.grass);
      let meal: number | null = null;
      for (const gi of near) {
        if (!eatenGrass.has(gi)) {
          meal = gi;
          break;
        }
      }
      if (meal !== null) {
        eatenGrass.add(meal);
        r.energy += 6;
        eaten++;
      }
    }
    r.energy -= 0.35 * params.hunger;
    if (r.energy > 12 && world.rabbits.length + newbornRabbits.length < params.rabbitCap) {
      if (rng() < params.rabbitBirth) {
        r.energy -= 5;
        newbornRabbits.push({ x: r.x, y: r.y, energy: 6, age: 0 });
        births++;
      }
    }
  }
  if (eatenGrass.size > 0) {
    world.grass = world.grass.filter((_, i) => !eatenGrass.has(i));
  }
  const rabbitsBefore = world.rabbits.length;
  world.rabbits = world.rabbits.filter((r) => r.energy > 0 && r.age < 900);
  deaths += rabbitsBefore + newbornRabbits.length - world.rabbits.length - newbornRabbits.length;
  world.rabbits.push(...newbornRabbits);

  // 3) Foxes: chase rabbits within smell radius, else wander.
  // Satiated foxes (energy >= 22) rest instead of hunting — a natural brake
  // against overpredation wipeouts.
  const eatenRabbits = new Set<number>();
  const newbornFoxes: typeof world.foxes = [];
  const eatRadius = 0.024 * params.predation + 0.004;
  const smellRadius2 = 0.15 * 0.15;
  for (const f of world.foxes) {
    f.age++;
    // nearest uneaten rabbit within smell range (brute force is fine at scale)
    let best = -1;
    let bestD = smellRadius2;
    if (f.energy < 22) {
      for (let i = 0; i < world.rabbits.length; i++) {
        if (eatenRabbits.has(i)) continue;
        const r = world.rabbits[i]!;
        const d = (r.x - f.x) ** 2 + (r.y - f.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    if (best >= 0) {
      const target = world.rabbits[best]!;
      moveToward(f, target.x, target.y, rng, 0.03);
      if (bestD < eatRadius * eatRadius && rng() < 0.2 * params.predation + 0.03) {
        eatenRabbits.add(best);
        f.energy += 10;
        eaten++;
      }
    } else {
      moveRandom(f, rng, 0.028);
    }
    f.energy -= 0.3 * params.hunger;
    if (f.energy > 18 && world.foxes.length + newbornFoxes.length < params.foxCap) {
      if (rng() < params.foxBirth) {
        f.energy -= 9;
        newbornFoxes.push({ x: f.x, y: f.y, energy: 9, age: 0 });
        births++;
      }
    }
  }
  if (eatenRabbits.size > 0) {
    world.rabbits = world.rabbits.filter((_, i) => !eatenRabbits.has(i));
  }
  const foxesBefore = world.foxes.length;
  world.foxes = world.foxes.filter((f) => f.energy > 0 && f.age < 1200);
  deaths += foxesBefore + newbornFoxes.length - world.foxes.length - newbornFoxes.length;
  world.foxes.push(...newbornFoxes);

  return {
    grass: world.grass.length,
    rabbits: world.rabbits.length,
    foxes: world.foxes.length,
    births,
    deaths: Math.max(0, deaths + eatenRabbits.size),
    eaten,
  };
}

/** One-click disturbances (event cards). */
export function applyEcoEvent(
  world: EcoWorld,
  kind: EcoEventKind,
  rng: () => number = Math.random,
): string {
  switch (kind) {
    case 'drought': {
      // 가뭄: 풀 60% 시듦
      const kill = Math.floor(world.grass.length * 0.6);
      for (let i = 0; i < kill && world.grass.length > 0; i++) {
        const idx = (rng() * world.grass.length) | 0;
        world.grass.splice(idx, 1);
      }
      return `가뭄 발생 — 풀 ${kill}포기 시듦`;
    }
    case 'disease': {
      // 질병: 토끼 35% 폐사
      const kill = Math.floor(world.rabbits.length * 0.35);
      for (let i = 0; i < kill && world.rabbits.length > 0; i++) {
        const idx = (rng() * world.rabbits.length) | 0;
        world.rabbits.splice(idx, 1);
      }
      return `질병 발생 — 토끼 ${kill}마리 폐사`;
    }
    case 'hunter': {
      // 사냥꾼: 여우 50% 포획
      const kill = Math.max(1, Math.floor(world.foxes.length * 0.5));
      for (let i = 0; i < kill && world.foxes.length > 0; i++) {
        const idx = (rng() * world.foxes.length) | 0;
        world.foxes.splice(idx, 1);
      }
      return `사냥꾼 등장 — 여우 ${kill}마리 포획`;
    }
  }
}
