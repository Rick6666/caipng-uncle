import { describe, it, expect } from 'vitest';
import { generateQueue, resolveQuote, resolveHaggle, findSubstitute } from '../src/core/customers.js';
import { createRng } from '../src/core/rng.js';

const ctx = (over = {}) => ({ rep: 0, cooked: { stirVeg: 9, friedWing: 9 }, todayEvent: null, upgrades: [], ...over });

describe('customers', () => {
  it('点单只点已备菜品，有荤时每单至少一道荤', () => {
    const rng = createRng(5);
    const q = generateQueue(ctx(), 12, rng);
    for (const c of q) {
      expect(c.dishes.length).toBeGreaterThan(0);
      for (const d of c.dishes) expect(['stirVeg', 'friedWing']).toContain(d);
      expect(c.dishes).toContain('friedWing'); // 唯一荤菜必点
      expect(c.name).toBeTruthy();
      expect(c.greeting).toBeTruthy();
    }
  });
  it('rep 0 不出现高解锁顾客', () => {
    const rng = createRng(6);
    const q = generateQueue(ctx(), 60, rng);
    for (const c of q) expect(['student', 'worker', 'ahma', 'uncle2']).toContain(c.type);
  });
  it('rep 55 且菜品种类≥6 才可能出现 foodie', () => {
    const rng = createRng(2);
    const richCooked = { stirVeg: 5, braisedEgg: 5, mapoTofu: 5, friedWing: 5, braisedPork: 5, steamedFish: 5 };
    const q = generateQueue(ctx({ rep: 55, cooked: richCooked }), 80, rng);
    // 至少可能出现（不强制），但种类不足时绝不出现
    const rng2 = createRng(2);
    const qPoor = generateQueue(ctx({ rep: 55, cooked: { stirVeg: 5, friedWing: 5 } }), 80, rng2);
    expect(qPoor.some(c => c.type === 'foodie')).toBe(false);
  });
  it('influencer + kind → rep +6 必付款', () => {
    const out = resolveQuote({ type: 'influencer', name: 'x', dishes: ['stirVeg'] }, 'kind', createRng(1));
    expect(out.paid).toBe(true);
    expect(out.repDelta).toBe(6);
    expect(out.line).toBeTruthy();
  });
  it('ahma + slash → 进入砍价', () => {
    const out = resolveQuote({ type: 'ahma', name: 'x', dishes: ['stirVeg'] }, 'slash', createRng(1));
    expect(out.haggle).toBe(true);
  });
  it('student + slash 两分支 rep 分别 -3 / -2', () => {
    // 打桩 rng.chance：真=付款 / 假=走人
    const paidRng = { chance: () => true, pick: (a) => a[0] };
    const walkRng = { chance: () => false, pick: (a) => a[0] };
    const cust = { type: 'student', name: 'x', dishes: ['stirVeg'] };
    expect(resolveQuote(cust, 'slash', paidRng)).toMatchObject({ paid: true, repDelta: -3 });
    expect(resolveQuote(cust, 'slash', walkRng)).toMatchObject({ paid: false, walkout: true, repDelta: -2 });
  });
  it('ahma 砍价：接受收正常价 rep0；赌一把两分支', () => {
    const cust = { type: 'ahma', name: 'x', dishes: ['stirVeg'] };
    const accept = resolveHaggle(cust, true, createRng(1));
    expect(accept).toMatchObject({ paid: true, repDelta: 0 });
    const gambleWalk = resolveHaggle(cust, false, { chance: () => false, pick: (a) => a[0] });
    expect(gambleWalk).toMatchObject({ paid: false, repDelta: -3 });
  });
  it('替代菜同类优先，无同类返回 null', () => {
    expect(findSubstitute('friedWing', { braisedPork: 2 })).toBe('braisedPork'); // 同 meat
    expect(findSubstitute('friedWing', { stirVeg: 2 })).toBe(null);              // veg 非同类
    expect(findSubstitute('friedWing', { friedWing: 0, braisedPork: 0 })).toBe(null); // 无货
  });
});
