/** App shell — ModeTabs (Sort | Maze | Eco) + seeded sharing via ?seed=&mode=. */

import { EcoStage } from '../canvas/EcoStage';
import { MazeView } from '../canvas/MazeView';
import { SortView } from '../canvas/SortView';
import { seedFromUrl } from '../eco/rng';
import { createEcoStore } from '../stores/ecoStore';
import { createMazeStore } from '../stores/mazeStore';
import { createRaceStore } from '../stores/raceStore';

type Mode = 'sort' | 'maze' | 'eco';

const MODES: Array<{ id: Mode; label: string; desc: string }> = [
  { id: 'sort', label: '정렬 경주', desc: '버블·퀵·머지 대결' },
  { id: 'maze', label: '미로 길찾기', desc: 'BFS·DFS·A* 탐색' },
  { id: 'eco', label: '생태계', desc: '여우·토끼·풀 시뮬' },
];

function modeFromUrl(): Mode {
  const m = /[?&]mode=(sort|maze|eco)/.exec(
    typeof window !== 'undefined' ? window.location.search : '',
  );
  return (m?.[1] as Mode) ?? 'sort';
}

interface ActiveView {
  destroy(): void;
}

export class App {
  private mode: Mode;
  private seed: number;
  private shareKey = '';
  private view: ActiveView | null = null;
  private stage: HTMLElement | null = null;

  private race = createRaceStore(20260501);
  private maze = createMazeStore(20260501);
  private eco = createEcoStore(20260501);

  constructor(private root: HTMLElement) {
    this.seed = seedFromUrl();
    this.mode = modeFromUrl();
    // Re-seed stores from URL so ?seed= reproduces the same scenario.
    this.race = createRaceStore(this.seed);
    this.maze = createMazeStore(this.seed);
    this.eco = createEcoStore(this.seed);
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <a class="skip-link" href="#main">본문으로 건너뛰기</a>
      <header class="topbar">
        <h1>Algo Eco Sim <span class="sub">알고리즘 & 생태계 시뮬</span></h1>
        <nav class="tabs" role="tablist" aria-label="모드 선택">
          ${MODES.map(
            (m) => `
            <button type="button" role="tab" data-mode="${m.id}"
              aria-selected="${m.id === this.mode}" tabindex="${m.id === this.mode ? '0' : '-1'}">
              ${m.label}<small>${m.desc}</small>
            </button>`,
          ).join('')}
        </nav>
      </header>
      <main id="main" class="layout">
        <section class="stage" aria-label="시뮬레이션 무대"><div data-out="stage"></div></section>
        <aside class="panel" aria-label="학습 안내">
          <h2>이 화면에서 배워요</h2>
          <p data-out="guide"></p>
          <h2>공유하기</h2>
          <p data-out="share"></p>
        </aside>
      </main>
      <footer class="footer"><small>정보(정렬·탐색) + 과학(먹이사슬·생태계) · 초6~중3 · 결정적 시드 RNG</small></footer>
    `;
    this.stage = this.root.querySelector('[data-out="stage"]');
    // Keep the share panel truthful: seeds change on shuffle / new maze.
    this.race.subscribe(() => this.updateShare());
    this.maze.subscribe(() => this.updateShare());
    this.eco.subscribe(() => this.updateShare());
    this.updateShare();
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => this.switch(btn.dataset.mode as Mode));
      btn.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const ids = MODES.map((m) => m.id);
        let i = ids.indexOf(this.mode) + (e.key === 'ArrowRight' ? 1 : -1);
        i = (i + ids.length) % ids.length;
        this.switch(ids[i]!);
        this.root.querySelector<HTMLButtonElement>(`[data-mode="${ids[i]}"]`)?.focus();
      });
    });
    this.mountView();
  }

  private switch(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', mode);
      url.searchParams.set('seed', String(this.seed));
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* ignore */
    }
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
    const guide = this.root.querySelector('[data-out="guide"]');
    if (guide) guide.textContent = this.guideText(mode);
    this.mountView();
    this.updateShare();
  }

  /** Current scenario seed follows the active mode's store. */
  private activeSeed(): number {
    switch (this.mode) {
      case 'sort':
        return this.race.get().seed;
      case 'maze':
        return this.maze.get().seed;
      case 'eco':
        return this.eco.get().seed;
    }
  }

  private updateShare(): void {
    const el = this.root.querySelector('aside [data-out="share"]');
    if (!el) return;
    const seed = this.activeSeed();
    const key = `${this.mode}:${seed}`;
    if (key === this.shareKey) return;
    this.shareKey = key;
    el.innerHTML = '';
    const small = document.createElement('small');
    const a = document.createElement('span');
    a.textContent = '지금 장면의 시드 번호는 ';
    const strong = document.createElement('strong');
    strong.textContent = `#${seed}`;
    const b = document.createElement('span');
    b.textContent = ' 입니다. 주소창의 ';
    const code = document.createElement('code');
    code.textContent = `?seed=${seed}&mode=${this.mode}`;
    const c = document.createElement('span');
    c.textContent = '를 친구에게 보내면 똑같은 미로·배열·초원이 열립니다.';
    small.append(a, strong, b, code, c);
    el.appendChild(small);
  }

  private guideText(mode: Mode): string {    switch (mode) {
      case 'sort':
        return '같은 배열을 세 정렬이 나눠 달립니다. 막대 색이 빨갛게 빛나면 비교·교환이 일어난 자리, 아래 코드 줄이 함께 빛나며 무엇을 하는지 알려줍니다. 누가 단계가 가장 적을까요?';
      case 'maze':
        return '초록 칸에서 빨강 칸까지 길을 찾습니다. 민트색은 방문한 칸, 주황색은 경계(다음 후보), 금색은 찾은 길입니다. BFS·DFS·A*의 방문 칸 수와 길이를 비교해 보세요.';
      case 'eco':
        return '풀을 먹는 토끼, 토끼를 노리는 여우의 순환을 관찰합니다. 오른쪽 그래프는 실선(시뮬)과 점선(이론 LV 방정식)을 겹쳐 보여줍니다. 슬라이더와 사건 카드로 균형을 깨뜨려 보고, 미션에 도전해 보세요.';
    }
  }

  private mountView(): void {
    this.view?.destroy();
    this.view = null;
    const guide = this.root.querySelector('[data-out="guide"]');
    if (guide) guide.textContent = this.guideText(this.mode);
    if (!this.stage) return;
    if (this.mode === 'sort') {
      const v = new SortView(this.stage, this.race);
      v.mount();
      this.view = v;
    } else if (this.mode === 'maze') {
      const v = new MazeView(this.stage, this.maze);
      v.mount();
      this.view = v;
    } else {
      const v = new EcoStage(this.stage, this.eco);
      v.mount();
      this.view = v;
    }
  }
}
