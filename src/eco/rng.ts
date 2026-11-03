/** Deterministic RNG (mulberry32) — maze/eco scenarios shareable via URL ?seed=. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Read ?seed= from URL; falls back to Date-based seed when absent. */
export function seedFromUrl(url?: string): number {
  const search =
    typeof url === 'string'
      ? url
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  const m = /[?&]seed=([^&]+)/.exec(search);
  if (m?.[1]) {
    const raw = decodeURIComponent(m[1]);
    const num = Number(raw);
    if (Number.isFinite(num)) return num >>> 0;
    return hashStringToSeed(raw);
  }
  return (Date.now() % 2147483647) >>> 0;
}

/** Build a shareable URL string with the given seed (and optional mode). */
export function shareUrl(seed: number, mode?: string, base?: string): string {
  const origin =
    base ?? (typeof window !== 'undefined' ? window.location.href.split('?')[0] : '');
  const params = new URLSearchParams();
  params.set('seed', String(seed >>> 0));
  if (mode) params.set('mode', mode);
  return origin ? `${origin}?${params.toString()}` : `?${params.toString()}`;
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Deterministic shuffle (Fisher–Yates) using the provided rng. */
export function shuffled<T>(input: readonly T[], rng: () => number): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
