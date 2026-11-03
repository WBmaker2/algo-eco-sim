/** Live population chart (Canvas 2D, dependency-free). Renders 300+ ticks. */

import type { EcoHistory } from '../stores/ecoStore';

export interface ChartOptions {
  showTheory: boolean;
  window?: number; // visible ticks (default 300)
}

const COLORS = {
  grass: '#4ade80',
  rabbits: '#e9f4ec',
  foxes: '#fb923c',
  theoryR: '#94a3b8',
  theoryF: '#f472b6',
};

export function renderPopChart(
  canvas: HTMLCanvasElement,
  history: EcoHistory,
  opts: ChartOptions,
): { max: number; ticks: number } {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 160;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return { max: 0, ticks: 0 };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const windowN = opts.window ?? 300;
  const n = Math.max(history.grass.length, history.rabbits.length, history.foxes.length);
  const start = Math.max(0, n - windowN);
  const ticks = n - start;
  const series = [
    history.grass.slice(start),
    history.rabbits.slice(start),
    history.foxes.slice(start),
  ];
  let max = 10;
  for (const s of series) for (const v of s) if (v > max) max = v;
  if (opts.showTheory) {
    for (const v of history.lvRabbits.slice(start)) if (v > max) max = v;
    for (const v of history.lvFoxes.slice(start)) if (v > max) max = v;
  }
  max = Math.ceil(max * 1.1);

  // gridlines
  ctx.strokeStyle = '#1d3a2f';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#93b8a4';
  ctx.font = '10px system-ui';
  for (let g = 0; g <= 4; g++) {
    const y = 8 + ((h - 28) * g) / 4;
    ctx.beginPath();
    ctx.moveTo(34, y);
    ctx.lineTo(w - 6, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(max * (1 - g / 4))), 4, y + 3);
  }

  const plot = (data: number[], color: string, dashed: boolean): void => {
    if (data.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 1.2 : 1.8;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = 34 + ((w - 42) * i) / Math.max(1, windowN - 1);
      const y = 8 + (h - 28) * (1 - v / max);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  if (opts.showTheory) {
    plot(history.lvRabbits.slice(start), COLORS.theoryR, true);
    plot(history.lvFoxes.slice(start), COLORS.theoryF, true);
  }
  plot(history.grass.slice(start), COLORS.grass, false);
  plot(history.rabbits.slice(start), COLORS.rabbits, false);
  plot(history.foxes.slice(start), COLORS.foxes, false);

  // legend
  ctx.font = '11px system-ui';
  const legend: Array<[string, string]> = [
    ['풀', COLORS.grass],
    ['토끼', COLORS.rabbits],
    ['여우', COLORS.foxes],
  ];
  if (opts.showTheory) {
    legend.push(['토끼(이론)', COLORS.theoryR]);
    legend.push(['여우(이론)', COLORS.theoryF]);
  }
  legend.forEach(([label, color], i) => {
    const x = 38 + i * 78;
    const y = h - 6;
    if (x + 70 > w) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 8, 12, 4);
    ctx.fillStyle = '#cfe3d6';
    ctx.fillText(label, x + 16, y);
  });

  return { max, ticks };
}

export function chartTicks(history: EcoHistory): number {
  return history.rabbits.length;
}
