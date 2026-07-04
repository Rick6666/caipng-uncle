import { describe, it, expect } from 'vitest';
import { dishCost, orderBase, orderCost, quotePrices, settleDay } from '../src/core/economy.js';
import { newGame } from '../src/core/state.js';

const svc = () => ({ queue: [], index: 0, current: null, step: 'meet', canServe: false, offer: null, lastOutcome: null });

describe('economy pricing', () => {
  it('成本与基准价', () => {
    expect(dishCost('curryChicken')).toBe(4); // chicken3 + curry1
    expect(orderBase(['stirVeg', 'friedWing'])).toBe(10); // 1(米) + 3 + 6
    expect(orderCost(['stirVeg', 'friedWing'])).toBe(5);  // 1(米) + 1 + 3
  });
  it('三档报价（cost 含米）', () => {
    // base 10, cost 5 → kind=max(6,round(8)=8)=8, normal=10, slash=round(15)=15
    expect(quotePrices(['stirVeg', 'friedWing'])).toEqual({ kind: 8, normal: 10, slash: 15 });
    // base 4, cost 2 → kind=max(3,round(3.2)=3)=3, normal=4, slash=round(6)=6
    expect(quotePrices(['stirVeg'])).toEqual({ kind: 3, normal: 4, slash: 6 });
  });
});

describe('economy settlement (§8 七步)', () => {
  it('结算顺序: helper→剩菜作废→房租→利息→stats→破产判定', () => {
    let s = { ...newGame(1), phase: 'service', money: 20, cooked: { stirVeg: 5 }, loan: { repaid: 0 }, usedLoan: true, service: svc() };
    s = settleDay(s);
    expect(s.phase).toBe('gameover'); // 20-25(租)-10(息)=-15，已用过贷款
    expect(s.today.lost).toBe(5);     // 5 份剩菜无冰箱作废
  });
  it('首次破产触发阿财叔贷款续命', () => {
    let s = { ...newGame(1), phase: 'service', money: 10, cooked: {}, service: svc() };
    s = settleDay(s);
    expect(s.money).toBe(10 - 32 + 60); // 38：房租32、贷款额60
    expect(s.usedLoan).toBe(true);
    expect(s.loan).toEqual({ repaid: 0 });
    expect(s.phase).toBe('settle');
  });
  it('贷款利息累计到 LOAN_REPAY 自动结清', () => {
    let s = { ...newGame(1), phase: 'service', money: 200, cooked: {}, loan: { repaid: 80 }, usedLoan: true, service: svc() };
    s = settleDay(s);
    expect(s.loan).toBe(null); // 80+10=90 ≥ LOAN_REPAY 结清
  });
  it('冰箱保留 floor(60%)', () => {
    let s = { ...newGame(1), phase: 'service', money: 100, upgrades: ['fridge'], cooked: { stirVeg: 5, friedWing: 1 }, service: svc() };
    s = settleDay(s);
    expect(s.carryOver).toEqual({ stirVeg: 3 }); // 5*0.6=3；1*0.6=0 剔除
    expect(s.today.lost).toBe(3);                // 作废 2+1=3
  });
  it('helper 收档卖 2 份最贵剩菜、按正常价入账', () => {
    let s = { ...newGame(1), phase: 'service', money: 100, upgrades: ['helper'], cooked: { friedWing: 2, stirVeg: 3 }, service: svc() };
    s = settleDay(s);
    // 卖 2 份 friedWing（贵），每份 orderBase([friedWing])=1+6=7 → +14
    expect(s.today.revenue).toBe(14);
    expect(s.today.served).toBe(2);
    expect(s.stats.totalRevenue).toBe(14);
    // 卖后剩 stirVeg:3 无冰箱作废
    expect(s.today.lost).toBe(3);
  });
  it('stats 在破产判定前累计（墓志铭需要完整数据）', () => {
    let s = { ...newGame(1), phase: 'service', money: 5, cooked: {}, usedLoan: true,
      today: { revenue: 40, spend: 0, served: 3, lost: 0, repDelta: 0 }, service: svc() };
    s = settleDay(s);
    expect(s.phase).toBe('gameover');       // 5-25=-20，已用过贷款
    expect(s.stats.totalServed).toBe(3);     // 破产也累计了当天
    expect(s.stats.totalRevenue).toBe(40);
    expect(s.stats.bestDayRevenue).toBe(40);
  });
});
