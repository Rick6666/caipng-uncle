import { CONST, DISHES, UPGRADES, REQUESTS } from './data.js';
import { createRng } from './rng.js';
import { newGame, prepCap, ingredientPrice, unlockedIngredients } from './state.js';
import { generateQueue, resolveQuote, resolveHaggle, findSubstitute } from './customers.js';
import { settleDay } from './economy.js';
import { rollOpenEvent, rollCloseEvents } from './events.js';

const DISH_BY_ID = Object.fromEntries(DISHES.map(d => [d.id, d]));
const ING_BY_ID = Object.fromEntries(unlockedIngredients(9999).map(i => [i.id, i]));
const SUB_ACCEPT = 0.6;

// 唯一的 state 变更入口。非法动作原样返回传入的 state 引用。
export function reduce(state, action) {
  switch (action.type) {
    case 'NEW_GAME':      return newGame(action.seed != null ? action.seed : state.seed + 1);
    case 'START_DAY':     return guard(state, ['title'], () => enterMorning(state));
    case 'BUY':           return guard(state, ['morning'], () => doBuy(state, action));
    case 'FINISH_MORNING':return guard(state, ['morning'], () => ({ ...state, phase: 'prep' }));
    case 'COOK':          return guard(state, ['prep'], () => doCook(state, action));
    case 'OPEN_STALL':    return guard(state, ['prep'], () => openStall(state));
    case 'RESOLVE_REQUEST':return serviceStep(state, 'request', () => doResolveRequest(state, action));
    case 'SERVE':         return serviceStep(state, 'meet', () => doServe(state));
    case 'OFFER_SUB':     return serviceStep(state, 'meet', () => doOfferSub(state));
    case 'APOLOGIZE':     return serviceStep(state, 'meet', () => doApologize(state));
    case 'QUOTE':         return serviceStep(state, 'pricing', () => doQuote(state, action));
    case 'HAGGLE':        return serviceStep(state, 'haggle', () => doHaggle(state, action));
    case 'NEXT_CUSTOMER': return serviceStep(state, 'result', () => nextCustomer(state));
    case 'ACK_SETTLE':    return guard(state, ['settle'], () => ackSettle(state));
    case 'BUY_UPGRADE':   return guard(state, ['shop'], () => doUpgrade(state, action));
    case 'END_SHOP':      return guard(state, ['shop'], () => enterMorning({ ...state, day: state.day + 1 }));
    default:              return state;
  }
}

function guard(state, phases, fn) {
  return phases.includes(state.phase) ? fn() : state;
}
function serviceStep(state, step, fn) {
  return state.phase === 'service' && state.service && state.service.step === step ? fn() : state;
}

// 进入清晨：并入 carryOver、重置 today、抽开档事件并施加即时效果
function enterMorning(state) {
  const rng = createRng(state.rng);
  const s = {
    ...state,
    phase: 'morning',
    cooked: { ...state.carryOver },
    carryOver: {},
    inventory: { ...state.inventory },
    upgrades: [...state.upgrades],
    priceMul: 1,
    loanTaken: false,
    closeLines: null, // B-8：每天清除昨日收档事件文案，不带到次日
    today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0, boughtToday: {} },
    stats: { ...state.stats }
  };
  const ev = rollOpenEvent(s, rng);
  s.todayEvent = ev;
  if (ev === 'marketUp') s.priceMul = CONST.MARKETUP_PRICE_MUL;
  if (ev === 'tv') { s.rep += 10; s.today.repDelta += 10; }
  if (s.upgrades.includes('speaker')) { s.rep += 1; s.today.repDelta += 1; }
  s.rng = rng.getState();
  return s;
}

function doBuy(state, { id, qty }) {
  if (!Number.isInteger(qty)) return state;   // B-4：非整数/NaN 一律非法
  const ing = ING_BY_ID[id];
  if (!ing || state.rep < ing.unlockRep) return state;
  const price = ingredientPrice(state, id);
  const cost = qty * price;
  const nextQty = (state.inventory[id] || 0) + qty;
  if (nextQty < 0) return state;              // 不能退到负库存
  if (qty > 0 && state.money < cost) return state; // 钱不够
  const boughtToday = { ...state.today.boughtToday };
  if (qty < 0 && -qty > (boughtToday[id] || 0)) return state; // A-1：不可退超过当日购买量
  boughtToday[id] = (boughtToday[id] || 0) + qty;
  const inventory = { ...state.inventory, [id]: nextQty };
  return {
    ...state,
    money: state.money - cost,
    inventory,
    today: { ...state.today, spend: state.today.spend + cost, boughtToday }
  };
}

function doCook(state, { id, qty }) {
  if (!Number.isInteger(qty)) return state;   // B-4：非整数/NaN 一律非法
  const dish = DISH_BY_ID[id];
  if (!dish) return state;
  const totalCooked = Object.values(state.cooked).reduce((a, b) => a + b, 0);
  if (totalCooked + qty > prepCap(state)) return state; // 超备菜上限
  const nextDishQty = (state.cooked[id] || 0) + qty;
  if (nextDishQty < 0) return state;
  const inventory = { ...state.inventory };
  for (const ing of dish.recipe) {
    const nv = (inventory[ing] || 0) - qty; // qty<0 退料 → 加回
    if (nv < 0) return state;               // 食材不够
    inventory[ing] = nv;
  }
  return { ...state, inventory, cooked: { ...state.cooked, [id]: nextDishQty } };
}

function openStall(state) {
  const rng = createRng(state.rng);
  // 客数公式（§4.4）
  let n = CONST.BASE_CUSTOMERS + Math.floor(state.rep / 8);
  if (state.upgrades.includes('sign')) n += CONST.SIGN_CUSTOMER_BONUS;
  n += rng.int(-1, 2);
  if (state.todayEvent === 'rain' && !state.upgrades.includes('awning')) n = Math.floor(n * CONST.RAIN_CUSTOMER_MUL);
  if (state.todayEvent === 'rival') n -= 2;
  const cap = CONST.MAX_CUSTOMERS + (state.upgrades.includes('helper') ? CONST.HELPER_CUSTOMER_BONUS : 0);
  n = Math.max(3, Math.min(cap, n));
  const queue = generateQueue(
    { rep: state.rep, cooked: state.cooked, todayEvent: state.todayEvent, upgrades: state.upgrades },
    n, rng
  );
  const service = {
    queue, index: 0, current: queue[0] || null,
    step: queue[0] && queue[0].request ? 'request' : 'meet',
    canServe: queue[0] ? canServe(state.cooked, queue[0].dishes) : false,
    offer: null, lastOutcome: null, requestNotice: null
  };
  return { ...state, phase: 'service', service, rng: rng.getState() };
}

function canServe(cooked, dishes) {
  return dishes.length > 0 && dishes.every(d => (cooked[d] || 0) > 0);
}

// CR-19：应对特殊需求。施加 rep/money 效果后转回正常见面（保留应对台词供 meet 展示）
function doResolveRequest(state, { accept }) {
  const cur = state.service.current;
  const rq = REQUESTS[cur.request];
  if (!rq) return state;
  const eff = accept ? rq.accept : rq.decline;
  let s = applyRep(state, eff.rep);
  if (eff.money) {
    s = { ...s, money: s.money + eff.money,
      today: { ...s.today, spend: s.today.spend + (eff.money < 0 ? -eff.money : 0) } };
  }
  return {
    ...s,
    service: {
      ...s.service, step: 'meet', requestNotice: eff.line,
      current: { ...cur, request: null }
    }
  };
}

// 出餐：扣 cooked，进入报价
function doServe(state) {
  const cur = state.service.current;
  if (!canServe(state.cooked, cur.dishes)) return state; // CR-04：缺货不得出餐，reducer 自守
  const cooked = { ...state.cooked };
  for (const d of cur.dishes) cooked[d] = (cooked[d] || 0) - 1;
  return { ...state, cooked, service: { ...state.service, step: 'pricing' } };
}

// 缺菜推荐替代
function doOfferSub(state) {
  if (state.service.canServe) return state; // B-2：货全在时无缺菜可替代，reducer 自守
  const rng = createRng(state.rng);
  const cur = state.service.current;
  const missing = cur.dishes.filter(d => (state.cooked[d] || 0) <= 0);
  // CR-03：逐个缺菜找替代，用 claimed 记账，防止同一份替代货被两道缺菜重复占用
  const claimed = {};
  const subs = missing.map(m => {
    const sub = findSubstitute(m, state.cooked, claimed);
    if (sub) claimed[sub] = (claimed[sub] || 0) + 1;
    return sub;
  });
  if (subs.some(x => x == null)) return state; // 无可替代 → UI 不该给此选项
  if (rng.chance(SUB_ACCEPT)) {
    // 接受：替换缺菜为替代菜，出餐
    const map = Object.fromEntries(missing.map((m, i) => [m, subs[i]]));
    const newDishes = cur.dishes.map(d => map[d] || d);
    const cooked = { ...state.cooked };
    for (const d of newDishes) cooked[d] = (cooked[d] || 0) - 1;
    const current = { ...cur, dishes: newDishes };
    return {
      ...state, cooked, rng: rng.getState(),
      service: { ...state.service, current, step: 'pricing' }
    };
  }
  // 拒绝 → 走人 rep-1
  return finishCustomer(applyRep({ ...state, rng: rng.getState() }, -1),
    { kind: 'sub-reject', line: '客人摇摇头走了，声望 −1。' });
}

function doApologize(state) {
  // CR-08：礼貌道歉不再倒扣声望——丢掉这单生意本身已是惩罚；
  // 频繁倒扣会把服务收益反复抵消，让声望永远涨不起来（缺菜时无解）。
  return finishCustomer(state,
    { kind: 'apologize', line: '你婉言道歉送客，这单没做成。' });
}

const VALID_TIERS = new Set(['kind', 'normal', 'slash']);
function doQuote(state, { tier }) {
  if (!VALID_TIERS.has(tier)) return state; // B-3：非法 tier 原样返回，不抛异常
  const rng = createRng(state.rng);
  const cur = state.service.current;
  const out = resolveQuote(cur, tier, rng);
  let s = { ...state, rng: rng.getState() };
  if (out.haggle) return { ...s, service: { ...s.service, step: 'haggle' } };
  if (tier === 'slash') s = bumpStat(s, 'slashCount', 1);
  return applyOutcome(s, out);
}

function doHaggle(state, { accept }) {
  const rng = createRng(state.rng);
  const cur = state.service.current;
  const out = resolveHaggle(cur, accept, rng);
  let s = bumpStat({ ...state, rng: rng.getState() }, 'slashCount', 1); // 砍价源自 slash
  return applyOutcome(s, out);
}

// 应用一次成交/走人结果
function applyOutcome(state, out) {
  const cur = state.service.current;
  let s = state;
  if (out.paid) {
    let gain = out.price;
    if (s.upgrades.includes('kopi')) gain += CONST.KOPI_BONUS;
    let repDelta = out.repDelta;
    // 美食家：当日菜品种类≥8 追加声望
    if (cur.type === 'foodie') {
      const variety = Object.keys(s.cooked).filter(id => s.cooked[id] > 0).length; // CR-07：只计仍有货的种类
      if (variety >= CONST.FOODIE_VARIETY_MIN) repDelta += CONST.FOODIE_VARIETY_BONUS;
    }
    s = {
      ...s,
      money: s.money + gain,
      today: { ...s.today, revenue: s.today.revenue + gain, served: s.today.served + 1 }
    };
    s = applyRep(s, repDelta);
  } else {
    // 走人：已出的菜计损耗
    s = {
      ...s,
      today: { ...s.today, lost: s.today.lost + cur.dishes.length },
      stats: { ...s.stats, walkoutCount: s.stats.walkoutCount + 1 }
    };
    s = applyRep(s, out.repDelta);
  }
  return finishCustomer(s, { kind: out.paid ? 'paid' : 'walkout', price: out.price, line: out.line });
}

function applyRep(state, delta) {
  const rep = Math.max(0, state.rep + delta);
  const applied = rep - state.rep; // CR-12：台账记录实际生效（钳零后）的声望变化，与 HUD 一致
  return { ...state, rep, today: { ...state.today, repDelta: state.today.repDelta + applied } };
}
function bumpStat(state, key, n) {
  return { ...state, stats: { ...state.stats, [key]: state.stats[key] + n } };
}

// 结束当前顾客 → result 步，存 lastOutcome
function finishCustomer(state, outcome) {
  return { ...state, service: { ...state.service, step: 'result', lastOutcome: outcome } };
}

function nextCustomer(state) {
  const idx = state.service.index + 1;
  if (idx < state.service.queue.length) {
    const current = state.service.queue[idx];
    return {
      ...state,
      service: {
        ...state.service, index: idx, current,
        step: current.request ? 'request' : 'meet',
        canServe: canServe(state.cooked, current.dishes), offer: null, lastOutcome: null, requestNotice: null
      }
    };
  }
  return closeAndSettle(state);
}

// 队列走空：施加收档事件 → 结算
function closeAndSettle(state) {
  const rng = createRng(state.rng);
  const eff = rollCloseEvents(state, rng);
  const cooked = { ...state.cooked };
  if (eff.removeDish) cooked[eff.removeDish] = Math.max(0, (cooked[eff.removeDish] || 0) - 1);
  const newRep = Math.max(0, state.rep + eff.repDelta);
  const appliedRep = newRep - state.rep; // CR-12：收档事件声望同样按钳零后实际变化计入台账
  let s = {
    ...state,
    cooked,
    money: state.money + eff.moneyDelta,
    rep: newRep,
    today: {
      ...state.today,
      spend: state.today.spend + (eff.moneyDelta < 0 ? -eff.moneyDelta : 0),
      repDelta: state.today.repDelta + appliedRep
    },
    service: null,
    closeLines: eff.lines,
    rng: rng.getState()
  };
  return settleDay(s);
}

function getUpgrade(id) { return UPGRADES.find(u => u.id === id); }

function ackSettle(state) {
  return { ...state, phase: state.day >= CONST.GAME_DAYS ? 'ending' : 'shop' };
}

function doUpgrade(state, { id }) {
  const up = getUpgrade(id);
  if (!up || state.upgrades.includes(id) || state.money < up.price) return state;
  return { ...state, money: state.money - up.price, upgrades: [...state.upgrades, id] };
}
