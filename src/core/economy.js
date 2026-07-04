import { CONST, DISHES, INGREDIENTS } from './data.js';

const DISH_BY_ID = Object.fromEntries(DISHES.map(d => [d.id, d]));
const ING_PRICE = Object.fromEntries(INGREDIENTS.map(i => [i.id, i.price]));

// 单菜成本 = 配方食材单价之和（§3）
export function dishCost(dishId) {
  return DISH_BY_ID[dishId].recipe.reduce((s, ing) => s + ING_PRICE[ing], 0);
}
// 订单基准价 = 米饭基准价 + Σ 菜品基准价（§4.2）
export function orderBase(dishes) {
  return CONST.RICE_PRICE + dishes.reduce((s, id) => s + DISH_BY_ID[id].price, 0);
}
// 订单成本 = 米饭成本 + Σ 单菜成本（§4.2，含米，用于 kind 下限）
export function orderCost(dishes) {
  return CONST.RICE_COST + dishes.reduce((s, id) => s + dishCost(id), 0);
}
// 三档报价（round = Math.round，round-half-up）
export function quotePrices(dishes) {
  const base = orderBase(dishes), cost = orderCost(dishes);
  return {
    kind: Math.max(cost + 1, Math.round(base * 0.8)),
    normal: base,
    slash: Math.round(base * 1.5)
  };
}

// §8 结算：纯确定性（不碰 rng）。收档随机事件由 day.js 在调用本函数前施加。
// 入参 state 需已处于 service 阶段、队列走空；返回新 state，phase 置为 'settle' 或 'gameover'。
export function settleDay(state) {
  const s = {
    ...state,
    cooked: { ...state.cooked },
    carryOver: {},
    today: { ...state.today },
    stats: { ...state.stats },
    loan: state.loan ? { ...state.loan } : null
  };

  // 步骤 1：helper 自动卖出至多 HELPER_AUTO_SELL 份当日剩菜（按基准价从高到低），在作废之前
  if (s.upgrades.includes('helper')) {
    let toSell = CONST.HELPER_AUTO_SELL;
    const byPrice = Object.keys(s.cooked)
      .filter(id => s.cooked[id] > 0)
      .sort((a, b) => DISH_BY_ID[b].price - DISH_BY_ID[a].price);
    for (const id of byPrice) {
      while (toSell > 0 && s.cooked[id] > 0) {
        s.cooked[id] -= 1;
        s.today.revenue += orderBase([id]);
        s.today.served += 1;
        toSell -= 1;
      }
      if (toSell <= 0) break;
    }
  }

  // 步骤 2：剩熟菜处理
  const hasFridge = s.upgrades.includes('fridge');
  for (const id of Object.keys(s.cooked)) {
    const qty = s.cooked[id];
    if (qty <= 0) continue;
    if (hasFridge) {
      const keep = Math.floor(qty * CONST.FRIDGE_KEEP);
      if (keep > 0) s.carryOver[id] = keep;
      s.today.lost += qty - keep;
    } else {
      s.today.lost += qty;
    }
  }

  // 步骤 3：房租
  s.money -= CONST.RENT_PER_DAY;
  s.today.spend += CONST.RENT_PER_DAY;

  // 步骤 4：贷款利息
  if (s.loan) {
    s.money -= CONST.LOAN_INTEREST;
    s.today.spend += CONST.LOAN_INTEREST;
    s.loan.repaid += CONST.LOAN_INTEREST;
    if (s.loan.repaid >= CONST.LOAN_REPAY) s.loan = null;
  }

  // 步骤 5：累计 stats（必须在破产判定之前）
  s.stats.totalServed += s.today.served;
  s.stats.totalRevenue += s.today.revenue;
  s.stats.bestDayRevenue = Math.max(s.stats.bestDayRevenue, s.today.revenue);

  // 步骤 6：破产判定
  if (s.money < 0) {
    if (!s.usedLoan) {
      s.money += CONST.LOAN_AMOUNT;
      s.loan = { repaid: 0 };
      s.usedLoan = true;
      s.phase = 'settle';
    } else {
      s.phase = 'gameover';
      return s;
    }
  } else {
    s.phase = 'settle';
  }
  return s;
}
