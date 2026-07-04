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
    closeLines: null,
    today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0, boughtToday: {} },
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

// 每日客数基准（C-2：day.js openStall 复用本函数叠加事件修饰，不再重复实现 rep/除数 公式）
export function dailyCustomerCount(state) {
  let n = CONST.BASE_CUSTOMERS + Math.floor(state.rep / CONST.CUSTOMER_FLOW_REP_DIVISOR);
  if (state.upgrades.includes('sign')) n += CONST.SIGN_CUSTOMER_BONUS;
  return n;
}

// §9.1 存活结局人设标签
export function uncleTitle(stats, rep, money) {
  const served = Math.max(1, stats.totalServed);
  const slashRate = stats.slashCount / served;
  const walkoutRate = stats.walkoutCount / served;
  // 打法风格驱动（P0-2）：身份 = 你怎么应对这七天，而非输赢。覆盖 100% 存活者。
  let id;
  if (slashRate >= CONST.SHARK_SLASH_RATE) id = 'shark';                  // 逢人就斩
  else if (walkoutRate >= CONST.AWKWARD_WALKOUT_RATE) id = 'awkward';     // 气走一堆客
  else if (slashRate <= CONST.KIND_SLASH_RATE_MAX && rep >= CONST.KIND_REP_MIN) id = 'kind'; // 几乎不斩且攒到口碑
  else if (served >= CONST.HUSTLER_SERVED_MIN) id = 'hustler';            // 满摊狂卖
  else if (served <= CONST.ZEN_SERVED_MAX) id = 'zen';                    // 佛系少卖
  else id = 'worldly';                                  // 精明世故
  return { id, ...LINES.titles[id] };
}

// §9.2 破产墓志铭：同样打法风格优先（P0-2），死法也是一种身份
export function epitaph(day, stats) {
  const served = Math.max(1, stats.totalServed);
  const slashRate = stats.slashCount / served;
  const walkoutRate = stats.walkoutCount / served;
  let id;
  if (slashRate >= CONST.EPITAPH_SHARK_SLASH_RATE) id = 'shark';        // 斩到没朋友
  else if (walkoutRate >= CONST.AWKWARD_WALKOUT_RATE) id = 'awkward';   // 客人全跑光
  else if (day <= CONST.EPITAPH_EARLY_DAY_MAX) id = 'early';            // 出师未捷
  else if (day >= CONST.EPITAPH_SOCLOSE_DAY_MIN) id = 'soClose';        // 一步之遥
  else id = 'honest';                           // 老实苦撑
  return { id, ...LINES.epitaphs[id] };
}

// §9 存活结局评分与评级（阈值经 sim.js 校准，见 docs/02-game-design §9/§11）
export function finalScore(state) {
  return state.money + state.rep * CONST.SCORE_REP_MUL;
}
// 阈值经声望经济重平衡后重新校准（survivor 分数分布 ~79–283、中位 ~157，见 docs/02 §9）
export function grade(score) {
  if (score >= CONST.GRADE_S) return 'S';
  if (score >= CONST.GRADE_A) return 'A';
  if (score >= CONST.GRADE_B) return 'B';
  return 'C';
}

// §9.3 当日手感评价三档
export function dailyVerdict(today) {
  const profit = today.revenue - today.spend;
  if (profit < 0 || today.repDelta < CONST.VERDICT_BAD_REPDELTA) return 'bad';
  if (profit > 0 && today.repDelta > 0) return 'good';
  return 'ok';
}
