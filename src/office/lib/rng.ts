/** Small seeded random generator (mulberry32) so the demo data is the same for everyone. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    next,
    /** Integer in [min, max] */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    /** Float in [min, max) */
    float: (min: number, max: number) => min + next() * (max - min),
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
    /** Pick by weight: [[value, weight], …] */
    weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of entries) {
        r -= w;
        if (r <= 0) return v;
      }
      return entries[entries.length - 1]![0];
    },
    /** Roughly normal, via the sum of three uniforms */
    normal: (mean: number, sd: number) => mean + sd * ((next() + next() + next() - 1.5) / 0.5),
    /** Poisson-distributed count with the given mean */
    poisson: (mean: number) => {
      const limit = Math.exp(-mean);
      let k = 0;
      let p = next();
      while (p > limit) {
        k++;
        p *= next();
      }
      return k;
    },
    shuffle: <T>(list: T[]): T[] => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
  return rng;
}

export type Rng = ReturnType<typeof createRng>;
