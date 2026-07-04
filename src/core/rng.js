// mulberry32：单一 uint32 状态，可序列化。core 内所有随机必须经由 state.rng。
export function createRng(seedOrState) {
  let s = (typeof seedOrState === 'object' ? seedOrState.s : seedOrState) >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted(items) {
      const total = items.reduce((sum, it) => sum + it.weight, 0);
      let roll = next() * total;
      for (const it of items) { roll -= it.weight; if (roll < 0) return it; }
      return items[items.length - 1];
    },
    getState: () => ({ s })
  };
}
