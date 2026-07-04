// 平衡模拟：纯 core 调用，驱动 reduce 跑完整一局，产出终局摘要。供 sim.test.js 回归。
import { reduce } from './day.js';
import { newGame, prepCap, dailyCustomerCount, ingredientPrice, uncleTitle, epitaph, grade } from './state.js';
import { CONST, DISHES } from './data.js';

const DISH_BY_ID = Object.fromEntries(DISHES.map(d => [d.id, d]));
// 合理策略的均衡菜单（荤素蛋搭配，4 种，集中需求少浪费）
const MENU = [
  { dish: 'stirVeg', ings: ['veg'] },
  { dish: 'braisedEgg', ings: ['egg', 'braise'] },
  { dish: 'friedWing', ings: ['chicken'] },
  { dish: 'sweetSourPork', ings: ['pork'] }
];

function dispatch(s, type, payload) { return reduce(s, { type, ...payload }); }

// 合理策略：按预估客流备约 1.5×n 份、4 种均摊，始终留出房租+缓冲现金
function reasonablePrep(s) {
  const expected = dailyCustomerCount(s);
  const target = Math.min(prepCap(s), Math.ceil(expected * 1.2)); // 贴近需求，少浪费
  const per = Math.max(1, Math.ceil(target / MENU.length));
  const buffer = CONST.RENT_PER_DAY;
  for (const m of MENU) {
    for (const ing of m.ings) {
      const price = ingredientPrice(s, ing);
      let qty = per;
      while (qty > 0 && s.money - qty * price < buffer) qty--;
      if (qty > 0) s = dispatch(s, 'BUY', { id: ing, qty });
    }
  }
  s = dispatch(s, 'FINISH_MORNING');
  for (const m of MENU) {
    const canMake = Math.min(...m.ings.map(ing => s.inventory[ing] || 0));
    const room = prepCap(s) - Object.values(s.cooked).reduce((a, b) => a + b, 0);
    const qty = Math.min(per, canMake, room);
    if (qty > 0) s = dispatch(s, 'COOK', { id: m.dish, qty });
  }
  return dispatch(s, 'OPEN_STALL');
}

function lazyPrep(s) {
  s = dispatch(s, 'BUY', { id: 'veg', qty: 4 });
  s = dispatch(s, 'FINISH_MORNING');
  s = dispatch(s, 'COOK', { id: 'stirVeg', qty: 4 });
  return dispatch(s, 'OPEN_STALL');
}

import { findSubstitute } from './customers.js';

// 缺菜时能否全部替代（用于 bot 决定 OFFER_SUB 还是 APOLOGIZE）
function canSubAll(s) {
  const cur = s.service.current;
  const missing = cur.dishes.filter(d => (s.cooked[d] || 0) <= 0);
  return missing.length > 0 && missing.every(m => findSubstitute(m, s.cooked) != null);
}

function runService(s, tier, useSub) {
  let guard = 0;
  while (s.phase === 'service' && guard++ < 300) {
    const step = s.service.step;
    if (step === 'meet') {
      if (s.service.canServe) s = dispatch(s, 'SERVE');
      else if (useSub && canSubAll(s)) s = dispatch(s, 'OFFER_SUB');
      else s = dispatch(s, 'APOLOGIZE');
    }
    else if (step === 'pricing') s = dispatch(s, 'QUOTE', { tier });
    else if (step === 'haggle') s = dispatch(s, 'HAGGLE', { accept: true });
    else if (step === 'result') s = dispatch(s, 'NEXT_CUSTOMER');
    else break;
  }
  return s;
}

// 只在现金非常充裕（≥ 起始现金）时才买一件冰箱——在这个偏紧的经济里过早投资升级会周转不灵。
// 代表"稳健经营、不冒进"的基线；真实玩家若能攒钱升级，是高于此基线的额外优势（不计入平衡下限）。
function reasonableShop(s) {
  if (!s.upgrades.includes('fridge') && s.money >= 55) {
    const s2 = dispatch(s, 'BUY_UPGRADE', { id: 'fridge' });
    if (s2 !== s) s = s2;
  }
  return dispatch(s, 'END_SHOP');
}

const BOTS = {
  reasonable: { prep: reasonablePrep, tier: 'normal', shop: reasonableShop, useSub: true },
  lazy: { prep: lazyPrep, tier: 'normal', shop: (s) => dispatch(s, 'END_SHOP'), useSub: false },
  slasher: { prep: reasonablePrep, tier: 'slash', shop: reasonableShop, useSub: true }
};

export function runGame(botName, seed, trace) {
  const bot = BOTS[botName];
  let s = dispatch(newGame(seed), 'START_DAY');
  let guard = 0;
  while (!['ending', 'gameover'].includes(s.phase) && guard++ < 100) {
    if (s.phase === 'morning') s = bot.prep(s);
    else if (s.phase === 'service') s = runService(s, bot.tier, bot.useSub);
    else if (s.phase === 'settle') {
      if (trace) trace({ day: s.day, money: s.money, rep: s.rep, ...s.today });
      s = dispatch(s, 'ACK_SETTLE');
    }
    else if (s.phase === 'shop') s = bot.shop(s);
    else if (s.phase === 'prep') s = dispatch(s, 'OPEN_STALL'); // 安全兜底
    else break;
  }
  if (trace && s.phase === 'gameover') trace({ day: s.day, money: s.money, rep: s.rep, ...s.today, dead: true });
  const survived = s.phase === 'ending';
  const score = s.money + s.rep * 5;
  return {
    survived,
    day: s.day,
    money: s.money,
    rep: s.rep,
    score,
    grade: grade(score),
    titleId: survived ? uncleTitle(s.stats, s.rep, s.money).id : null,
    epitaphId: survived ? null : epitaph(s.day, s.stats).id
  };
}

// 批量统计
export function runBatch(botName, seeds) {
  const results = [];
  for (let i = 0; i < seeds; i++) results.push(runGame(botName, i));
  const survived = results.filter(r => r.survived);
  return {
    n: seeds,
    survivalRate: survived.length / seeds,
    aGradeRateAmongSurvivors: survived.length
      ? survived.filter(r => ['S', 'A'].includes(r.grade)).length / survived.length : 0,
    avgRep: results.reduce((a, r) => a + r.rep, 0) / seeds,
    avgScoreSurvived: survived.length ? survived.reduce((a, r) => a + r.score, 0) / survived.length : 0
  };
}
