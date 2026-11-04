import { describe, expect, it, vi } from 'vitest';
import { guardToggle } from '../../ui/toggleGuard';

describe('toggle guard — double-tap protection', () => {
  it('lets the first tap through and swallows the immediate second', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const canToggle = guardToggle(350);
      expect(canToggle()).toBe(true);
      now += 150; // accidental double-tap
      expect(canToggle()).toBe(false);
      now += 300; // 450ms later — intentional press works again
      expect(canToggle()).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
