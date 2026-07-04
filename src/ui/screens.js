import { h, pic, btn, setScreen, setActions } from './dom.js';
import {
  unlockedIngredients, unlockedDishes, prepCap, ingredientPrice,
  dailyCustomerCount, uncleTitle, epitaph, finalScore, grade, dailyVerdict, repLevel
} from '../core/state.js';
import { INGREDIENTS, DISHES, UPGRADES, LINES, CONST, CUSTOMER_TYPES, REQUESTS } from '../core/data.js';
import { quotePrices } from '../core/economy.js';

const DISH_BY_ID = Object.fromEntries(DISHES.map(d => [d.id, d]));
const ING_BY_ID = Object.fromEntries(INGREDIENTS.map(i => [i.id, i]));
const CT_BY_ID = Object.fromEntries(CUSTOMER_TYPES.map(c => [c.id, c]));
// 每种食材能做出哪些菜（用于采购界面提示"买这个能做什么"）
const DISHES_BY_ING = {};
for (const d of DISHES) for (const ing of d.recipe) (DISHES_BY_ING[ing] ||= []).push(d);

function tag(text) { return h('div', { class: 'phase-tag' }, text); }
function stepperRow(emojiNode, name, desc, count, onMinus, onPlus, minusOff, plusOff) {
  return h('div', { class: 'item-row' },
    emojiNode,
    h('div', { class: 'item-info' },
      h('div', { class: 'item-name' }, name),
      desc && h('div', { class: 'item-desc' }, desc)),
    h('div', { class: 'item-count' }, String(count)),
    h('div', { class: 'stepper' },
      h('button', { class: 'minus', onClick: onMinus, disabled: minusOff }, '−'),
      h('button', { onClick: onPlus, disabled: plusOff }, '+')));
}

export function render(state, dispatch) {
  switch (state.phase) {
    case 'title': return renderTitle(state, dispatch);
    case 'morning': return renderMorning(state, dispatch);
    case 'prep': return renderPrep(state, dispatch);
    case 'service': return renderService(state, dispatch);
    case 'settle': return renderSettle(state, dispatch);
    case 'shop': return renderShop(state, dispatch);
    case 'ending': return renderEnding(state, dispatch);
    case 'gameover': return renderGameover(state, dispatch);
  }
}

function renderTitle(state, dispatch) {
  const hs = state._highscore;
  const cover = h('div', { class: 'cover' },
    h('div', { class: 'cover-emoji' }, '🍛'),
    h('h1', {}, '杂菜饭 Uncle'),
    h('div', { class: 'en' }, 'CAI PNG TYCOON'),
    h('p', {}, '邻居 Uncle 把摊子托你看 7 天。每天买菜、备菜、看人喊价，撑到最后交出成绩单。'),
    btn('开始经营', 'btn-gold', () => dispatch({ type: 'START_DAY' }), '闯一闯这七天'),
    hs && h('div', { class: 'ver' }, `历史最佳：${hs.score} 分（${hs.grade}）· ${LINES.titles[hs.uncleTitleId]?.title || ''}`)
  );
  setScreen(cover);
  setActions();
}

function renderMorning(state, dispatch) {
  const unlockedDishIds = new Set(unlockedDishes(state.rep).map(d => d.id));
  const list = unlockedIngredients(state.rep).map(ing => {
    const price = ingredientPrice(state, ing.id);
    const have = state.inventory[ing.id] || 0;
    // 提示：这份食材能做出哪些（已解锁的）菜
    const makes = (DISHES_BY_ING[ing.id] || []).filter(d => unlockedDishIds.has(d.id)).map(d => d.name);
    const desc = makes.length ? `$${price}／份 · 做：${makes.join('、')}` : `$${price}／份`;
    return stepperRow(
      h('span', { class: 'item-emoji' }, ing.emoji), ing.name, desc, have,
      () => dispatch({ type: 'BUY', id: ing.id, qty: -1 }),
      () => dispatch({ type: 'BUY', id: ing.id, qty: 1 }),
      have <= 0, state.money < price);
  });
  setScreen(
    tag('清晨 · 采购'),
    eventBanner(state),
    h('p', { class: 'subtitle' }, `预计今天约 ${dailyCustomerCount(state)} 位客人。看清每样食材能做什么，别乱买。`),
    ...list);
  setActions(btn(`去备菜`, 'btn-green', () => dispatch({ type: 'FINISH_MORNING' }), `手头 $${state.money}`));
}

function renderPrep(state, dispatch) {
  const cap = prepCap(state);
  const used = Object.values(state.cooked).reduce((a, b) => a + b, 0);
  const dishes = unlockedDishes(state.rep);
  // 还有食材可以炒出任何一道菜？用于软锁保护（CR-17）
  const canCookAny = dishes.some(d => Math.min(...d.recipe.map(ing => state.inventory[ing] || 0)) > 0);
  const list = dishes.map(d => {
    const canMake = Math.min(...d.recipe.map(ing => state.inventory[ing] || 0));
    const cooked = state.cooked[d.id] || 0;
    const recipeTxt = d.recipe.map(ing => `${ING_BY_ID[ing].name}×1`).join('+');
    // 显示当前食材还能再做几份，把"买的原料"和"能炒的菜"直接挂钩
    const desc = `配方 ${recipeTxt}｜卖 $${d.price}｜库存还能做 ${canMake} 份`;
    return stepperRow(
      pic(d.emoji, 'item-emoji'), d.name, desc, cooked,
      () => dispatch({ type: 'COOK', id: d.id, qty: -1 }),
      () => dispatch({ type: 'COOK', id: d.id, qty: 1 }),
      cooked <= 0, canMake <= 0 || used >= cap);
  });
  setScreen(
    tag('清晨 · 备菜'),
    h('p', { class: 'subtitle' }, `已备 ${used}/${cap} 份。「库存还能做 N 份」= 你买的食材够炒几份；多备种类，客人更容易凑齐一单。`),
    ...list);
  // CR-17 防软锁：只有「还能备菜却没备」才拦；彻底没料可炒（没钱没库存）时放行开档，
  // 让玩家进入注定亏本的一天→收档→触发破产，而不是卡死在备菜页无法前进。
  const openOff = used <= 0 && canCookAny;
  const hint = used > 0 ? `共 ${used} 份` : (canCookAny ? '先备点菜' : '没料可炒，硬着头皮开档');
  setActions(btn('开档营业！', 'btn-primary', () => dispatch({ type: 'OPEN_STALL' }), hint, openOff));
}

function renderService(state, dispatch) {
  const svc = state.service;
  const cur = svc.current;
  const ct = CT_BY_ID[cur.type];
  const face = pic(ct.emoji, 'customer-face');
  const orderChips = h('div', { class: 'order-list' },
    ...cur.dishes.map(id => {
      const miss = (state.cooked[id] || 0) <= 0 && svc.step === 'meet';
      return h('div', { class: 'order-chip' + (miss ? ' missing' : '') }, DISH_BY_ID[id].name);
    }));
  const card = h('div', { class: 'card customer-card' },
    face,
    h('div', { class: 'customer-name' }, cur.name),
    h('div', { class: 'customer-type' }, ct.name),
    orderChips);

  if (svc.step === 'request') {
    const rq = REQUESTS[cur.request];
    const eff = (e) => {
      const parts = [];
      if (e.rep) parts.push(`声望 ${e.rep > 0 ? '+' : ''}${e.rep}`);
      if (e.money < 0) parts.push(`花 $${-e.money}`);
      else if (e.money > 0) parts.push(`赚 $${e.money}`);
      return parts.join(' · ') || '照常';
    };
    card.append(h('div', { class: 'speech' }, rq.prompt));
    setScreen(tag(`营业中 · 第 ${svc.index + 1}/${svc.queue.length} 位`), card);
    setActions(
      btn(rq.accept.label, 'btn-green', () => dispatch({ type: 'RESOLVE_REQUEST', accept: true }), eff(rq.accept)),
      btn(rq.decline.label, 'btn-plain', () => dispatch({ type: 'RESOLVE_REQUEST', accept: false }), eff(rq.decline)));
    return;
  }
  if (svc.step === 'meet') {
    if (svc.requestNotice) card.append(h('div', { class: 'narrative' }, h('em', {}, svc.requestNotice)));
    card.append(h('div', { class: 'speech' }, cur.greeting));
    setScreen(tag(`营业中 · 第 ${svc.index + 1}/${svc.queue.length} 位`), card);
    if (svc.canServe) {
      setActions(btn('出餐！', 'btn-green', () => dispatch({ type: 'SERVE' }), '菜齐，招呼客人'));
    } else {
      const canSub = subAvailable(state);
      setActions(
        canSub && btn('推荐替代菜', 'btn-plain', () => dispatch({ type: 'OFFER_SUB' }), '缺的菜换个同款'),
        btn('道歉送客', 'btn-plain', () => dispatch({ type: 'APOLOGIZE' }), '声望 −1'));
    }
    return;
  }
  if (svc.step === 'pricing') {
    const q = quotePrices(cur.dishes);
    card.append(h('div', { class: 'speech' }, '菜好了，Uncle 你看着开价 lah…'));
    setScreen(tag('玄学报价 · 看人喊价'), card);
    setActions(
      btn(`良心价 $${q.kind}`, 'btn-green', () => dispatch({ type: 'QUOTE', tier: 'kind' }), '少赚，赚口碑'),
      btn(`正常价 $${q.normal}`, 'btn-plain', () => dispatch({ type: 'QUOTE', tier: 'normal' }), '公道'),
      btn(`斩客价 $${q.slash}`, 'btn-primary', () => dispatch({ type: 'QUOTE', tier: 'slash' }), '多赚，赌他付'));
    return;
  }
  if (svc.step === 'haggle') {
    const q = quotePrices(cur.dishes);
    card.append(h('div', { class: 'speech' }, '哎哟这么贵！便宜点啦 Uncle～'));
    setScreen(tag('阿嬷砍价中'), card);
    setActions(
      btn(`好啦算你 $${q.normal}`, 'btn-plain', () => dispatch({ type: 'HAGGLE', accept: true }), '收正常价'),
      btn('这个真不能少', 'btn-primary', () => dispatch({ type: 'HAGGLE', accept: false }), '赌一把，可能走人'));
    return;
  }
  // result
  const o = svc.lastOutcome;
  card.append(h('div', { class: 'speech' }, o.line || ''));
  const money = o.kind === 'paid' ? h('p', { class: 'subtitle pos' }, `+ $${o.price}`) : null;
  setScreen(tag('结果'), card, money);
  const last = svc.index + 1 >= svc.queue.length;
  setActions(btn(last ? '收档结算' : '下一位客人', 'btn-green', () => dispatch({ type: 'NEXT_CUSTOMER' })));
}

function renderSettle(state, dispatch) {
  const t = state.today;
  const rows = [
    ['营业收入', `+$${t.revenue}`, 'pos'],
    ['食材/房租/杂支', `−$${t.spend}`, 'neg'],
    ['损耗（走单/剩菜）', `${t.lost} 份`, ''],
    ['声望变化', `${t.repDelta >= 0 ? '+' : ''}${t.repDelta}`, t.repDelta >= 0 ? 'pos' : 'neg']
  ];
  const ledger = h('table', { class: 'ledger' },
    ...rows.map(([k, v, c]) => h('tr', {}, h('td', {}, k), h('td', { class: c }, v))),
    h('tr', { class: 'total' }, h('td', {}, '今日结余'), h('td', {}, `$${state.money}`)));
  const verdict = LINES.verdicts[dailyVerdict(t)];
  const evLines = (state.closeLines || []).map(l => h('p', { class: 'subtitle' }, l));
  // CR-11：续命贷对玩家可见——说明钱从哪来、往后怎么还
  const loanLine = state.loanTaken
    ? h('p', { class: 'narrative' }, h('em', {},
        `🆘 手头周转不灵，向相熟的摊贩借了 $${CONST.LOAN_AMOUNT} 续命，往后每天从结余自动还 $${CONST.LOAN_INTEREST}，还满 $${CONST.LOAN_REPAY} 为止。`))
    : null;
  setScreen(
    tag(`第 ${state.day}/7 天 · 收档`),
    ...evLines,
    loanLine,
    h('div', { class: 'card' }, ledger),
    h('p', { class: 'narrative' }, h('em', {}, verdict[state.day % verdict.length] || verdict[0])));
  const last = state.day >= CONST.GAME_DAYS;
  setActions(btn(last ? '看看这七天的成绩' : '继续', 'btn-green', () => dispatch({ type: 'ACK_SETTLE' })));
}

function renderShop(state, dispatch) {
  const cards = UPGRADES.map(u => {
    const owned = state.upgrades.includes(u.id);
    const affordable = state.money >= u.price;
    return h('div', { class: 'card upg-row' },
      h('span', { class: 'item-emoji' }, u.emoji),
      h('div', { class: 'item-info' },
        h('div', { class: 'item-name' }, `${u.name}　$${u.price}`),
        h('div', { class: 'item-desc' }, u.desc)),
      owned
        ? h('span', { class: 'upg-owned' }, '已拥有 ✓')
        : h('button', { class: 'upg-buy', onClick: () => dispatch({ type: 'BUY_UPGRADE', id: u.id }), disabled: !affordable }, affordable ? '购买' : '钱不够'));
  });
  setScreen(
    tag(`第 ${state.day}/7 天 · 打烊 · 升级摊子`),
    h('p', { class: 'subtitle' }, `手头 $${state.money}。明智投资能让后面几天轻松些。`),
    ...cards);
  setActions(btn('开始新的一天 →', 'btn-primary', () => dispatch({ type: 'END_SHOP' })));
}

// 结局「Uncle 人设卡」：人设身份为视觉主角，评级/战绩降为副标签与小 chip（P1，为截图设计）
function personaName(fullTitle) {
  const emoji = fullTitle.split(' ')[0];
  return { emoji, name: fullTitle.slice(emoji.length).trim() };
}
function statChips(...pairs) {
  return h('div', { class: 'stat-chips' }, ...pairs.map(t => h('span', {}, t)));
}

function renderEnding(state, dispatch) {
  const score = finalScore(state);
  const g = grade(score);
  const persona = uncleTitle(state.stats, state.rep, state.money);
  const { emoji, name } = personaName(persona.title);
  const hs = state._highscore;
  const legend = state.rep >= 120 ? h('p', { class: 'narrative' }, h('em', {}, LINES.legend)) : null;
  setScreen(
    h('div', { class: 'cover persona-card' },
      h('div', { class: 'cover-emoji' }, emoji),
      h('h1', {}, name),
      h('div', { class: 'en' }, `${g} 级 · ${score} 分 · 撑满 7 天`),
      h('p', {}, persona.flavor, h('br'), h('br'), LINES.gradeFlavor[g]),
      statChips(`总接客 ${state.stats.totalServed}`, `总营收 $${state.stats.totalRevenue}`, `最旺一天 $${state.stats.bestDayRevenue}`),
      legend,
      hs && h('div', { class: 'ver' }, score >= hs.score ? '🎉 刷新了你的历史最佳！' : `历史最佳 ${hs.score} 分`)
    ));
  setActions(btn('再来一局', 'btn-gold', () => dispatch({ type: 'NEW_GAME', seed: freshSeed() }), '换个手气'));
}

function renderGameover(state, dispatch) {
  const ep = epitaph(state.day, state.stats);
  const { emoji, name } = personaName(ep.title);
  const hs = state._highscore;
  setScreen(
    h('div', { class: 'cover persona-card' },
      h('div', { class: 'cover-emoji' }, emoji),
      h('h1', {}, name),
      h('div', { class: 'en' }, `摊子倒了 · 撑到第 ${state.day} 天`),
      h('p', {}, ep.line),
      statChips(`总接客 ${state.stats.totalServed}`, `总营收 $${state.stats.totalRevenue}`),
      hs && h('div', { class: 'ver' }, `历史最佳 ${hs.score} 分`)
    ));
  setActions(btn('再来一局', 'btn-gold', () => dispatch({ type: 'NEW_GAME', seed: freshSeed() }), '这次一定行'));
}

// —— 辅助 ——
function eventBanner(state) {
  if (!state.todayEvent) return null;
  const txt = LINES.events[state.todayEvent];
  return txt ? h('p', { class: 'narrative' }, h('em', {}, txt)) : null;
}
function subAvailable(state) {
  const cur = state.service.current;
  const missing = cur.dishes.filter(d => (state.cooked[d] || 0) <= 0);
  if (!missing.length) return false;
  // 只要每个缺菜都有同类替代
  return missing.every(m => {
    const cat = DISH_BY_ID[m].cat;
    return DISHES.some(d => d.id !== m && d.cat === cat && (state.cooked[d.id] || 0) > 0);
  });
}
function freshSeed() {
  // 用高精度时间做种子（app.js 也接受 ?seed= 覆盖）
  return (Date.now() ^ (performance.now() * 1000)) >>> 0;
}
