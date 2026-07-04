import { describe, it, expect } from 'vitest';
import { dishCost, orderBase, orderCost, quotePrices, settleDay } from '../src/core/economy.js';
import { newGame } from '../src/core/state.js';

const svc = () => ({ queue: [], index: 0, current: null, step: 'meet', canServe: false, offer: null, lastOutcome: null });

describe('economy pricing', () => {
  it('成本与基准价', () => {
    expect(dishCost('curryChicken')).toBe(3); // chicken2 + curry1
    expect(orderBase(['friedCabbage', 'sweetSourPork'])).toBe(7); // 1(米) + 2 + 4
    expect(orderCost(['friedCabbage', 'sweetSourPork'])).toBe(4); // 1(米) + 1 + 2
  });
  it('三档报价（cost 含米）', () => {
    // base 7, cost 4 → kind=max(5,round(5.6)=6)=6, normal=7, slash=round(10.5)=11
    expect(quotePrices(['friedCabbage', 'sweetSourPork'])).toEqual({ kind: 6, normal: 7, slash: 11 });
    // base 3, cost 2 → kind=max(3,round(2.4)=2)=3, normal=3, slash=round(4.5)=5
    expect(quotePrices(['friedCabbage'])).toEqual({ kind: 3, normal: 3, slash: 5 });
  });
});

describe('economy settlement (§8 七步)', () => {
  it('结算顺序: helper→剩菜作废→房租→利息→stats→破产判定', () => {
    // day 1 房租=10；money 5 - 10(租) - 10(息) = -15，已用过贷款 → gameover
    let s = { ...newGame(1), day: 1, phase: 'service', money: 5, cooked: { friedCabbage: 5 }, loan: { repaid: 0 }, usedLoan: true, service: svc() };
    s = settleDay(s);
    expect(s.phase).toBe('gameover');
    expect(s.today.lost).toBe(5);     // 5 份剩菜无冰箱作废
  });
  it('首次破产触发阿财叔贷款续命', () => {
    let s = { ...newGame(1), day: 1, phase: 'service', money: 5, cooked: {}, service: svc() };
    s = settleDay(s);
    expect(s.money).toBe(5 - 9 + 30); // 26：day1 房租9、贷款额30
    expect(s.usedLoan).toBe(true);
    expect(s.loan).toEqual({ repaid: 0 });
    expect(s.phase).toBe('settle');
  });
  it('贷款利息累计到 LOAN_REPAY 自动结清', () => {
    let s = { ...newGame(1), day: 1, phase: 'service', money: 200, cooked: {}, loan: { repaid: 30 }, usedLoan: true, service: svc() };
    s = settleDay(s);
    expect(s.loan).toBe(null); // 30+10=40 ≥ LOAN_REPAY(40) 结清
  });
  it('CR-05 首贷 $30 仍兜不住 → 直接 gameover，不白送一天', () => {
    // money -100，day1 房租 9，+贷款 30 = -79 仍 <0 → 立即倒闭
    let s = { ...newGame(1), day: 1, phase: 'service', money: -100, cooked: {}, service: svc() };
    s = settleDay(s);
    expect(s.phase).toBe('gameover');
    expect(s.usedLoan).toBe(true);
  });
  it('CR-05/11 首贷能兜住 → 续命 settle 且打上 loanTaken 标记', () => {
    let s = { ...newGame(1), day: 1, phase: 'service', money: -5, cooked: {}, service: svc() };
    s = settleDay(s);
    expect(s.money).toBe(-5 - 9 + 30); // 16
    expect(s.phase).toBe('settle');
    expect(s.loanTaken).toBe(true);
  });
  it('冰箱保留 floor(60%)', () => {
    let s = { ...newGame(1), phase: 'service', money: 100, upgrades: ['fridge'], cooked: { friedCabbage: 5, sweetSourPork: 1 }, service: svc() };
    s = settleDay(s);
    expect(s.carryOver).toEqual({ friedCabbage: 3 }); // 5*0.6=3；1*0.6=0 剔除
    expect(s.today.lost).toBe(3);                // 作废 2+1=3
  });
  it('helper 收档卖 2 份最贵剩菜、按正常价入账', () => {
    let s = { ...newGame(1), phase: 'service', money: 100, upgrades: ['helper'], cooked: { sweetSourPork: 2, friedCabbage: 3 }, service: svc() };
    s = settleDay(s);
    // 卖 2 份 sweetSourPork（贵），每份 orderBase([sweetSourPork])=1+4=5 → +10
    expect(s.today.revenue).toBe(10);
    expect(s.today.served).toBe(2);
    expect(s.stats.totalRevenue).toBe(10);
    // 卖后剩 friedCabbage:3 无冰箱作废
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
