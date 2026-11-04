/**
 * MazeView — seeded grid + BFS/DFS/A* playback with visited/frontier/path
 * coloring, speed control and share-URL support.
 */

import { PATH_NAMES, type PathAlgoId } from '../algo/pathSteps';
import { shareUrl } from '../eco/rng';
import { newMaze, setMazeAlgo, type MazeState } from '../stores/mazeStore';
import type { Store } from '../stores/store';
import { guardToggle } from '../ui/toggleGuard';

const C = {
  wall: '#0b1a14',
  empty: '#07120e',
  visited: '#0d9488',
  frontier: '#f59e0b',
  path: '#ffd166',
  start: '#4ade80',
  goal: '#ff6b6b',
};

export class MazeView {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private unsub: (() => void) | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private statsKey = '';
  private lastCssH = -1;
  private destroyed = false;

  constructor(
    private root: HTMLElement,
    private store: Store<MazeState>,
  ) {}

  mount(): void {
    const s = this.store.get();
    this.root.innerHTML = `
      <section class="maze-wrap" aria-label="미로 길찾기">
        <div class="maze-controls controls">
          <label>알고리즘
            <select data-ctl="algo" aria-label="길찾기 알고리즘 선택">
              <option value="bfs">BFS (너비 우선)</option>
              <option value="dfs">DFS (깊이 우선)</option>
              <option value="astar">A* (별)</option>
            </select>
          </label>
          <button type="button" data-act="toggle" class="btn-pulse">탐색 시작하기</button>
          <button type="button" data-act="reset">처음으로</button>
          <button type="button" data-act="new">새 미로 만들기</button>
          <button type="button" data-act="share">공유 주소 복사</button>
          <label>속도 <input type="range" data-ctl="speed" min="10" max="1200" step="10" value="${s.speed}" aria-label="탐색 속도" /> <span data-out="speed"></span></label>
        </div>
        <div class="maze-body">
          <canvas class="maze-canvas" aria-label="미로 탐색 캔버스"></canvas>
          <div class="maze-stats stats" data-out="stats" role="status" aria-live="polite"></div>
        </div>
        <p class="hint" data-out="share-hint"></p>
      </section>
    `;
    this.canvas = this.root.querySelector('.maze-canvas');
    const canToggle = guardToggle();
    const algoSel = this.root.querySelector<HTMLSelectElement>('[data-ctl="algo"]');
    if (algoSel) algoSel.value = s.algo;
    algoSel?.addEventListener('change', () => {
      setMazeAlgo(this.store, algoSel.value as PathAlgoId);
    });
    this.root.querySelector('[data-act="toggle"]')?.addEventListener('click', () => {
      if (!canToggle()) return;
      const cur = this.store.get();
      if (cur.progress >= cur.result.steps.length) this.store.set({ progress: 0 });
      this.store.set({ playing: !this.store.get().playing });
    });
    this.root.querySelector('[data-act="reset"]')?.addEventListener('click', () => {
      this.store.set({ progress: 0, playing: false });
    });
    this.root.querySelector('[data-act="new"]')?.addEventListener('click', () => {
      newMaze(this.store, (Math.random() * 2 ** 31) | 0);
      this.syncUrl();
    });
    this.root.querySelector('[data-act="share"]')?.addEventListener('click', async () => {
      const url = shareUrl(this.store.get().seed, 'maze');
      try {
        await navigator.clipboard.writeText(url);
        const hint = this.root.querySelector('[data-out="share-hint"]');
        if (hint) hint.textContent = `공유 주소 복사됨: ${url}`;
      } catch {
        const hint = this.root.querySelector('[data-out="share-hint"]');
        if (hint) hint.textContent = `공유 주소: ${url}`;
      }
    });
    const speed = this.root.querySelector<HTMLInputElement>('[data-ctl="speed"]');
    speed?.addEventListener('input', () => {
      this.store.set({ speed: Number(speed.value) });
    });

    this.unsub = this.store.subscribe(() => this.render());
    this.last = performance.now();
    const loop = (t: number): void => {
      if (this.destroyed) return;
      try {
        const dt = Math.min(0.1, (t - this.last) / 1000);
        this.last = t;
        const st = this.store.get();
        if (st.playing) {
          this.acc += dt * st.speed;
          const jump = Math.floor(this.acc);
          if (jump > 0) {
            this.acc -= jump;
            const next = Math.min(st.result.steps.length, st.progress + jump);
            this.store.set({
              progress: next,
              playing: next < st.result.steps.length,
            });
          }
        }
        this.render();
      } finally {
        if (!this.destroyed) this.raf = requestAnimationFrame(loop);
      }
    };
    this.raf = requestAnimationFrame(loop);
    this.render();
  }

  private syncUrl(): void {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('seed', String(this.store.get().seed));
      url.searchParams.set('mode', 'maze');
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* non-browser test env */
    }
  }

  private render(): void {
    const s = this.store.get();
    const speedOut = this.root.querySelector('[data-out="speed"]');
    if (speedOut) speedOut.textContent = `${s.speed}칸/초`;
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-act="toggle"]');
    if (toggle) toggle.textContent = s.playing ? '일시정지' : '탐색 시작하기';
    // Rebuild stats only when something actually changed — rewriting innerHTML
    // at 60fps churns layout and spams the aria-live region for no benefit.
    const key = `${s.algo}:${s.progress}:${s.seed}:${s.result.steps.length}`;
    if (key !== this.statsKey) {
      this.statsKey = key;
      const stats = this.root.querySelector('[data-out="stats"]');
      if (stats) {
        const complete = s.progress >= s.result.steps.length;
        const visitText = complete
          ? `<span>방문</span><strong>${s.result.visitedCount}칸</strong>`
          : `<span>방문</span><strong>${Math.min(s.progress, s.result.visitedCount)}칸 탐색 중…</strong>`;
        const pathText = complete
          ? `<span>최종 경로</span><strong>${s.result.found ? `${s.result.pathLength}칸` : '없음'}</strong>`
          : `<span>최종 경로</span><strong>탐색 후 공개</strong>`;
        stats.innerHTML = `
        <div class="stat-row"><strong>${PATH_NAMES[s.algo]}</strong></div>
        <div class="stat-row">${visitText}</div>
        <div class="stat-row">${pathText}</div>
        <div class="stat-row"><span>미로 시드</span><strong>#${s.seed}</strong></div>
        <p class="legend"><span class="sw" style="background:${C.visited}"></span>방문 <span class="sw" style="background:${C.frontier}"></span>경계 <span class="sw" style="background:${C.path}"></span>최종 경로</p>
      `;
      }
    }
    this.draw(s);
  }

  private draw(s: MazeState): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const { cols, rows, grid, start, goal } = s.maze;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 560;
    const cell = Math.max(2, Math.floor(cssW / cols));
    const cssH = cell * rows;
    // Write the height only when it actually changes — rewriting layout from a
    // layout reading every frame is what lets a scrollbar feedback loop spin.
    if (cssH !== this.lastCssH) {
      this.lastCssH = cssH;
      canvas.style.height = `${cssH}px`;
    }
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.empty;
    ctx.fillRect(0, 0, cssW, cssH);

    // base grid
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        ctx.fillStyle = grid[i] === 1 ? C.wall : C.empty;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    // playback overlay
    const shown = s.result.steps.slice(0, s.progress);
    const pathSet = new Set<number>();
    for (const st of shown) {
      if (st.type === 'path') pathSet.add(st.index);
    }
    for (const st of shown) {
      const x = (st.index % cols) * cell;
      const y = ((st.index / cols) | 0) * cell;
      if (st.type === 'visit') {
        ctx.fillStyle = C.visited;
        ctx.fillRect(x, y, cell, cell);
      } else if (st.type === 'frontier' && !pathSet.has(st.index)) {
        ctx.fillStyle = C.frontier;
        ctx.fillRect(x + cell / 4, y + cell / 4, cell / 2, cell / 2);
      }
    }
    if (pathSet.size > 0) {
      ctx.fillStyle = C.path;
      for (const i of pathSet) {
        ctx.fillRect((i % cols) * cell, (((i / cols) | 0) * cell), cell, cell);
      }
    }
    // start / goal markers
    ctx.fillStyle = C.start;
    ctx.fillRect((start % cols) * cell, (((start / cols) | 0) * cell), cell, cell);
    ctx.fillStyle = C.goal;
    ctx.fillRect((goal % cols) * cell, (((goal / cols) | 0) * cell), cell, cell);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unsub?.();
  }
}
