import { describe, it, expect } from 'vitest';
import { reduce } from '../src/core/day.js';
import { newGame } from '../src/core/state.js';

const d = (s, type, payload) => reduce(s, { type, ...payload });

describe('day state machine', () => {
  it('完整一天快乐路径', () => {
    let s = newGame(42);
    s = d(s, 'START_DAY');
    expect(s.phase).toBe('morning');
    const before = s.money;
    s = d(s, 'BUY', { id: 'veg', qty: 4 });
    s = d(s, 'BUY', { id: 'chicken', qty: 4 });
    expect(s.money).toBe(before - 4 - 12);
    s = d(s, 'FINISH_MORNING');
    expect(s.phase).toBe('prep');
    s = d(s, 'COOK', { id: 'stirVeg', qty: 4 });
    s = d(s, 'COOK', { id: 'friedWing', qty: 4 });
    expect(s.inventory.veg).toBe(0);
    expect(s.cooked.friedWing).toBe(4);
    s = d(s, 'OPEN_STALL');
    expect(s.phase).toBe('service');
    expect(s.service.queue.length).toBeGreaterThanOrEqual(3);
    let guard = 0;
    while (s.phase === 'service' && guard++ < 200) {
      const step = s.service.step;
      if (step === 'meet') s = d(s, s.service.canServe ? 'SERVE' : 'APOLOGIZE');
      else if (step === 'pricing') s = d(s, 'QUOTE', { tier: 'normal' });
      else if (step === 'haggle') s = d(s, 'HAGGLE', { accept: true });
      else if (step === 'result') s = d(s, 'NEXT_CUSTOMER');
      else break;
    }
    expect(['settle', 'gameover']).toContain(s.phase);
  });

  it('非法动作返回原 state 引用', () => {
    let s = d(newGame(1), 'START_DAY');
    expect(d(s, 'QUOTE', { tier: 'kind' })).toBe(s);         // 阶段不符
    expect(d(s, 'BUY', { id: 'prawn', qty: 1 })).toBe(s);    // 未解锁
    expect(d(s, 'BUY', { id: 'chicken', qty: 999 })).toBe(s); // 钱不够
  });

  it('COOK 超容量拒绝；wok 提升到 24', () => {
    let s = d(newGame(1), 'START_DAY');
    s = d(s, 'BUY', { id: 'veg', qty: 20 });
    s = d(s, 'FINISH_MORNING');
    const over = d(s, 'COOK', { id: 'stirVeg', qty: 17 }); // >16
    expect(over).toBe(s);
    let s2 = { ...s, upgrades: ['wok'] };
    const ok = d(s2, 'COOK', { id: 'stirVeg', qty: 20 });   // ≤24
    expect(ok.cooked.stirVeg).toBe(20);
  });

  it('第 7 天结算后进 ending，不再逛商店', () => {
    let s = { ...newGame(1), day: 7, phase: 'settle', money: 300, rep: 40 };
    s = d(s, 'ACK_SETTLE');
    expect(s.phase).toBe('ending');
  });
  it('day < 7 时 ACK_SETTLE 进 shop（rep 高也不提前结束）', () => {
    let s = { ...newGame(1), day: 3, phase: 'settle', rep: 130 };
    s = d(s, 'ACK_SETTLE');
    expect(s.phase).toBe('shop');
  });
  it('END_SHOP 进入次日 morning', () => {
    let s = { ...newGame(1), day: 3, phase: 'shop', carryOver: { stirVeg: 2 } };
    s = d(s, 'END_SHOP');
    expect(s.day).toBe(4);
    expect(s.phase).toBe('morning');
    expect(s.cooked.stirVeg).toBe(2); // carryOver 并入
    expect(s.carryOver).toEqual({});
  });

  it('BUY_UPGRADE 扣钱且不重复购买', () => {
    let s = { ...newGame(1), phase: 'shop', money: 100 };
    s = d(s, 'BUY_UPGRADE', { id: 'fridge' }); // 80
    expect(s.money).toBe(20);
    expect(s.upgrades).toContain('fridge');
    expect(d(s, 'BUY_UPGRADE', { id: 'wok' })).toBe(s);     // 钱不够
    expect(d(s, 'BUY_UPGRADE', { id: 'fridge' })).toBe(s);  // 已拥有
  });

  it('marketUp 当日食材价 ×1.2、次日复位', () => {
    // 强制 START_DAY 命中 marketUp：扫描 seed
    let found = null;
    for (let seed = 0; seed < 500; seed++) {
      const s = d(newGame(seed), 'START_DAY');
      if (s.todayEvent === 'marketUp') { found = s; break; }
    }
    expect(found).not.toBe(null);
    expect(found.priceMul).toBe(1.2);
    // 次日复位（END_SHOP 后新的一天，除非又抽中 marketUp）
    let next = d({ ...found, phase: 'shop', day: found.day }, 'END_SHOP');
    if (next.todayEvent !== 'marketUp') expect(next.priceMul).toBe(1);
  });

  it('rng 状态在动作后写回，序列化可存活', () => {
    let s = d(newGame(7), 'START_DAY');
    expect(s.rng).toHaveProperty('s');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
