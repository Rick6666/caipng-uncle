import { describe, it, expect } from 'vitest';
import { INGREDIENTS, DISHES, CUSTOMER_TYPES, UPGRADES, EVENTS, REP_LEVELS, REACTION, CONST, LINES } from '../src/core/data.js';

describe('data integrity', () => {
  it('常量与设计文档一致', () => {
    expect(CONST.START_MONEY).toBe(50);
    expect(CONST.RENT_PER_DAY).toBe(9);
    expect(CONST.RENT_ESCALATION).toBe(3);
    expect(CONST.GAME_DAYS).toBe(7);
    expect(CONST.LOAN_REPAY).toBe(40);
    expect(CONST.RICE_COST).toBe(1);
    expect(CONST.RICE_PRICE).toBe(1);
  });
  it('每道菜的配方食材都存在', () => {
    const ids = new Set(INGREDIENTS.map(i => i.id));
    for (const d of DISHES) for (const ing of d.recipe) expect(ids.has(ing), `${d.id}:${ing}`).toBe(true);
  });
  it('每道菜/顾客都有 emoji（本作用 emoji 视觉，不依赖外部美术）', () => {
    for (const d of DISHES) expect(d.emoji && typeof d.emoji === 'string').toBeTruthy();
    for (const c of CUSTOMER_TYPES) expect(c.emoji && typeof c.emoji === 'string').toBeTruthy();
  });
  it('规模达标: 食材≥10 菜≥12 顾客≥6 升级≥7 声望等级=6 事件≥8', () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(10);
    expect(DISHES.length).toBeGreaterThanOrEqual(12);
    expect(CUSTOMER_TYPES.length).toBeGreaterThanOrEqual(6);
    expect(UPGRADES.length).toBeGreaterThanOrEqual(7);
    expect(REP_LEVELS.length).toBe(6);
    expect(EVENTS.open.length + EVENTS.close.length).toBeGreaterThanOrEqual(8);
  });
  it('每类顾客都有 REACTION 三档定义', () => {
    for (const c of CUSTOMER_TYPES) {
      expect(REACTION[c.id], c.id).toBeDefined();
      for (const tier of ['kind', 'normal', 'slash']) expect(REACTION[c.id][tier], `${c.id}.${tier}`).toBeDefined();
    }
  });
  it('每类顾客文案齐备: ≥5 条进场台词、每档位 ≥3 条反应', () => {
    for (const c of CUSTOMER_TYPES) {
      expect(LINES.greetings[c.id].length, `greetings.${c.id}`).toBeGreaterThanOrEqual(5);
      for (const tier of ['kind', 'normal', 'slash'])
        expect(LINES.reactions[c.id][tier].length, `reactions.${c.id}.${tier}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('姓名池 ≥12', () => {
    expect(LINES.names.length).toBeGreaterThanOrEqual(12);
  });
});
