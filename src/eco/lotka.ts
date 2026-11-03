/**
 * Lotka–Volterra numeric overlay — theory-vs-sim comparison on the chart.
 * dR/dt = αR − βRF,  dF/dt = δRF − γF   (RK4 integration)
 */

export interface LotkaParams {
  /** Prey growth rate. */
  alpha: number;
  /** Predation rate. */
  beta: number;
  /** Predator growth per prey eaten. */
  delta: number;
  /** Predator death rate. */
  gamma: number;
}

export interface LotkaState {
  rabbits: number;
  foxes: number;
}

export const DEFAULT_LOTKA: LotkaParams = {
  alpha: 0.12,
  beta: 0.004,
  delta: 0.002,
  gamma: 0.1,
};

export function lotkaStep(s: LotkaState, p: LotkaParams, dt: number): LotkaState {
  const f = (r: number, f_: number): [number, number] => [
    p.alpha * r - p.beta * r * f_,
    p.delta * r * f_ - p.gamma * f_,
  ];
  const [k1r, k1f] = f(s.rabbits, s.foxes);
  const [k2r, k2f] = f(s.rabbits + (k1r * dt) / 2, s.foxes + (k1f * dt) / 2);
  const [k3r, k3f] = f(s.rabbits + (k2r * dt) / 2, s.foxes + (k2f * dt) / 2);
  const [k4r, k4f] = f(s.rabbits + k3r * dt, s.foxes + k3f * dt);
  return {
    rabbits: Math.max(0, s.rabbits + (dt / 6) * (k1r + 2 * k2r + 2 * k3r + k4r)),
    foxes: Math.max(0, s.foxes + (dt / 6) * (k1f + 2 * k2f + 2 * k3f + k4f)),
  };
}

/** Solve a theory trajectory of `steps` ticks starting from initial counts. */
export function solveLotka(
  initial: LotkaState,
  p: LotkaParams,
  steps: number,
  dt = 1,
): LotkaState[] {
  const out: LotkaState[] = [];
  let cur = { ...initial };
  for (let i = 0; i < steps; i++) {
    cur = lotkaStep(cur, p, dt);
    out.push({ ...cur });
  }
  return out;
}
