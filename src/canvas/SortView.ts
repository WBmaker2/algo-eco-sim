/**
 * SortView — 3-lane sorting race on Canvas 2D + code highlight sync + stats.
 * Lanes advance simultaneously at `speed` steps/sec; winner = fewest steps.
 */

import { SORT_ALGOS, SORT_NAMES, type SortAlgoId } from '../algo/sortSteps';
import { reshuffleRace, resetRace, type RaceState } from '../stores/raceStore';
import type { Store } from '../stores/store';
import { renderCodePane } from '../ui/CodePane';

const LANE_COLORS: Record<SortAlgoId, string> = {
  bubble: '#4ade80',
  quick: '#ffd166',
  merge: '#7dd3fc',
};

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

export class SortView {
  private raf = 0;
  private last = 0;
  private acc: Record<SortAlgoId, number> = { bubble: 0, quick: 0, merge: 0 };
  private unsub: (() => void) | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private codeEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private destroyed = false;

  constructor(
    private root: HTMLElement,
    private store: Store<RaceState>,
  ) {}

  mount(): void {
    const s = this.store.get();
    this.root.innerHTML = `
      <section class="sort-wrap" aria-label="정렬 경주">
        <div class="sort-controls controls">
          <button type="button" data-act="toggle" class="btn-pulse">경주 시작하기</button>
          <button type="button" data-act="reset">처음으로</button>
          <button type="button" data-act="shuffle">새 배열 섞기</button>
          <label>속도 <input type="range" data-ctl="speed" min="5" max="600" step="5" value="${s.speed}" aria-label="재생 속도" /> <span data-out="speed"></span></label>
          <label>막대 수 <input type="range" data-ctl="size" min="10" max="60" step="2" value="${s.size}" aria-label="막대 수" /> <span data-out="size"></span></label>
          <label>코드 보기
            <select data-ctl="algo" aria-label="코드 보기 알고리즘 선택">
              <option value="bubble">버블 정렬</option>
              <option value="quick">퀵 정렬</option>
              <option value="merge">머지 정렬</option>
            </select>
          </label>
        </div>
        <canvas class="sort-canvas" aria-label="정렬 경주 막대 그래프"></canvas>
        <div class="sort-bottom">
          <div class="stats" data-out="stats" role="status" aria-live="polite"></div>
          <div class="codepane" data-out="code"></div>
        </div>
      </section>
    `;
    this.canvas = this.root.querySelector('.sort-canvas');
    this.codeEl = this.root.querySelector('[data-out="code"]');
    this.statsEl = this.root.querySelector('[data-out="stats"]');

    this.root.querySelector('[data-act="toggle"]')?.addEventListener('click', () => {
      const cur = this.store.get();
      const allDone = SORT_ALGOS.every(
        (a) => cur.positions[a] >= cur.results[a].steps.length - 1,
      );
      if (allDone) resetRace(this.store);
      this.store.set({ playing: !this.store.get().playing });
    });
    this.root.querySelector('[data-act="reset"]')?.addEventListener('click', () => {
      resetRace(this.store);
    });
    this.root.querySelector('[data-act="shuffle"]')?.addEventListener('click', () => {
      reshuffleRace(this.store, (Math.random() * 2 ** 31) | 0);
    });
    const speed = this.root.querySelector<HTMLInputElement>('[data-ctl="speed"]');
    speed?.addEventListener('input', () => {
      this.store.set({ speed: Number(speed.value) });
    });
    const size = this.root.querySelector<HTMLInputElement>('[data-ctl="size"]');
    size?.addEventListener('change', () => {
      reshuffleRace(this.store, this.store.get().seed, Number(size.value));
    });
    const algo = this.root.querySelector<HTMLSelectElement>('[data-ctl="algo"]');
    if (algo) algo.value = this.store.get().selected;
    algo?.addEventListener('change', () => {
      this.store.set({ selected: algo.value as SortAlgoId });
    });

    this.unsub = this.store.subscribe(() => this.render());
    this.last = performance.now();
    const loop = (t: number): void => {
      if (this.destroyed) return;
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.advance(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.render();
  }

  private advance(dt: number): void {
    const s = this.store.get();
    if (!s.playing) return;
    const next = { ...s.positions };
    let allDone = true;
    for (const a of SORT_ALGOS) {
      const total = s.results[a].steps.length;
      if (next[a] < total - 1) {
        this.acc[a] += dt * s.speed;
        const jump = Math.floor(this.acc[a]);
        if (jump > 0) {
          next[a] = Math.min(total - 1, next[a] + jump);
          this.acc[a] -= jump;
        }
      }
      if (next[a] < total - 1) allDone = false;
    }
    const patch: Partial<RaceState> = { positions: next };
    if (allDone) {
      patch.playing = false;
      let best: SortAlgoId = 'bubble';
      let bestSteps = Infinity;
      for (const a of SORT_ALGOS) {
        const n = s.results[a].steps.length;
        if (n < bestSteps) {
          bestSteps = n;
          best = a;
        }
      }
      patch.winner = best;
    }
    this.store.set(patch);
  }

  private render(): void {
    const s = this.store.get();
    const speedInput = this.root.querySelector<HTMLInputElement>('[data-ctl="speed"]');
    if (speedInput && document.activeElement !== speedInput) speedInput.value = String(s.speed);
    const sizeInput = this.root.querySelector<HTMLInputElement>('[data-ctl="size"]');
    if (sizeInput && document.activeElement !== sizeInput) sizeInput.value = String(s.size);
    const speedOut = this.root.querySelector('[data-out="speed"]');
    if (speedOut) speedOut.textContent = `${s.speed}단계/초`;
    const sizeOut = this.root.querySelector('[data-out="size"]');
    if (sizeOut) sizeOut.textContent = `${s.size}개`;
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-act="toggle"]');
    if (toggle) toggle.textContent = s.playing ? '일시정지' : '경주 시작하기';

    if (this.statsEl) {
      const rows = SORT_ALGOS.map((a) => {
        const pos = Math.min(s.positions[a], s.results[a].steps.length - 1);
        const step = s.results[a].steps[pos]!;
        const crown = s.winner === a ? ' 🏆' : '';
        return `<div class="stat-row${s.winner === a ? ' winner' : ''}"><span class="dot" style="background:${LANE_COLORS[a]}"></span><strong>${SORT_NAMES[a]}${crown}</strong><span>단계 ${fmt(pos + 1)} / ${fmt(s.results[a].steps.length)}</span><span>비교 ${fmt(step.comparisons)}</span><span>교환 ${fmt(step.swaps)}</span></div>`;
      }).join('');
      this.statsEl.innerHTML = rows;
    }
    if (this.codeEl) {
      const pos = Math.min(
        s.positions[s.selected],
        s.results[s.selected].steps.length - 1,
      );
      renderCodePane(this.codeEl, s.selected, s.results[s.selected].steps[pos]!.line);
    }
    this.draw(s);
  }

  private draw(s: RaceState): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 600;
    const h = 300;
    canvas.style.height = `${h}px`;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const lanes = SORT_ALGOS.length;
    const laneH = h / lanes;
    const n = s.size;
    const gap = Math.max(1, Math.min(4, w / n / 4));
    const barW = w / n - gap;
    SORT_ALGOS.forEach((a, li) => {
      const y0 = li * laneH;
      ctx.fillStyle = '#93b8a4';
      ctx.font = '11px system-ui';
      ctx.fillText(SORT_NAMES[a], 6, y0 + 14);
      const pos = Math.min(s.positions[a], s.results[a].steps.length - 1);
      const step = s.results[a].steps[pos]!;
      const arr = step.array;
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i]!;
        const bh = ((laneH - 30) * v) / n;
        const x = i * (w / n) + gap / 2;
        const y = y0 + laneH - 6 - bh;
        let color = LANE_COLORS[a];
        if (step.type === 'done') color = '#ffd166';
        else if (i === step.i || i === step.j) {
          color = step.type === 'pivot' ? '#c084fc' : '#ff6b6b';
        }
        ctx.globalAlpha = step.type === 'done' ? 0.95 : 0.85;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, Math.max(1, barW), bh);
      }
      ctx.globalAlpha = 1;
      // progress line
      const total = s.results[a].steps.length;
      ctx.fillStyle = '#1d3a2f';
      ctx.fillRect(0, y0 + laneH - 3, w, 2);
      ctx.fillStyle = LANE_COLORS[a];
      ctx.fillRect(0, y0 + laneH - 3, (w * pos) / Math.max(1, total - 1), 2);
    });
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unsub?.();
  }
}
