/**
 * Ecosystem agents — grass / rabbit / fox on a continuous field [0,1]^2.
 * Positions live in plain arrays (classroom-readable); a spatial hash
 * accelerates neighbor lookup for eating/predation.
 */

export interface Grass {
  x: number;
  y: number;
  energy: number;
}

export interface Animal {
  x: number;
  y: number;
  energy: number;
  age: number;
}

export interface EcoWorld {
  grass: Grass[];
  rabbits: Animal[];
  foxes: Animal[];
  width: number; // logical units (1x1 field scaled at render)
  tick: number;
  seed: number;
}

export interface EcoParams {
  /** New grass shoots per tick. */
  grassGrowth: number;
  /** Rabbit reproduction probability when well-fed (0..1). */
  rabbitBirth: number;
  /** Fox reproduction probability when well-fed (0..1). */
  foxBirth: number;
  /** Predation success radius multiplier (0..2). */
  predation: number;
  /** Base energy drain per tick. */
  hunger: number;
  grassCap: number;
  rabbitCap: number;
  foxCap: number;
}

export const DEFAULT_ECO_PARAMS: EcoParams = {
  grassGrowth: 14,
  rabbitBirth: 0.14,
  foxBirth: 0.03,
  predation: 1,
  hunger: 1,
  grassCap: 420,
  rabbitCap: 320,
  foxCap: 120,
};

export function createWorld(
  seed: number,
  opts?: { grass?: number; rabbits?: number; foxes?: number; rng?: () => number },
): EcoWorld {
  const rng = opts?.rng ?? Math.random;
  const grassCount = opts?.grass ?? 160;
  const rabbitCount = opts?.rabbits ?? 40;
  const foxCount = opts?.foxes ?? 10;
  const grass: Grass[] = [];
  const rabbits: Animal[] = [];
  const foxes: Animal[] = [];
  for (let i = 0; i < grassCount; i++) {
    grass.push({ x: rng(), y: rng(), energy: 1 + rng() * 2 });
  }
  for (let i = 0; i < rabbitCount; i++) {
    rabbits.push({ x: rng(), y: rng(), energy: 6 + rng() * 4, age: 0 });
  }
  for (let i = 0; i < foxCount; i++) {
    foxes.push({ x: rng(), y: rng(), energy: 12 + rng() * 6, age: 0 });
  }
  return { grass, rabbits, foxes, width: 1, tick: 0, seed: seed >>> 0 };
}

export function countPops(world: EcoWorld): { grass: number; rabbits: number; foxes: number } {
  return { grass: world.grass.length, rabbits: world.rabbits.length, foxes: world.foxes.length };
}

/** Spatial hash for O(1)-ish neighbor lookup. */
export class SpatialHash {
  private cells = new Map<string, number[]>();
  constructor(private cellSize: number) {}

  private key(x: number, y: number): string {
    return `${(x / this.cellSize) | 0}:${(y / this.cellSize) | 0}`;
  }

  buildGrass(grass: Grass[]): void {
    this.cells.clear();
    for (let i = 0; i < grass.length; i++) {
      const g = grass[i]!;
      const k = this.key(g.x, g.y);
      const arr = this.cells.get(k);
      if (arr) arr.push(i);
      else this.cells.set(k, [i]);
    }
  }

  /** Indices of grass near (x,y) within radius (checks 3x3 cells). */
  nearGrass(x: number, y: number, radius: number, grass: Grass[]): number[] {
    const out: number[] = [];
    const r2 = radius * radius;
    const baseX = (x / this.cellSize) | 0;
    const baseY = (y / this.cellSize) | 0;
    for (let cx = baseX - 1; cx <= baseX + 1; cx++) {
      for (let cy = baseY - 1; cy <= baseY + 1; cy++) {
        const arr = this.cells.get(`${cx}:${cy}`);
        if (!arr) continue;
        for (const gi of arr) {
          const g = grass[gi];
          if (!g) continue;
          const dx = g.x - x;
          const dy = g.y - y;
          if (dx * dx + dy * dy <= r2) out.push(gi);
        }
      }
    }
    return out;
  }
}
