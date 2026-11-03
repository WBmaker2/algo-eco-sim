/** Event cards — drought / disease / hunter one-click disturbances. */

import type { EcoEventKind } from '../eco/rules';

export interface EcoEventDef {
  kind: EcoEventKind;
  title: string;
  desc: string;
  icon: string;
}

export const ECO_EVENTS: EcoEventDef[] = [
  { kind: 'drought', title: '가뭄', desc: '풀 60%가 시듭니다', icon: '☀️' },
  { kind: 'disease', title: '질병', desc: '토끼 35%가 폐사합니다', icon: '🤒' },
  { kind: 'hunter', title: '사냥꾼', desc: '여우 절반을 포획합니다', icon: '🏹' },
];

export function renderEvents(el: HTMLElement, onFire: (kind: EcoEventKind) => void): void {
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'events';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', '사건 카드');
  for (const def of ECO_EVENTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'event-card';
    btn.dataset.event = def.kind;
    btn.innerHTML = `<span class="event-icon" aria-hidden="true">${def.icon}</span><span class="event-title"></span><span class="event-desc"></span>`;
    btn.querySelector('.event-title')!.textContent = def.title;
    btn.querySelector('.event-desc')!.textContent = def.desc;
    btn.addEventListener('click', () => onFire(def.kind));
    wrap.appendChild(btn);
  }
  el.appendChild(wrap);
}
