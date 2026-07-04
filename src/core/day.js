import { CONST, DISHES, UPGRADES } from './data.js';
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
    today: { revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0 },
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
  const ing = ING_BY_ID[id];
  if (!ing || state.rep < ing.unlockRep) return state;
  const price = ingredientPrice(state, id);
  const cost = qty * price;
  const nextQty = (state.inventory[id] || 0) + qty;
  if (nextQty < 0) return state;              // 不能退到负库存
  if (qty > 0 && state.money < cost) return state; // 钱不够
  const inventory = { ...state.inventory, [id]: nextQty };
  return {
    ...state,
    money: state.money - cost,
    inventory,
    today: { ...state.today, spend: state.today.spend + cost }
  };
}

function doCook(state, { id, qty }) {
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
    queue, index: 0, current: queue[0] || null, step: 'meet',
    canServe: queue[0] ? canServe(state.cooked, queue[0].dishes) : false,
    offer: null, lastOutcome: null
  };
  return { ...state, phase: 'service', service, rng: rng.getState() };
}

function canServe(cooked, dishes) {
  return dishes.length > 0 && dishes.every(d => (cooked[d] || 0) > 0);
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
  return finishCustomer(applyRep(state, -1),
    { kind: 'apologize', line: '你道歉送客，声望 −1。' });
}

function doQuote(state, { tier }) {
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
        ...state.service, index: idx, current, step: 'meet',
        canServe: canServe(state.cooked, current.dishes), offer: null, lastOutcome: null
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
