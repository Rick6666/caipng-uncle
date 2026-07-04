import { describe, it, expect } from 'vitest';
import { generateQueue, resolveQuote, resolveHaggle, findSubstitute } from '../src/core/customers.js';
import { createRng } from '../src/core/rng.js';
import { LINES } from '../src/core/data.js';

const ctx = (over = {}) => ({ rep: 0, cooked: { friedCabbage: 9, sweetSourPork: 9 }, todayEvent: null, upgrades: [], ...over });

describe('customers', () => {
  it('点单只点已备菜品，有荤时每单至少一道荤', () => {
    const rng = createRng(5);
    const q = generateQueue(ctx(), 12, rng);
    for (const c of q) {
      expect(c.dishes.length).toBeGreaterThan(0);
      for (const d of c.dishes) expect(['friedCabbage', 'sweetSourPork']).toContain(d);
      expect(c.dishes).toContain('sweetSourPork'); // 唯一荤菜必点
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
    const richCooked = { friedCabbage: 5, longBean: 5, kangkong: 5, radishOmelette: 5, furongEgg: 5, sweetSourPork: 5 };
    const q = generateQueue(ctx({ rep: 55, cooked: richCooked }), 80, rng);
    // 至少可能出现（不强制），但种类不足时绝不出现
    const rng2 = createRng(2);
    const qPoor = generateQueue(ctx({ rep: 55, cooked: { friedCabbage: 5, sweetSourPork: 5 } }), 80, rng2);
    expect(qPoor.some(c => c.type === 'foodie')).toBe(false);
  });
  it('influencer + kind → rep +6 必付款', () => {
    const out = resolveQuote({ type: 'influencer', name: 'x', dishes: ['friedCabbage'] }, 'kind', createRng(1));
    expect(out.paid).toBe(true);
    expect(out.repDelta).toBe(6);
    expect(out.line).toBeTruthy();
  });
  it('ahma + slash → 进入砍价', () => {
    const out = resolveQuote({ type: 'ahma', name: 'x', dishes: ['friedCabbage'] }, 'slash', createRng(1));
    expect(out.haggle).toBe(true);
  });
  it('B-7 normal 档走人时台词不能是「付钱」台词（文案与行为需一致）', () => {
    const walkRng = { chance: () => false, pick: (a) => a[0] };
    const out = resolveQuote({ type: 'student', name: 'x', dishes: ['friedCabbage'] }, 'normal', walkRng);
    expect(out.paid).toBe(false);
    // normal 档台词库全是"付钱"口吻，走人时应改用 slash 档的负面台词库，而非误用 normal 台词
    expect(LINES.reactions.student.normal).not.toContain(out.line);
    expect(LINES.reactions.student.slash).toContain(out.line);
  });

  it('student + slash 两分支 rep 分别 -3 / -2', () => {
    // 打桩 rng.chance：真=付款 / 假=走人
    const paidRng = { chance: () => true, pick: (a) => a[0] };
    const walkRng = { chance: () => false, pick: (a) => a[0] };
    const cust = { type: 'student', name: 'x', dishes: ['friedCabbage'] };
    expect(resolveQuote(cust, 'slash', paidRng)).toMatchObject({ paid: true, repDelta: -3 });
    expect(resolveQuote(cust, 'slash', walkRng)).toMatchObject({ paid: false, walkout: true, repDelta: -2 });
  });
  it('ahma 砍价：接受收正常价 rep+1；赌一把两分支', () => {
    const cust = { type: 'ahma', name: 'x', dishes: ['friedCabbage'] };
    const accept = resolveHaggle(cust, true, createRng(1));
    expect(accept).toMatchObject({ paid: true, repDelta: 1 }); // 给阿嬷公道价 +1（与 normal 档一致）
    const gambleWalk = resolveHaggle(cust, false, { chance: () => false, pick: (a) => a[0] });
    expect(gambleWalk).toMatchObject({ paid: false, repDelta: -3 });
  });
  it('替代菜同类优先，无同类返回 null', () => {
    expect(findSubstitute('sweetSourPork', { braisedBelly: 2 })).toBe('braisedBelly'); // 同 meat
    expect(findSubstitute('sweetSourPork', { friedCabbage: 2 })).toBe(null);              // veg 非同类
    expect(findSubstitute('sweetSourPork', { sweetSourPork: 0, braisedBelly: 0 })).toBe(null); // 无货
  });
  it('CR-03 claimed 记账：一份替代货不被同单两道缺菜重复占用', () => {
    // 只剩 1 份 curryChicken(meat)，第一道缺菜占用后，第二道再找就没了
    expect(findSubstitute('sweetSourPork', { curryChicken: 1 })).toBe('curryChicken');
    expect(findSubstitute('braisedBelly', { curryChicken: 1 }, { curryChicken: 1 })).toBe(null);
    // 有 2 份则两道都能配
    expect(findSubstitute('braisedBelly', { curryChicken: 2 }, { curryChicken: 1 })).toBe('curryChicken');
  });
});
