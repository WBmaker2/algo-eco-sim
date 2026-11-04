/**
 * EcoStage — agent canvas (60fps render, 10Hz rule ticks) + sliders +
 * live population chart + event cards + mission mode.
 */

import { countPops, type EcoParams } from '../eco/agents';
import { applyEcoEvent, tickEco, type EcoEventKind } from '../eco/rules';
import { DEFAULT_LOTKA, lotkaStep } from '../eco/lotka';
import { mulberry32, shareUrl } from '../eco/rng';
import {
  checkMission,
  currentMission,
  missionList,
  resetEco,
  type EcoState,
} from '../stores/ecoStore';
import type { Store } from '../stores/store';
import { renderEvents } from '../ui/Events';
import { renderPopChart } from '../ui/PopChart';
import { guardToggle } from '../ui/toggleGuard';

const TICK_HZ = 10;

export class EcoStage {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private unsub: (() => void) | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private chart: HTMLCanvasElement | null = null;
  private destroyed = false;
  private rng: () => number;
  private lv = { rabbits: 0, foxes: 0 };

  constructor(
    private root: HTMLElement,
    private store: Store<EcoState>,
  ) {
    const s = store.get();
    this.rng = mulberry32(s.seed ^ 0x9e3779b9);
    this.lv = { rabbits: s.world.rabbits.length, foxes: s.world.foxes.length };
  }

  mount(): void {
    const s = this.store.get();
    const missions = missionList();
    this.root.innerHTML = `
      <section class="eco-wrap" aria-label="생태계 시뮬레이션">
        <div class="eco-controls controls">
          <button type="button" data-act="toggle" class="btn-pulse">생태계 깨우기</button>
          <button type="button" data-act="reset">초원 새로 만들기</button>
          <button type="button" data-act="share">공유 주소 복사</button>
          <label>미션
            <select data-ctl="mission" aria-label="미션 선택">
              ${missions.map((m) => `<option value="${m.id}">${m.title}</option>`).join('')}
            </select>
          </label>
          <label>속도
            <select data-ctl="speed" aria-label="시뮬레이션 속도">
              <option value="1">1배속</option>
              <option value="2">2배속</option>
              <option value="4">4배속</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" data-ctl="theory" ${s.showTheory ? 'checked' : ''} /> 이론 곡선(LV)</label>
        </div>
        <div class="eco-body">
          <div class="eco-stage">
            <canvas class="eco-canvas" aria-label="여우 토끼 풀 에이전트 캔버스"></canvas>
            <div class="eco-notice" data-out="notice" role="status" aria-live="polite"></div>
            <div class="eco-mission" data-out="mission"></div>
          </div>
          <div class="eco-side">
            <canvas class="eco-chart" aria-label="실시간 개체수 그래프"></canvas>
            <div class="sliders" data-out="sliders"></div>
          </div>
        </div>
        <div data-out="events"></div>
      </section>
    `;
    this.canvas = this.root.querySelector('.eco-canvas');
    this.chart = this.root.querySelector('.eco-chart');
    const canToggle = guardToggle();

    const missionSel = this.root.querySelector<HTMLSelectElement>('[data-ctl="mission"]');
    if (missionSel) missionSel.value = s.mission.missionId;
    missionSel?.addEventListener('change', () => {
      this.store.set({ mission: { missionId: missionSel.value, holdingSec: 0, done: false } });
    });
    const speedSel = this.root.querySelector<HTMLSelectElement>('[data-ctl="speed"]');
    if (speedSel) speedSel.value = String(s.speed);
    speedSel?.addEventListener('change', () => {
      this.store.set({ speed: Number(speedSel.value) });
    });
    const theory = this.root.querySelector<HTMLInputElement>('[data-ctl="theory"]');
    theory?.addEventListener('change', () => {
      this.store.set({ showTheory: theory.checked });
    });

    this.root.querySelector('[data-act="toggle"]')?.addEventListener('click', () => {
      if (!canToggle()) return;
      const wasRunning = this.store.get().running;
      if (!wasRunning && this.store.get().notice.startsWith('시작 버튼을')) {
        this.store.set({ notice: '생태계가 살아 움직입니다. 그래프의 파도를 관찰해 보세요.' });
      }
      this.store.set({ running: !wasRunning });
    });
    this.root.querySelector('[data-act="reset"]')?.addEventListener('click', () => {
      this.rng = mulberry32(this.store.get().seed ^ 0x9e3779b9);
      resetEco(this.store);
      const w = this.store.get().world;
      this.lv = { rabbits: w.rabbits.length, foxes: w.foxes.length };
    });
    this.root.querySelector('[data-act="share"]')?.addEventListener('click', async () => {
      const url = shareUrl(this.store.get().seed, 'eco');
      try {
        await navigator.clipboard.writeText(url);
        this.store.set({ notice: `공유 주소 복사됨: ${url}` });
      } catch {
        this.store.set({ notice: `공유 주소: ${url}` });
      }
    });

    this.buildSliders();
    const eventsEl = this.root.querySelector<HTMLElement>('[data-out="events"]');
    if (eventsEl) {
      renderEvents(eventsEl, (kind: EcoEventKind) => {
        const msg = applyEcoEvent(this.store.get().world, kind, this.rng);
        this.store.set({ notice: `${msg} — 균형이 어떻게 바뀌나요?` });
        this.render();
      });
    }

    this.unsub = this.store.subscribe(() => this.render());
    this.last = performance.now();
    const loop = (t: number): void => {
      if (this.destroyed) return;
      try {
        const dt = Math.min(0.1, (t - this.last) / 1000);
        this.last = t;
        this.update(dt);
        this.render();
      } finally {
        if (!this.destroyed) this.raf = requestAnimationFrame(loop);
      }
    };
    this.raf = requestAnimationFrame(loop);
    this.render();
  }

  private buildSliders(): void {
    const box = this.root.querySelector('[data-out="sliders"]');
    if (!box) return;
    const defs: Array<{
      key: keyof EcoParams;
      label: string;
      min: number;
      max: number;
      step: number;
    }> = [
      { key: 'grassGrowth', label: '풀 성장', min: 0, max: 16, step: 1 },
      { key: 'rabbitBirth', label: '토끼 번식률', min: 0, max: 0.4, step: 0.01 },
      { key: 'foxBirth', label: '여우 번식률', min: 0, max: 0.3, step: 0.01 },
      { key: 'predation', label: '포식률', min: 0, max: 2, step: 0.05 },
    ];
    box.innerHTML = '';
    for (const d of defs) {
      const label = document.createElement('label');
      label.className = 'slider';
      const span = document.createElement('span');
      span.dataset.out = `param-${d.key}`;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(d.min);
      input.max = String(d.max);
      input.step = String(d.step);
      input.value = String(this.store.get().params[d.key]);
      input.setAttribute('aria-label', d.label);
      input.addEventListener('input', () => {
        this.store.set({ params: { ...this.store.get().params, [d.key]: Number(input.value) } });
      });
      label.append(d.label, input, span);
      box.appendChild(label);
    }
  }

  private update(dt: number): void {
    const s = this.store.get();
    if (!s.running) return;
    this.acc += dt * TICK_HZ * s.speed;
    let ticks = Math.floor(this.acc);
    if (ticks <= 0) return;
    ticks = Math.min(ticks, 40); // clamp tab-switch bursts
    this.acc -= ticks;
    for (let k = 0; k < ticks; k++) {
      const stats = tickEco(s.world, s.params, this.rng);
      this.lv = lotkaStep(this.lv, DEFAULT_LOTKA, 1);
      const h = s.history;
      h.grass.push(stats.grass);
      h.rabbits.push(stats.rabbits);
      h.foxes.push(stats.foxes);
      h.lvRabbits.push(Math.round(this.lv.rabbits));
      h.lvFoxes.push(Math.round(this.lv.foxes));
      if (h.rabbits.length > 1200) {
        h.grass.shift();
        h.rabbits.shift();
        h.foxes.shift();
        h.lvRabbits.shift();
        h.lvFoxes.shift();
      }
      checkMission(this.store, stats, 1 / TICK_HZ);
      s.elapsedSec += 1 / TICK_HZ;
    }
  }

  private render(): void {
    const s = this.store.get();
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-act="toggle"]');
    if (toggle) toggle.textContent = s.running ? '일시정지' : '생태계 깨우기';
    const notice = this.root.querySelector('[data-out="notice"]');
    if (notice) {
      const c = countPops(s.world);
      notice.textContent = `${s.notice} (풀 ${c.grass} · 토끼 ${c.rabbits} · 여우 ${c.foxes})`;
    }
    const missionEl = this.root.querySelector('[data-out="mission"]');
    if (missionEl) {
      const def = currentMission(this.store);
      const remain = Math.max(0, def.sustainSec - s.mission.holdingSec);
      missionEl.innerHTML = '';
      const card = document.createElement('div');
      card.className = `mission-card${s.mission.done ? ' done' : ''}`;
      const title = document.createElement('strong');
      title.textContent = s.mission.done ? `🎉 ${def.title} — 성공!` : `🎯 미션: ${def.title}`;
      const desc = document.createElement('p');
      desc.textContent = def.description;
      const prog = document.createElement('div');
      prog.className = 'mission-progress';
      const bar = document.createElement('div');
      bar.className = 'mission-bar';
      bar.style.width = `${Math.min(100, (s.mission.holdingSec / def.sustainSec) * 100)}%`;
      prog.appendChild(bar);
      const label = document.createElement('small');
      label.textContent = s.mission.done
        ? '미션을 달성했습니다. 다른 미션에도 도전해 보세요!'
        : `유지 중: ${s.mission.holdingSec.toFixed(0)}초 / 목표 ${def.sustainSec}초 (남은 ${remain.toFixed(0)}초) · 힌트: ${def.hint}`;
      card.append(title, desc, prog, label);
      missionEl.appendChild(card);
    }
    // slider readouts
    for (const key of ['grassGrowth', 'rabbitBirth', 'foxBirth', 'predation'] as const) {
      const out = this.root.querySelector(`[data-out="param-${key}"]`);
      if (out) out.textContent = String(s.params[key]);
    }
    this.draw();
    if (this.chart) renderPopChart(this.chart, s.history, { showTheory: s.showTheory });
  }

  private draw(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const s = this.store.get();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 560;
    const h = 360;
    canvas.style.height = `${h}px`;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // meadow background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a2018');
    grad.addColorStop(1, '#060f0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const X = (x: number): number => 8 + x * (w - 16);
    const Y = (y: number): number => 8 + y * (h - 16);
    // grass
    ctx.fillStyle = '#22c55e';
    for (const g of s.world.grass) {
      ctx.globalAlpha = 0.5 + Math.min(0.5, g.energy / 4);
      ctx.fillRect(X(g.x), Y(g.y), 3, 5);
    }
    ctx.globalAlpha = 1;
    // rabbits
    for (const r of s.world.rabbits) {
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(X(r.x), Y(r.y), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(X(r.x) - 1.5, Y(r.y) - 4, 1.4, 0, Math.PI * 2);
      ctx.arc(X(r.x) + 1.5, Y(r.y) - 4, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // foxes
    for (const f of s.world.foxes) {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(X(f.x), Y(f.y), 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(X(f.x) - 4, Y(f.y) - 4);
      ctx.lineTo(X(f.x) - 1, Y(f.y) - 8);
      ctx.lineTo(X(f.x) + 1, Y(f.y) - 4);
      ctx.moveTo(X(f.x) + 1, Y(f.y) - 4);
      ctx.lineTo(X(f.x) + 4, Y(f.y) - 8);
      ctx.lineTo(X(f.x) + 5, Y(f.y) - 3);
      ctx.fill();
    }
    // tick badge
    ctx.fillStyle = '#93b8a4';
    ctx.font = '11px system-ui';
    ctx.fillText(`tick ${s.world.tick} · ${s.elapsedSec.toFixed(0)}초 경과`, 10, h - 8);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unsub?.();
  }
}
