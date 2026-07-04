import { CONST, EVENTS, LINES } from './data.js';

// 开档事件：EVENT_CHANCE 概率触发，命中后在符合条件的事件里按 weight 抽一个。返回事件 id 或 null。
export function rollOpenEvent(state, rng) {
  if (!rng.chance(CONST.EVENT_CHANCE)) return null;
  const eligible = EVENTS.open.filter(e => e.minRep == null || state.rep >= e.minRep);
  return rng.weighted(eligible).id;
}

// 收档事件：返回待施加的效果（由 day.js 在 settleDay 之前应用）。
// { moneyDelta, repDelta, removeDish, lines }
export function rollCloseEvents(state, rng) {
  const leftoverIds = Object.keys(state.cooked).filter(id => state.cooked[id] > 0);
  const hasLeftover = leftoverIds.length > 0;
  const noFridge = !state.upgrades.includes('fridge');
  let moneyDelta = 0, repDelta = 0, removeDish = null;
  const lines = [];

  // 野猫偷吃：仅有剩菜时判定，在冰箱保留计算之前
  if (hasLeftover && rng.chance(CONST.CATSTEAL_CHANCE)) {
    removeDish = rng.pick(leftoverIds);
    lines.push(LINES.events.catSteal);
  }

  // 卫生检查
  if (rng.chance(CONST.INSPECTION_CHANCE)) {
    if (hasLeftover && noFridge) {
      moneyDelta -= CONST.INSPECTION_FINE;
      repDelta -= 2;
      lines.push(LINES.events.inspectionFail);
    } else {
      repDelta += 2;
      lines.push(LINES.events.inspectionPass);
    }
  }

  return { moneyDelta, repDelta, removeDish, lines };
}
