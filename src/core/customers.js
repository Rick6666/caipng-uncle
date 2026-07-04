import { CONST, DISHES, REACTION, LINES, REQUESTS } from './data.js';
import { unlockedCustomerTypes } from './state.js';
import { quotePrices, orderBase } from './economy.js';

const DISH_BY_ID = Object.fromEntries(DISHES.map(d => [d.id, d]));
const MEATY = new Set(['meat', 'premium']);

// 开档事件对顾客权重的临时加成
function eventWeight(type, todayEvent) {
  let w = type.weight;
  if (todayEvent === 'holiday' && type.id === 'student') w *= 3;
  if (todayEvent === 'payday' && (type.id === 'worker' || type.id === 'labourer')) w *= 2;
  return w;
}

// 从已备菜品里抽 dishCount 道（不重复、按人气权重、有荤则至少一道荤）
function pickDishes(availableIds, dishCount, rng) {
  const chosen = [];
  const meaty = availableIds.filter(id => MEATY.has(DISH_BY_ID[id].cat));
  if (meaty.length) {
    chosen.push(rng.weighted(meaty.map(id => ({ id, weight: DISH_BY_ID[id].weight }))).id);
  }
  while (chosen.length < dishCount) {
    const remain = availableIds.filter(id => !chosen.includes(id));
    if (!remain.length) break;
    chosen.push(rng.weighted(remain.map(id => ({ id, weight: DISH_BY_ID[id].weight }))).id);
  }
  return chosen;
}

export function generateQueue(ctx, n, rng) {
  const availIds = Object.keys(ctx.cooked).filter(id => ctx.cooked[id] > 0);
  const variety = availIds.length;
  const types = unlockedCustomerTypes(ctx.rep).filter(
    c => c.id !== 'foodie' || variety >= CONST.FOODIE_MIN_VARIETY_SPAWN
  );
  const queue = [];
  for (let i = 0; i < n; i++) {
    const type = rng.weighted(types.map(c => ({ ...c, weight: eventWeight(c, ctx.todayEvent) })));
    const name = rng.pick(LINES.names);
    const dishes = availIds.length ? pickDishes(availIds, type.dishCount, rng) : [];
    const greeting = rng.pick(LINES.greetings[type.id]);
    // CR-19：部分顾客带一个特殊需求（掷骰在最后，保持前面点单/问候的随机流不变）
    const rq = REQUESTS[type.id];
    const request = rq && rng.chance(rq.chance) ? type.id : null;
    queue.push({ type: type.id, name, dishes, greeting, request });
  }
  return queue;
}

// 报价反应。返回 { paid, walkout, price, repDelta, line, haggle? }
export function resolveQuote(customer, tier, rng) {
  const r = REACTION[customer.type][tier];
  const price = quotePrices(customer.dishes)[tier];
  if (r.haggle) return { haggle: true, price };

  const line = pickLine(customer.type, tier, rng);
  if (tier === 'slash') {
    const paid = rng.chance(r.pay);
    return paid
      ? { paid: true, walkout: false, price, repDelta: r.repPaid, line }
      : { paid: false, walkout: true, price: 0, repDelta: r.repWalk, line };
  }
  // kind / normal
  const paid = rng.chance(r.pay);
  return paid
    ? { paid: true, walkout: false, price, repDelta: r.rep, line }
    : { paid: false, walkout: true, price: 0, repDelta: 0, line };
}

// 阿嬷砍价子选择：accept=收正常价 rep0 / gamble=赌一把
export function resolveHaggle(customer, accept, rng) {
  const h = REACTION[customer.type].haggle;
  const line = pickLine(customer.type, 'normal', rng);
  if (accept) {
    return { paid: true, walkout: false, price: quotePrices(customer.dishes).normal, repDelta: h.accept.rep, line };
  }
  const paid = rng.chance(h.gamble.payChance);
  return paid
    ? { paid: true, walkout: false, price: quotePrices(customer.dishes).slash, repDelta: h.gamble.repPaid, line }
    : { paid: false, walkout: true, price: 0, repDelta: h.gamble.repWalk, line };
}

function pickLine(type, tier, rng) {
  const arr = LINES.reactions[type][tier];
  return rng.pick(arr);
}

// 缺菜替代：同类别、有货，返回一个 dishId，否则 null
// claimed = 同一单内已被其它缺菜占用的替代货计数，避免一份货被重复占用（CR-03）
export function findSubstitute(missingId, cooked, claimed = {}) {
  const cat = DISH_BY_ID[missingId].cat;
  for (const d of DISHES) {
    if (d.id !== missingId && d.cat === cat && (cooked[d.id] || 0) - (claimed[d.id] || 0) > 0) return d.id;
  }
  return null;
}
