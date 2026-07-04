import { describe, it, expect } from 'vitest';
import { rollOpenEvent, rollCloseEvents } from '../src/core/events.js';
import { createRng } from '../src/core/rng.js';
import { newGame } from '../src/core/state.js';
import { CONST } from '../src/core/data.js';

describe('events', () => {
  it('rollOpenEvent 触发率 ≈ EVENT_CHANCE(0.55)', () => {
    let hit = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const s = { ...newGame(seed), rep: 0 };
      if (rollOpenEvent(s, createRng(seed)) !== null) hit++;
    }
    const rate = hit / 2000;
    expect(rate).toBeGreaterThan(0.50);
    expect(rate).toBeLessThan(0.60);
  });
  it('rep < 55 永不出 tv', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const s = { ...newGame(seed), rep: 40 };
      expect(rollOpenEvent(s, createRng(seed))).not.toBe('tv');
    }
  });
  it('rep ≥ 55 可能出 tv', () => {
    let sawTv = false;
    for (let seed = 0; seed < 2000 && !sawTv; seed++) {
      const s = { ...newGame(seed), rep: 60 };
      if (rollOpenEvent(s, createRng(seed)) === 'tv') sawTv = true;
    }
    expect(sawTv).toBe(true);
  });

  const onlyInspect = { chance: (p) => p === CONST.INSPECTION_CHANCE, pick: (a) => a[0] };
  const onlyCat = { chance: (p) => p === CONST.CATSTEAL_CHANCE, pick: (a) => a[0] };

  it('卫生检查：有剩菜无冰箱 → 罚款 + 掉声望', () => {
    const s = { ...newGame(1), cooked: { stirVeg: 2 }, upgrades: [] };
    const r = rollCloseEvents(s, onlyInspect);
    expect(r.moneyDelta).toBe(-CONST.INSPECTION_FINE);
    expect(r.repDelta).toBe(-2);
  });
  it('卫生检查：无剩菜 → 表扬加声望', () => {
    const s = { ...newGame(1), cooked: {}, upgrades: [] };
    const r = rollCloseEvents(s, onlyInspect);
    expect(r.moneyDelta).toBe(0);
    expect(r.repDelta).toBe(2);
  });
  it('卫生检查：有冰箱即使有剩菜也表扬', () => {
    const s = { ...newGame(1), cooked: { stirVeg: 2 }, upgrades: ['fridge'] };
    const r = rollCloseEvents(s, onlyInspect);
    expect(r.repDelta).toBe(2);
  });
  it('野猫：有剩菜时移除一份', () => {
    const s = { ...newGame(1), cooked: { stirVeg: 2 }, upgrades: [] };
    const r = rollCloseEvents(s, onlyCat);
    expect(r.removeDish).toBe('stirVeg');
  });
  it('野猫：无剩菜不触发', () => {
    const s = { ...newGame(1), cooked: {}, upgrades: [] };
    const r = rollCloseEvents(s, onlyCat);
    expect(r.removeDish).toBe(null);
  });
});
