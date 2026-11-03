/**
 * Sorting step generators — pure `function*` yielding `{type, indices}` events.
 * The player replays collected steps at variable fps (clean separation).
 */

export type SortEventType = 'compare' | 'swap' | 'overwrite' | 'pivot' | 'done';

export interface SortStep {
  /** Snapshot of the array AFTER this event. */
  array: number[];
  type: SortEventType;
  i: number;
  j: number;
  /** 0-based source-code line to highlight in CodePane. */
  line: number;
  comparisons: number;
  swaps: number;
}

export interface SortResult {
  steps: SortStep[];
  comparisons: number;
  swaps: number;
  sorted: number[];
}

function snap(a: number[]): number[] {
  return [...a];
}

function push(
  out: SortStep[],
  array: number[],
  type: SortEventType,
  i: number,
  j: number,
  line: number,
  comparisons: number,
  swaps: number,
): void {
  out.push({ array: snap(array), type, i, j, line, comparisons, swaps });
}

function collect(
  input: number[],
  run: (a: number[], emit: (type: SortEventType, i: number, j: number, line: number) => void) => {
    comparisons: number;
    swaps: number;
  },
): SortResult {
  const a = [...input];
  const steps: SortStep[] = [];
  let comparisons = 0;
  let swaps = 0;
  const emit = (type: SortEventType, i: number, j: number, line: number): void => {
    if (type === 'compare') comparisons++;
    if (type === 'swap' || type === 'overwrite') swaps++;
    push(out_steps(), a, type, i, j, line, comparisons, swaps);
  };
  // helper indirection keeps emit counters in sync
  function out_steps(): SortStep[] {
    return steps;
  }
  const final = run(a, emit);
  comparisons = final.comparisons;
  swaps = final.swaps;
  push(steps, a, 'done', -1, -1, -1, comparisons, swaps);
  return { steps, comparisons, swaps, sorted: snap(a) };
}

export function isSorted(arr: readonly number[]): boolean {
  for (let i = 1; i < arr.length; i++) if (arr[i - 1]! > arr[i]!) return false;
  return true;
}

/** Bubble sort — line numbers map to BUBBLE_CODE in ui/CodePane. */
export function bubbleSort(input: number[]): SortResult {
  return collect(input, (a, emit) => {
    let comparisons = 0;
    let swaps = 0;
    const n = a.length;
    for (let end = n - 1; end > 0; end--) {
      emit('pivot', end, -1, 1); // line: for end...
      let exchanged = false;
      for (let i = 0; i < end; i++) {
        emit('compare', i, i + 1, 3); // line: if a[i] > a[i+1]
        comparisons++;
        if (a[i]! > a[i + 1]!) {
          [a[i], a[i + 1]] = [a[i + 1]!, a[i]!];
          swaps++;
          emit('swap', i, i + 1, 4); // line: swap
          exchanged = true;
        }
      }
      if (!exchanged) break;
    }
    return { comparisons, swaps };
  });
}

/** Quick sort (Lomuto) — line numbers map to QUICK_CODE. */
export function quickSort(input: number[]): SortResult {
  return collect(input, (a, emit) => {
    let comparisons = 0;
    let swaps = 0;
    const partition = (lo: number, hi: number): number => {
      const pivot = a[hi]!;
      emit('pivot', hi, -1, 2); // line: pivot = a[hi]
      let i = lo;
      for (let j = lo; j < hi; j++) {
        emit('compare', j, hi, 4); // line: if a[j] < pivot
        comparisons++;
        if (a[j]! < pivot) {
          if (i !== j) {
            [a[i], a[j]] = [a[j]!, a[i]!];
            swaps++;
            emit('swap', i, j, 5);
          }
          i++;
        }
      }
      if (i !== hi) {
        [a[i], a[hi]] = [a[hi]!, a[i]!];
        swaps++;
        emit('swap', i, hi, 7); // line: place pivot
      }
      return i;
    };
    const sort = (lo: number, hi: number): void => {
      if (lo >= hi) return;
      emit('pivot', lo, hi, 1); // line: quicksort(lo, hi)
      const p = partition(lo, hi);
      sort(lo, p - 1);
      sort(p + 1, hi);
    };
    sort(0, a.length - 1);
    return { comparisons, swaps };
  });
}

/** Merge sort — line numbers map to MERGE_CODE. */
export function mergeSort(input: number[]): SortResult {
  return collect(input, (a, emit) => {
    let comparisons = 0;
    let swaps = 0;
    const aux = [...a];
    const sort = (lo: number, hi: number): void => {
      if (hi - lo < 1) return;
      emit('pivot', lo, hi, 1); // line: split
      const mid = (lo + hi) >> 1;
      sort(lo, mid);
      sort(mid + 1, hi);
      // merge [lo..mid] + [mid+1..hi]
      for (let k = lo; k <= hi; k++) aux[k] = a[k];
      let i = lo;
      let j = mid + 1;
      for (let k = lo; k <= hi; k++) {
        if (j > hi || (i <= mid && aux[i]! <= aux[j]!)) {
          if (i <= mid) {
            emit('compare', i, Math.min(j, hi), 5); // line: take left
            comparisons++;
          }
          a[k] = aux[i]!;
          i++;
        } else {
          emit('compare', i <= mid ? i : lo, j, 5);
          comparisons++;
          a[k] = aux[j]!;
          j++;
        }
        swaps++;
        emit('overwrite', k, -1, 7); // line: a[k] = ...
      }
    };
    sort(0, a.length - 1);
    return { comparisons, swaps };
  });
}

export const SORT_ALGOS = ['bubble', 'quick', 'merge'] as const;
export type SortAlgoId = (typeof SORT_ALGOS)[number];

export function runSort(algo: SortAlgoId, input: number[]): SortResult {
  switch (algo) {
    case 'bubble':
      return bubbleSort(input);
    case 'quick':
      return quickSort(input);
    case 'merge':
      return mergeSort(input);
  }
}

export const SORT_NAMES: Record<SortAlgoId, string> = {
  bubble: '버블 정렬',
  quick: '퀵 정렬',
  merge: '머지 정렬',
};
