import { describe, it, expect } from 'vitest';
import {
  newGame, repLevel, prepCap, ingredientPrice,
  unlockedIngredients, unlockedDishes, unlockedCustomerTypes,
  uncleTitle, epitaph, dailyVerdict
} from '../src/core/state.js';

describe('state', () => {
  it('newGame 初始值与 schema 一致', () => {
    const s = newGame(42);
    expect(s).toMatchObject({ seed: 42, day: 1, phase: 'title', money: 55, rep: 0, upgrades: [], loan: null, usedLoan: false, priceMul: 1 });
    expect(s.rng).toHaveProperty('s');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // 可序列化
  });
  it('repLevel 阈值', () => {
    expect(repLevel(0).title).toBe('路边小摊');
    expect(repLevel(14).title).toBe('路边小摊');
    expect(repLevel(15).title).toBe('巷口熟客');
    expect(repLevel(120).title).toBe('全城最强杂菜饭');
  });
  it('prepCap 无锅 16 有锅 24', () => {
    const s = newGame(1);
    expect(prepCap(s)).toBe(16);
    expect(prepCap({ ...s, upgrades: ['wok'] })).toBe(24);
  });
  it('ingredientPrice 受 priceMul 影响且向上取整', () => {
    const s = newGame(1);
    expect(ingredientPrice(s, 'chicken')).toBe(2);
    expect(ingredientPrice({ ...s, priceMul: 1.2 }, 'chicken')).toBe(3); // ceil(2.4)
  });
  it('解锁: rep 0 无 curry, rep 15 有', () => {
    expect(unlockedIngredients(0).some(i => i.id === 'curry')).toBe(false);
    expect(unlockedIngredients(15).some(i => i.id === 'curry')).toBe(true);
  });
  it('解锁菜品/顾客随声望', () => {
    expect(unlockedDishes(0).some(d => d.id === 'curryChicken')).toBe(false);
    expect(unlockedDishes(15).some(d => d.id === 'curryChicken')).toBe(true);
    expect(unlockedCustomerTypes(0).some(c => c.id === 'foodie')).toBe(false);
    expect(unlockedCustomerTypes(55).some(c => c.id === 'foodie')).toBe(true);
  });
  it('uncleTitle 人设标签优先级（02-game-design §9.1）', () => {
    const stats = (over) => ({ totalServed: 100, totalRevenue: 0, bestDayRevenue: 0, slashCount: 0, walkoutCount: 0, ...over });
    expect(uncleTitle(stats({ slashCount: 45 }), 50, 500).id).toBe('shark');
    expect(uncleTitle(stats({ walkoutCount: 25 }), 50, 500).id).toBe('awkward');
    expect(uncleTitle(stats({ slashCount: 2 }), 60, 500).id).toBe('kind');
    expect(uncleTitle(stats(), 20, 150).id).toBe('broke');
    expect(uncleTitle(stats({ slashCount: 10 }), 40, 400).id).toBe('worldly');
  });
  it('epitaph 墓志铭优先级（02-game-design §9.2）', () => {
    const stats = (over) => ({ totalServed: 100, totalRevenue: 0, bestDayRevenue: 0, slashCount: 0, walkoutCount: 0, ...over });
    expect(epitaph(2, stats()).id).toBe('early');
    expect(epitaph(4, stats({ slashCount: 35 })).id).toBe('karma');
    expect(epitaph(6, stats()).id).toBe('soClose');
    expect(epitaph(4, stats({ slashCount: 5 })).id).toBe('honest');
    expect(epitaph(1, stats({ slashCount: 50 })).id).toBe('early'); // day≤2 优先于 karma
  });
  it('dailyVerdict 三档（02-game-design §9.3）', () => {
    expect(dailyVerdict({ revenue: 50, spend: 20, repDelta: 1 })).toBe('good');
    expect(dailyVerdict({ revenue: 20, spend: 50, repDelta: 0 })).toBe('bad');
    expect(dailyVerdict({ revenue: 30, spend: 30, repDelta: -4 })).toBe('bad');
    expect(dailyVerdict({ revenue: 30, spend: 28, repDelta: 0 })).toBe('ok');
  });
});
