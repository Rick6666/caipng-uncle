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
    const s = { ...newGame(1), cooked: { friedCabbage: 2 }, upgrades: [] };
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
    const s = { ...newGame(1), cooked: { friedCabbage: 2 }, upgrades: ['fridge'] };
    const r = rollCloseEvents(s, onlyInspect);
    expect(r.repDelta).toBe(2);
  });
  it('野猫：有剩菜时移除一份', () => {
    const s = { ...newGame(1), cooked: { friedCabbage: 2 }, upgrades: [] };
    const r = rollCloseEvents(s, onlyCat);
    expect(r.removeDish).toBe('friedCabbage');
  });
  it('野猫：无剩菜不触发', () => {
    const s = { ...newGame(1), cooked: {}, upgrades: [] };
    const r = rollCloseEvents(s, onlyCat);
    expect(r.removeDish).toBe(null);
  });

  it('B-6 野猫偷走唯一剩菜后，卫生检查按「已无剩菜」判定（不能对不存在的剩菜罚款）', () => {
    const both = { chance: () => true, pick: (a) => a[0] };
    const s = { ...newGame(1), cooked: { friedCabbage: 1 }, upgrades: [] };
    const r = rollCloseEvents(s, both);
    expect(r.removeDish).toBe('friedCabbage'); // 猫偷走了唯一的剩菜
    expect(r.moneyDelta).toBe(0);              // 偷完已无剩菜 → 不应再被罚款
    expect(r.repDelta).toBe(2);                // 应按「无剩菜」表扬 +2，而不是「有剩菜无冰箱」罚 −2
  });
});
