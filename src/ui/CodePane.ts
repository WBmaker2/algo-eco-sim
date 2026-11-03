/** Code listings + highlight renderer (syncs with sort playback). */

import type { SortAlgoId } from '../algo/sortSteps';

export const BUBBLE_CODE = [
  'for end = n-1 … 1:',
  '  for i = 0 … end-1:',
  '    이웃 비교: a[i] > a[i+1] ?',
  '      서로 바꿈 (swap)',
  '  가장 큰 수가 맨 뒤로 확정',
];

export const QUICK_CODE = [
  'quicksort(lo, hi):',
  '  pivot = a[hi] 선택',
  '  i = lo 부터 경계 이동',
  '  if a[j] < pivot → 교환',
  '  작은 값들을 왼쪽에 모음',
  '  pivot 제자리 교환',
  '  왼쪽·오른쪽 재귀 정렬',
];

export const MERGE_CODE = [
  'mergesort(lo, hi):',
  '  절반으로 나눔 (split)',
  '  왼쪽·오른쪽 각각 정렬',
  '  두 줄을 앞에서부터 비교',
  '    작은 쪽을 꺼내어 기록',
  '  남은 꼬리 이어 붙이기',
  '  a[k] 자리에 차례로 덮어씀',
];

export const SORT_CODE: Record<SortAlgoId, string[]> = {
  bubble: BUBBLE_CODE,
  quick: QUICK_CODE,
  merge: MERGE_CODE,
};

/** Map a raw generator line number to a display row (clamped). */
export function lineToRow(algo: SortAlgoId, line: number): number {
  const rows = SORT_CODE[algo]!.length;
  if (line < 0) return -1;
  return Math.min(rows - 1, line % rows);
}

export function renderCodePane(el: HTMLElement, algo: SortAlgoId, line: number): void {
  const rows = SORT_CODE[algo]!;
  const active = lineToRow(algo, line);
  el.innerHTML = '';
  const ol = document.createElement('ol');
  ol.className = 'code-list';
  ol.setAttribute('aria-label', '알고리즘 코드');
  rows.forEach((text, i) => {
    const li = document.createElement('li');
    li.textContent = text;
    if (i === active) {
      li.className = 'active';
      li.setAttribute('aria-current', 'true');
    }
    ol.appendChild(li);
  });
  el.appendChild(ol);
}
