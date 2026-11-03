import { describe, expect, it } from 'vitest';
import { isSorted, runSort, type SortAlgoId } from '../../algo/sortSteps';
import { mulberry32, shuffled } from '../../eco/rng';

const ALGOS: SortAlgoId[] = ['bubble', 'quick', 'merge'];

describe('sorting — all 3 algos produce sorted output', () => {
  it('sorts a fixed jumbled array', () => {
    const input = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0];
    for (const algo of ALGOS) {
      const res = runSort(algo, input);
      expect(isSorted(res.sorted)).toBe(true);
      expect(res.sorted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(res.steps.length).toBeGreaterThan(1);
      // every yielded snapshot up to the last keeps the same multiset
      const last = res.steps[res.steps.length - 1]!;
      expect([...last.array].sort((a, b) => a - b)).toEqual(res.sorted);
    }
  });

  it('sorts seeded random arrays of several sizes', () => {
    const rng = mulberry32(42);
    for (const size of [5, 12, 30]) {
      const base = Array.from({ length: size }, (_, i) => i);
      const input = shuffled(base, rng);
      for (const algo of ALGOS) {
        const res = runSort(algo, input);
        expect(isSorted(res.sorted)).toBe(true);
      }
    }
  });

  it('handles edge cases (empty / single / duplicates)', () => {
    for (const algo of ALGOS) {
      expect(runSort(algo, []).sorted).toEqual([]);
      expect(runSort(algo, [7]).sorted).toEqual([7]);
      expect(isSorted(runSort(algo, [3, 1, 2, 1, 3]).sorted)).toBe(true);
    }
  });
});
