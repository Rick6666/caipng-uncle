import { createRng } from './rng.js';
import { CONST, INGREDIENTS, DISHES, CUSTOMER_TYPES, REP_LEVELS, LINES } from './data.js';

// 单局初始状态，与 docs/03-architecture.md §3 schema 逐字段对齐。
export function newGame(seed) {
  const rng = createRng(seed >>> 0);
  return {
    seed: seed >>> 0,
    rng: rng.getState(),
    day: 1,
    phase: 'title',
    money: CONST.START_MONEY,
    rep: CONST.START_REP,
    inventory: {},
    cooked: {},
    carryOver: {},
    upgrades: [],
    loan: null,
    usedLoan: false,
    priceMul: 1,
    todayEvent: null,
    service: null,
    today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0 },
    stats: { totalServed: 0, totalRevenue: 0, bestDayRevenue: 0, slashCount: 0, walkoutCount: 0 }
  };
}

export function repLevel(rep) {
  let out = REP_LEVELS[0], index = 0;
  for (let i = 0; i < REP_LEVELS.length; i++) {
    if (rep >= REP_LEVELS[i].threshold) { out = REP_LEVELS[i]; index = i; }
  }
  return { threshold: out.threshold, title: out.title, index };
}

export function prepCap(state) {
  return CONST.BASE_PREP_CAP + (state.upgrades.includes('wok') ? CONST.WOK_BONUS : 0);
}

const ING_BY_ID = Object.fromEntries(INGREDIENTS.map(i => [i.id, i]));
export function ingredientPrice(state, id) {
  return Math.ceil(ING_BY_ID[id].price * (state.priceMul || 1));
}

// 一道菜的解锁声望 = 其配方里最高的食材解锁声望
export function dishUnlockRep(dish) {
  return Math.max(...dish.recipe.map(ing => ING_BY_ID[ing].unlockRep));
}

export function unlockedIngredients(rep) { return INGREDIENTS.filter(i => rep >= i.unlockRep); }
export function unlockedDishes(rep) { return DISHES.filter(d => rep >= dishUnlockRep(d)); }
export function unlockedCustomerTypes(rep) { return CUSTOMER_TYPES.filter(c => rep >= c.unlockRep); }

// 每日客数预览（营业开档时会用同一公式实算并存入队列长度）
export function dailyCustomerCount(state) {
  let n = CONST.BASE_CUSTOMERS + Math.floor(state.rep / 8);
  if (state.upgrades.includes('sign')) n += CONST.SIGN_CUSTOMER_BONUS;
  return n;
}

// §9.1 存活结局人设标签
export function uncleTitle(stats, rep, money) {
  const served = Math.max(1, stats.totalServed);
  const slashRate = stats.slashCount / served;
  const walkoutRate = stats.walkoutCount / served;
  // 门槛随声望经济重平衡校准（存活者 rep 多在 15~45）：良心=少斩客且真攒到声望；苦命=勉强糊口
  let id;
  if (slashRate >= 0.4) id = 'shark';
  else if (walkoutRate >= 0.2) id = 'awkward';
  else if (slashRate <= 0.05 && rep >= 30) id = 'kind';
  else if (money < 80 && rep < 15) id = 'broke';
  else id = 'worldly';
  return { id, ...LINES.titles[id] };
}

// §9.2 破产墓志铭
export function epitaph(day, stats) {
  const slashRate = stats.slashCount / Math.max(1, stats.totalServed);
  let id;
  if (day <= 2) id = 'early';
  else if (slashRate >= 0.3) id = 'karma';
  else if (day >= 6) id = 'soClose';
  else id = 'honest';
  return { id, ...LINES.epitaphs[id] };
}

// §9 存活结局评分与评级（阈值经 sim.js 校准，见 docs/02-game-design §9/§11）
export function finalScore(state) {
  return state.money + state.rep * 5;
}
// 阈值经声望经济重平衡后重新校准（survivor 分数分布 ~79–283、中位 ~157，见 docs/02 §9）
export function grade(score) {
  if (score >= 220) return 'S';
  if (score >= 150) return 'A';
  if (score >= 100) return 'B';
  return 'C';
}

// §9.3 当日手感评价三档
export function dailyVerdict(today) {
  const profit = today.revenue - today.spend;
  if (profit < 0 || today.repDelta < -3) return 'bad';
  if (profit > 0 && today.repDelta > 0) return 'good';
  return 'ok';
}
