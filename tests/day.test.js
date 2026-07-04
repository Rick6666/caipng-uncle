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
    s = d(s, 'BUY', { id: 'cabbage', qty: 4 });
    s = d(s, 'BUY', { id: 'pork', qty: 4 });
    expect(s.money).toBe(before - 4 - 8); // cabbage $1×4, pork $2×4
    s = d(s, 'FINISH_MORNING');
    expect(s.phase).toBe('prep');
    s = d(s, 'COOK', { id: 'friedCabbage', qty: 4 });
    s = d(s, 'COOK', { id: 'sweetSourPork', qty: 4 });
    expect(s.inventory.cabbage).toBe(0);
    expect(s.cooked.sweetSourPork).toBe(4);
    s = d(s, 'OPEN_STALL');
    expect(s.phase).toBe('service');
    expect(s.service.queue.length).toBeGreaterThanOrEqual(3);
    let guard = 0;
    while (s.phase === 'service' && guard++ < 200) {
      const step = s.service.step;
      if (step === 'request') s = d(s, 'RESOLVE_REQUEST', { accept: true });
      else if (step === 'meet') s = d(s, s.service.canServe ? 'SERVE' : 'APOLOGIZE');
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
    expect(d(s, 'BUY', { id: 'shishamo', qty: 1 })).toBe(s); // 未解锁（rep 55）
    expect(d(s, 'BUY', { id: 'chicken', qty: 999 })).toBe(s); // 钱不够
  });

  // —— 缺货服务态构造器 —— //
  const svcState = (over = {}) => ({
    ...newGame(1), phase: 'service',
    today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0 },
    service: {
      queue: [{ type: 'worker', name: 'a', dishes: ['friedCabbage'], greeting: '' },
              { type: 'worker', name: 'b', dishes: ['friedCabbage'], greeting: '' }],
      index: 0, step: 'meet', offer: null, lastOutcome: null,
      current: { type: 'worker', name: 'a', dishes: ['friedCabbage'], greeting: '' },
      canServe: false
    }, ...over
  });

  it('CR-04 缺货 SERVE 返回原 state 引用（reducer 自守，不打负库存）', () => {
    const s = svcState({ cooked: { friedCabbage: 0 } });
    expect(d(s, 'SERVE')).toBe(s);
  });

  it('B-2 OFFER_SUB 在货全在时（canServe=true）返回原 state，不误判缺菜（reducer 自守）', () => {
    const s = svcState({
      cooked: { friedCabbage: 9 },
      service: {
        queue: [{ type: 'worker', name: 'a', dishes: ['friedCabbage'], greeting: '' }],
        index: 0, step: 'meet', offer: null, lastOutcome: null,
        current: { type: 'worker', name: 'a', dishes: ['friedCabbage'], greeting: '' },
        canServe: true
      }
    });
    expect(d(s, 'OFFER_SUB')).toBe(s);
  });

  it('B-3 QUOTE 携带非法 tier 返回原 state（不抛异常）', () => {
    const s = svcState({
      cooked: { friedCabbage: 9 },
      service: {
        queue: [{ type: 'worker', name: 'a', dishes: ['friedCabbage'], greeting: '' }],
        index: 0, step: 'pricing', offer: null, lastOutcome: null,
        current: { type: 'worker', name: 'a', dishes: ['friedCabbage'], greeting: '' },
        canServe: true
      }
    });
    expect(d(s, 'QUOTE', { tier: 'bogus' })).toBe(s);
    expect(() => d(s, 'QUOTE', { tier: 'bogus' })).not.toThrow();
  });

  it('CR-03 两道同类缺菜只剩一份替代货 → OFFER_SUB 无法满足，返回原 state', () => {
    const s = svcState({
      cooked: { curryChicken: 1 }, // meat 只有 1 份
      service: {
        queue: [{ type: 'labourer', name: 'a', dishes: ['sweetSourPork', 'braisedBelly'], greeting: '' }],
        index: 0, step: 'meet', offer: null, lastOutcome: null,
        current: { type: 'labourer', name: 'a', dishes: ['sweetSourPork', 'braisedBelly'], greeting: '' },
        canServe: false
      }
    });
    expect(d(s, 'OFFER_SUB')).toBe(s); // 无法双扣，宁可拒绝
  });

  it('CR-06 START_DAY 在 shop 阶段非法（仅 title 可开新的一天，防无限刷当天）', () => {
    const s = { ...newGame(1), phase: 'shop', day: 3 };
    expect(d(s, 'START_DAY')).toBe(s);
  });

  it('CR-19 特殊需求：应对施加 rep/money 并转回见面；非 request 阶段调用返回原 state', () => {
    const cust = { type: 'labourer', name: 'x', dishes: ['friedCabbage'], greeting: '', request: 'labourer' };
    const s = { ...newGame(1), phase: 'service', money: 50,
      today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0 },
      service: { queue: [cust], index: 0, step: 'request', current: cust, canServe: true, offer: null, lastOutcome: null, requestNotice: null } };
    const yes = d(s, 'RESOLVE_REQUEST', { accept: true });   // labourer 加料 rep+2 money-2
    expect(yes.rep).toBe(2);
    expect(yes.money).toBe(48);
    expect(yes.service.step).toBe('meet');
    expect(yes.service.current.request).toBe(null);          // 需求已处理，不会重复触发
    expect(yes.service.requestNotice).toBeTruthy();
    expect(d(yes, 'RESOLVE_REQUEST', { accept: true })).toBe(yes); // 已在 meet，非法 → 原 state 引用
  });

  it('CR-17 空备菜也能开档并走完当天（没料可炒不软锁，最终进结算/破产）', () => {
    // 破产边缘：$0、无库存、无熟菜 → 开档 → 全部道歉 → 收档 → 结算/破产，绝不卡死
    let s = { ...newGame(3), phase: 'prep', money: 0, inventory: {}, cooked: {} };
    s = d(s, 'OPEN_STALL');
    expect(s.phase).toBe('service');
    let guard = 0;
    while (s.phase === 'service' && guard++ < 200) {
      const step = s.service.step;
      if (step === 'request') s = d(s, 'RESOLVE_REQUEST', { accept: true });
      else if (step === 'meet') s = d(s, s.service.canServe ? 'SERVE' : 'APOLOGIZE');
      else if (step === 'pricing') s = d(s, 'QUOTE', { tier: 'normal' });
      else if (step === 'haggle') s = d(s, 'HAGGLE', { accept: true });
      else if (step === 'result') s = d(s, 'NEXT_CUSTOMER');
      else break;
    }
    expect(['settle', 'gameover']).toContain(s.phase); // 顺利落地，无软锁
  });

  it('CR-12 rep 已在 0 时道歉，台账声望变化不显示虚假 -1', () => {
    const s = svcState({ rep: 0, cooked: { friedCabbage: 0 } });
    const out = d(s, 'APOLOGIZE');
    expect(out.rep).toBe(0);
    expect(out.today.repDelta).toBe(0); // 实际没跌，不记 -1
  });

  it('A-1 BUY 负 qty 不能退超过当日购买量，即便库存里还有余量（防退货套利）', () => {
    // inventory 里 10 份 cabbage：6 份是跨天结转的，今天只买了 4 份
    let s = { ...newGame(1), phase: 'morning', inventory: { cabbage: 10 },
      today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0, boughtToday: { cabbage: 4 } } };
    expect(d(s, 'BUY', { id: 'cabbage', qty: -5 })).toBe(s); // 只买了 4，退 5 非法
    const ok = d(s, 'BUY', { id: 'cabbage', qty: -4 });      // 退光当日买的，合法
    expect(ok.inventory.cabbage).toBe(6);
  });

  it('A-1 BUY 不能退跨天结转的库存（当日购买台账每天清零）', () => {
    // 模拟次日 morning：库存是昨天结转的，但今天还没买过
    let s = { ...newGame(1), phase: 'morning', inventory: { cabbage: 10 },
      today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0, boughtToday: {} } };
    expect(d(s, 'BUY', { id: 'cabbage', qty: -1 })).toBe(s);
  });

  it('A-1 marketUp 日无法靠「昨天买今天退」吃跨天差价', () => {
    // 昨天(平价 $1)买 10 份留到今天，今天涨价(×1.2→$2)，今天没再买过 → 今天不能退昨天的库存
    let s = { ...newGame(1), phase: 'morning', priceMul: 1.2, inventory: { cabbage: 10 },
      today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0, boughtToday: {} } };
    expect(d(s, 'BUY', { id: 'cabbage', qty: -10 })).toBe(s);
  });

  it('A-1 当日买当日退（同价）净花费为 0，不构成套利', () => {
    let s = d(newGame(1), 'START_DAY');
    const before = s.money;
    s = d(s, 'BUY', { id: 'cabbage', qty: 10 });
    s = d(s, 'BUY', { id: 'cabbage', qty: -10 });
    expect(s.money).toBe(before);
  });

  it('B-4 BUY/COOK 非整数 qty（NaN/小数/非数字）返回原 state，不污染 money/inventory', () => {
    let s = d(newGame(1), 'START_DAY');
    expect(d(s, 'BUY', { id: 'cabbage', qty: NaN })).toBe(s);
    expect(d(s, 'BUY', { id: 'cabbage', qty: 1.5 })).toBe(s);
    expect(d(s, 'BUY', { id: 'cabbage', qty: undefined })).toBe(s);
    expect(d(s, 'BUY', { id: 'cabbage', qty: 'x' })).toBe(s);
    s = d(s, 'BUY', { id: 'cabbage', qty: 4 });
    s = d(s, 'FINISH_MORNING');
    expect(d(s, 'COOK', { id: 'friedCabbage', qty: NaN })).toBe(s);
  });

  it('COOK 超容量拒绝；wok 提升到 24', () => {
    let s = d(newGame(1), 'START_DAY');
    s = d(s, 'BUY', { id: 'cabbage', qty: 20 });
    s = d(s, 'FINISH_MORNING');
    const over = d(s, 'COOK', { id: 'friedCabbage', qty: 17 }); // >16
    expect(over).toBe(s);
    let s2 = { ...s, upgrades: ['wok'] };
    const ok = d(s2, 'COOK', { id: 'friedCabbage', qty: 20 });   // ≤24
    expect(ok.cooked.friedCabbage).toBe(20);
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
    let s = { ...newGame(1), day: 3, phase: 'shop', carryOver: { friedCabbage: 2 } };
    s = d(s, 'END_SHOP');
    expect(s.day).toBe(4);
    expect(s.phase).toBe('morning');
    expect(s.cooked.friedCabbage).toBe(2); // carryOver 并入
    expect(s.carryOver).toEqual({});
  });

  it('B-8 次日 morning 清除昨日收档事件文案（closeLines 不应残留到下一天）', () => {
    let s = { ...newGame(1), day: 3, phase: 'shop', closeLines: ['🐱 一只野猫窜上摊子...'] };
    s = d(s, 'END_SHOP');
    expect(s.closeLines).toBe(null);
  });

  it('BUY_UPGRADE 扣钱且不重复购买', () => {
    let s = { ...newGame(1), phase: 'shop', money: 30 };
    s = d(s, 'BUY_UPGRADE', { id: 'fridge' }); // 24
    expect(s.money).toBe(6);
    expect(s.upgrades).toContain('fridge');
    expect(d(s, 'BUY_UPGRADE', { id: 'wok' })).toBe(s);     // 34 钱不够（剩 6）
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
