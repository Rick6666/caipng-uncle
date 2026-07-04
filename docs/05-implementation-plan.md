# 《杂菜饭 Uncle》TDD 实施计划（Implementation Plan）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现并上线《杂菜饭 Uncle》手机网页经营模拟游戏（GitHub Pages）。

**Architecture:** 运行时零依赖的原生 ES Modules；`src/core/` 纯函数逻辑层（reducer 模式 + 可序列化 RNG），`src/ui/` 表现层；Vitest 单测 + 千局平衡模拟 + Playwright 手机视口 E2E。详见 `docs/03-architecture.md`（接口契约，签名必须逐字一致）与 `docs/02-game-design.md`（数值单一真源）。

**Tech Stack:** HTML/CSS/原生 JS (ESM)、Vitest、@playwright/test、GitHub Actions、GitHub Pages。

**执行纪律（每个任务通用）：**
1. 严格按 RED→GREEN 顺序，禁止先写实现；
2. 完整用例清单在 `docs/04-test-plan.md` §3 按模块列出——本计划展示关键测试代码，**该清单中同模块的其余用例也必须在同一任务内补齐**；
3. 数值一律 import 自 `data.js`，测试断言里的魔法数字须与 `docs/02-game-design.md` 对表；
4. 每个任务结束 commit（格式 `<type>: <description>`，无 attribution 尾注——用户全局规范）；
5. 任何任务卡壳超过 3 次尝试 → 停下报告，不得擅自改契约。

---

### Task 0: 项目初始化

**Files:**
- Create: `package.json`, `vitest.config.js`, `playwright.config.js`, `.gitignore`, `.github/workflows/ci.yml`（占位，Task 12 完善）
- 已存在无需动: `index.html`, `style.css`, `docs/*`

- [x] **Step 1: git init 与首次提交**

```bash
cd /Users/wangjiapeng/Projects/caifan
git init -b main
printf 'node_modules/\ncoverage/\ntest-results/\ne2e/screenshots/\nplaywright-report/\n.DS_Store\n' > .gitignore
git add . && git commit -m "chore: project scaffold and planning docs"
```

- [x] **Step 2: package.json**

```json
{
  "name": "caipng-uncle",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "e2e": "playwright test",
    "serve": "python3 -m http.server 8000"
  }
}
```

- [x] **Step 3: 安装开发依赖**

```bash
npm i -D vitest @vitest/coverage-v8 @playwright/test
npx playwright install chromium
```

- [x] **Step 4: vitest.config.js**

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    testTimeout: 60000,
    coverage: { include: ['src/core/**'] }
  }
});
```

- [x] **Step 5: playwright.config.js**

```js
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'python3 -m http.server 8000', port: 8000, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:8000', screenshot: 'only-on-failure' },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'] } }]
});
```

- [x] **Step 6: 配置 pre-commit 测试门禁**（见 `docs/07-workflow-rules.md` §6，不引入 Husky，保持零额外依赖；
  **不要直接写 `.git/hooks/`**——那个目录不受版本控制，`git clone` 之后 hook 就消失了，等于没配。
  用 `core.hooksPath` 指向仓库内一个受版本控制的目录，这样 hook 随仓库一起分发）

```bash
mkdir -p .githooks
cat > .githooks/pre-commit << 'EOF'
#!/bin/sh
npm test || { echo "测试未通过，提交已阻止"; exit 1; }
EOF
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

（`core.hooksPath` 是仓库本地 git 配置，不会自动同步给克隆者——README 里需要提一句
"克隆后执行 `git config core.hooksPath .githooks`"，这是唯一的手动步骤，仍然比引入 Husky 简单。
CI 的 `npm test` 门禁不依赖这个本地 hook，属于双保险而非唯一防线。）

- [x] **Step 7: 冒烟验证 + 提交**

```bash
npx vitest run   # 期望: "No test files found" 正常退出（还没有测试）
git add -A && git commit -m "chore: tooling setup (vitest + playwright + pre-commit gate)"
```

---

### Task 1: rng.js — 可序列化随机数

**Files:**
- Create: `src/core/rng.js`
- Test: `tests/rng.test.js`

- [x] **Step 1: 写失败测试**

```js
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng.js';

describe('rng', () => {
  it('同种子序列完全一致', () => {
    const a = createRng(42), b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('getState 后可无缝续接', () => {
    const a = createRng(7);
    a.next(); a.next();
    const b = createRng(a.getState());
    expect(b.next()).toBe(a.next());
  });
  it('int 含两端且分布合理', () => {
    const r = createRng(1), seen = new Set();
    let c1 = 0;
    for (let i = 0; i < 10000; i++) { const v = r.int(1, 3); seen.add(v); if (v === 1) c1++; }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(c1 / 10000).toBeGreaterThan(0.2);
  });
  it('weighted 按权重抽取，权重 0 永不出现', () => {
    const r = createRng(9);
    const items = [{ id: 'a', weight: 9 }, { id: 'b', weight: 1 }, { id: 'c', weight: 0 }];
    let a = 0;
    for (let i = 0; i < 10000; i++) { const p = r.weighted(items); if (p.id === 'a') a++; expect(p.id).not.toBe('c'); }
    expect(a / 10000).toBeGreaterThan(0.85);
    expect(a / 10000).toBeLessThan(0.95);
  });
});
```

- [x] **Step 2: 跑测试确认失败**：`npx vitest run tests/rng.test.js` → FAIL（模块不存在）

- [x] **Step 3: 实现（mulberry32）**

```js
export function createRng(seedOrState) {
  let s = (typeof seedOrState === 'object' ? seedOrState.s : seedOrState) >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted(items) {
      const total = items.reduce((s2, it) => s2 + it.weight, 0);
      let roll = next() * total;
      for (const it of items) { roll -= it.weight; if (roll < 0) return it; }
      return items[items.length - 1];
    },
    getState: () => ({ s })
  };
}
```

- [x] **Step 4: 跑测试确认通过**：`npx vitest run tests/rng.test.js` → PASS
- [x] **Step 5: 提交** `git add -A && git commit -m "feat: seedable serializable rng"`

---

### Task 2: data.js — 静态数据表

**Files:**
- Create: `src/core/data.js`
- Test: `tests/data.test.js`

- [x] **Step 1: 写失败测试（数据一致性校验，防手滑）**

```js
import { describe, it, expect } from 'vitest';
import { INGREDIENTS, DISHES, CUSTOMER_TYPES, UPGRADES, EVENTS, REP_LEVELS, CONST, LINES } from '../src/core/data.js';

describe('data integrity', () => {
  it('常量与设计文档一致', () => {
    expect(CONST.START_MONEY).toBe(120);
    expect(CONST.RENT_PER_DAY).toBe(25);
    expect(CONST.GAME_DAYS).toBe(7);
    expect(CONST.LOAN_REPAY).toBe(150);
  });
  it('每道菜的配方食材都存在', () => {
    const ids = new Set(INGREDIENTS.map(i => i.id));
    for (const d of DISHES) for (const ing of d.recipe) expect(ids.has(ing), `${d.id}:${ing}`).toBe(true);
  });
  it('规模达标: 食材≥10 菜≥12 顾客≥6 升级≥7 声望等级=6', () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(10);
    expect(DISHES.length).toBeGreaterThanOrEqual(12);
    expect(CUSTOMER_TYPES.length).toBeGreaterThanOrEqual(6);
    expect(UPGRADES.length).toBeGreaterThanOrEqual(7);
    expect(REP_LEVELS.length).toBe(6);
  });
  it('每类顾客文案齐备: ≥5 条进场台词、每档位 ≥3 条反应', () => {
    for (const c of CUSTOMER_TYPES) {
      expect(LINES.greetings[c.id].length).toBeGreaterThanOrEqual(5);
      for (const tier of ['kind', 'normal', 'slash'])
        expect(LINES.reactions[c.id][tier].length).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [x] **Step 2: 确认失败** → **Step 3: 实现**

将 `docs/02-game-design.md` §1~§7 的每一张表逐行翻译为导出常量：
`CONST`（§1 全部常量）、`INGREDIENTS`（§2）、`DISHES`（§3，字段 `id/name/emoji/recipe/price/weight/cat`）、
`CUSTOMER_TYPES`（§4.1，字段 `id/name/emoji/weight/dishCount/unlockRep`）、
`REACTION`（§4.2 反应矩阵，结构 `{ [typeId]: { kind: {pay, rep}, normal: {...}, slash: {pay, repPaid, repWalk} } }`，特殊分支 ahma/influencer 单独字段标注）、
`REP_LEVELS`（§5）、`UPGRADES`（§6）、`EVENTS`（§7）、
`LINES`（§10 文案：`names` 姓名池 ≥12 个、`greetings`、`reactions`、`narration` 旁白、事件文案）。
文案要求见 02-game-design §10——**这一步是文案创作步，写足写活，不许占位**。

- [x] **Step 4: 确认通过** → **Step 5: 提交** `feat: game data tables and flavour text`

---

### Task 3: state.js — 初始状态与派生查询

**Files:**
- Create: `src/core/state.js`
- Test: `tests/state.test.js`

- [x] **Step 1: 写失败测试**

```js
import { describe, it, expect } from 'vitest';
import { newGame, repLevel, prepCap, ingredientPrice, unlockedIngredients, uncleTitle, epitaph, dailyVerdict } from '../src/core/state.js';

describe('state', () => {
  it('newGame 初始值与 schema 一致', () => {
    const s = newGame(42);
    expect(s).toMatchObject({ seed: 42, day: 1, phase: 'title', money: 120, rep: 0, upgrades: [], loan: null, usedLoan: false, priceMul: 1 });
    expect(s.rng).toHaveProperty('s');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // 可序列化
  });
  it('repLevel 阈值', () => {
    expect(repLevel(0).title).toBe('路边小摊');
    expect(repLevel(14).title).toBe('路边小摊');
    expect(repLevel(15).title).toBe('巷口熟客');
    expect(repLevel(120).title).toBe('全城最强杂菜饭');
  });
  it('prepCap 无锅 16 有锅 24', () => {
    const s = newGame(1);
    expect(prepCap(s)).toBe(16);
    expect(prepCap({ ...s, upgrades: ['wok'] })).toBe(24);
  });
  it('ingredientPrice 受 priceMul 影响且向上取整', () => {
    const s = newGame(1);
    expect(ingredientPrice(s, 'chicken')).toBe(3);
    expect(ingredientPrice({ ...s, priceMul: 1.2 }, 'chicken')).toBe(4); // ceil(3.6)
  });
  it('解锁: rep 0 无 curry, rep 15 有', () => {
    expect(unlockedIngredients(0).some(i => i.id === 'curry')).toBe(false);
    expect(unlockedIngredients(15).some(i => i.id === 'curry')).toBe(true);
  });
  it('uncleTitle 人设标签优先级（02-game-design §9.1）', () => {
    const stats = (over) => ({ totalServed: 100, slashCount: 0, walkoutCount: 0, ...over });
    expect(uncleTitle(stats({ slashCount: 45 }), 50, 500).id).toBe('shark');   // slashRate 0.45 ≥ 0.4
    expect(uncleTitle(stats({ walkoutCount: 25 }), 50, 500).id).toBe('awkward'); // walkoutRate 0.25 ≥ 0.2
    expect(uncleTitle(stats({ slashCount: 2 }), 60, 500).id).toBe('kind');     // slashRate 0.02, rep≥60
    expect(uncleTitle(stats(), 20, 150).id).toBe('broke');                    // money<200 且 rep<30
    expect(uncleTitle(stats({ slashCount: 10 }), 40, 400).id).toBe('worldly'); // 均不命中，默认
  });
  it('epitaph 墓志铭优先级（02-game-design §9.2）', () => {
    const stats = (over) => ({ totalServed: 100, slashCount: 0, walkoutCount: 0, ...over });
    expect(epitaph(2, stats()).id).toBe('early');                    // day ≤ 2
    expect(epitaph(4, stats({ slashCount: 35 })).id).toBe('karma');  // slashRate 0.35 ≥ 0.3
    expect(epitaph(6, stats()).id).toBe('soClose');                  // day ≥ 6
    expect(epitaph(4, stats({ slashCount: 5 })).id).toBe('honest');  // day 3~5 且非高 slash
    expect(epitaph(1, stats({ slashCount: 50 })).id).toBe('early');  // day≤2 优先于 karma
  });
  it('dailyVerdict 三档判定（02-game-design §9.3）', () => {
    expect(dailyVerdict({ revenue: 50, spend: 20, repDelta: 1 })).toBe('good');
    expect(dailyVerdict({ revenue: 20, spend: 50, repDelta: 0 })).toBe('bad');
    expect(dailyVerdict({ revenue: 30, spend: 30, repDelta: -4 })).toBe('bad'); // repDelta<-3 优先
    expect(dailyVerdict({ revenue: 30, spend: 28, repDelta: 0 })).toBe('ok');
  });
});
```

- [x] **Step 2: 确认失败** → **Step 3: 按 03-architecture §3/§4 实现** → **Step 4: 通过** → **Step 5: 提交** `feat: game state and derived queries`

---

### Task 4: economy.js — 报价与结算

**Files:**
- Create: `src/core/economy.js`
- Test: `tests/economy.test.js`

- [x] **Step 1: 写失败测试（关键用例，其余见 04-test-plan §3/economy）**

```js
import { describe, it, expect } from 'vitest';
import { dishCost, orderBase, quotePrices, settleDay } from '../src/core/economy.js';
import { newGame } from '../src/core/state.js';

describe('economy', () => {
  it('成本与基准价', () => {
    expect(dishCost('curryChicken')).toBe(4);
    expect(orderBase(['stirVeg', 'friedWing'])).toBe(7); // 1+2+4
  });
  it('三档报价', () => {
    expect(quotePrices(['stirVeg', 'friedWing'])).toEqual({ kind: 6, normal: 7, slash: 11 });
  });
  it('kind 不低于成本+1', () => {
    const q = quotePrices(['stirVeg']); // base 3, cost 2 → kind = max(3, round(2.4)) = 3
    expect(q.kind).toBeGreaterThanOrEqual(dishCost('stirVeg') + 1 + 1); // cost含米=2
  });
  it('结算顺序: 剩菜作废→房租→贷款利息→破产判定', () => {
    let s = { ...newGame(1), phase: 'service', money: 20, cooked: { stirVeg: 5 }, loan: { repaid: 0 }, usedLoan: true, service: { queue: [], index: 0, current: null, step: 'meet', offer: null, lastOutcome: null } };
    s = settleDay(s);
    // 20 - 25(租) - 10(息) = -15 → 已用过贷款 → gameover
    expect(s.phase).toBe('gameover');
  });
  it('首次破产触发贷款续命', () => {
    let s = { ...newGame(1), phase: 'service', money: 10, cooked: {}, service: { queue: [], index: 0, current: null, step: 'meet', offer: null, lastOutcome: null } };
    s = settleDay(s);
    expect(s.money).toBe(10 - 25 + 100); // 85
    expect(s.usedLoan).toBe(true);
    expect(s.loan).toEqual({ repaid: 0 });
    expect(s.phase).toBe('settle');
  });
  it('冰箱保留 floor(60%)', () => {
    let s = { ...newGame(1), phase: 'service', money: 100, upgrades: ['fridge'], cooked: { stirVeg: 5, friedWing: 1 }, service: { queue: [], index: 0, current: null, step: 'meet', offer: null, lastOutcome: null } };
    s = settleDay(s);
    expect(s.carryOver).toEqual({ stirVeg: 3 }); // 5*0.6=3, 1*0.6=0 剔除
  });
});
```

注意：`settleDay(state)` 是纯函数，收档事件的随机判定用 state.rng；`carryOver` 字段存
入 state，次日 START_DAY 时并入 cooked。**测试中的注释算式必须逐条核对 02-game-design §8 顺序。**

- [x] **Step 2: 确认失败** → **Step 3: 实现** → **Step 4: 通过** → **Step 5: 提交** `feat: pricing and daily settlement`

---

### Task 5: customers.js — 顾客生成与报价反应

**Files:**
- Create: `src/core/customers.js`
- Test: `tests/customers.test.js`

- [x] **Step 1: 写失败测试（关键用例）**

```js
import { describe, it, expect } from 'vitest';
import { generateQueue, resolveQuote, findSubstitute } from '../src/core/customers.js';
import { createRng } from '../src/core/rng.js';

const baseCtx = (over = {}) => ({ rep: 0, cooked: { stirVeg: 9, friedWing: 9 }, todayEvent: null, upgrades: [], ...over });

describe('customers', () => {
  it('点单只点已备菜品、每单至少一道荤(有荤时)', () => {
    const rng = createRng(5);
    const q = generateQueue(baseCtx(), 10, rng);
    for (const c of q) {
      expect(c.dishes.length).toBeGreaterThan(0);
      for (const d of c.dishes) expect(['stirVeg', 'friedWing']).toContain(d);
      expect(c.dishes).toContain('friedWing'); // 唯一荤菜必点
    }
  });
  it('rep 0 不出现高解锁顾客', () => {
    const rng = createRng(6);
    const q = generateQueue(baseCtx(), 50, rng);
    for (const c of q) expect(['student', 'worker', 'ahma', 'uncle2']).toContain(c.type);
  });
  it('influencer + kind → rep +6 必付款', () => {
    const rng = createRng(1);
    const cust = { type: 'influencer', name: 'x', dishes: ['stirVeg'] };
    const out = resolveQuote(cust, 'kind', rng);
    expect(out.paid).toBe(true);
    expect(out.repDelta).toBe(6);
  });
  it('ahma + slash → 进入砍价', () => {
    const rng = createRng(1);
    const out = resolveQuote({ type: 'ahma', name: 'x', dishes: ['stirVeg'] }, 'slash', rng);
    expect(out.haggle).toBe(true);
  });
  it('替代菜同类优先, 无同类返回 null', () => {
    expect(findSubstitute('friedWing', { braisedPork: 2 })).toBe('braisedPork'); // 同 meat
    expect(findSubstitute('friedWing', { stirVeg: 2 })).toBe(null);
  });
});
```

`resolveQuote(customer, tier, rng)` 返回 `{ paid, price, repDelta, haggle?, line }`（line 从 LINES.reactions 抽取）。

- [x] **Step 2: 确认失败** → **Step 3: 按 02-game-design §4 反应矩阵实现** → **Step 4: 通过** → **Step 5: 提交** `feat: customer generation and quote reactions`

---

### Task 6: events.js — 随机事件

**Files:**
- Create: `src/core/events.js`
- Test: `tests/events.test.js`

- [x] **Step 1: RED**：按 04-test-plan §3/day 中事件相关用例先写 `rollOpenEvent(state, rng)`（0.35 概率 + 条件过滤 + weighted）与 `rollCloseEvents(state, rng)`（inspection/catSteal）的测试：概率打桩用固定 seed 扫描（对 1000 个 seed 统计触发率在 [0.30, 0.40]）；rep<55 永不出 tv。
- [x] **Step 2: 确认失败** → **Step 3: 实现** → **Step 4: 通过** → **Step 5: 提交** `feat: open/close random events`

---

### Task 7: day.js — 日循环状态机（核心，最大任务）

**Files:**
- Create: `src/core/day.js`
- Test: `tests/day.test.js`

- [x] **Step 1: RED — 快乐路径 + 防御路径**

```js
import { describe, it, expect } from 'vitest';
import { reduce } from '../src/core/day.js';
import { newGame } from '../src/core/state.js';

const d = (s, type, payload) => reduce(s, { type, ...payload });

describe('day state machine', () => {
  it('完整一天快乐路径', () => {
    let s = newGame(42);
    s = d(s, 'START_DAY');
    expect(s.phase).toBe('morning');
    s = d(s, 'BUY', { id: 'veg', qty: 4 });
    s = d(s, 'BUY', { id: 'chicken', qty: 4 });
    expect(s.money).toBe(120 - 4 - 12);
    s = d(s, 'FINISH_MORNING');
    s = d(s, 'COOK', { id: 'stirVeg', qty: 4 });
    s = d(s, 'COOK', { id: 'friedWing', qty: 4 });
    expect(s.inventory.veg).toBe(0);
    s = d(s, 'OPEN_STALL');
    expect(s.phase).toBe('service');
    expect(s.service.queue.length).toBeGreaterThanOrEqual(3);
    let guard = 0;
    while (s.phase === 'service' && guard++ < 100) {
      if (s.service.step === 'meet') s = d(s, s.service.canServe ? 'SERVE' : 'APOLOGIZE');
      else if (s.service.step === 'pricing') s = d(s, 'QUOTE', { tier: 'normal' });
      else if (s.service.step === 'haggle') s = d(s, 'HAGGLE', { accept: true });
      else if (s.service.step === 'result') s = d(s, 'NEXT_CUSTOMER');
    }
    expect(s.phase).toBe('settle');
    s = d(s, 'ACK_SETTLE'); // day 1 < GAME_DAYS(7) → 直接进 shop
    expect(s.phase).toBe('shop');
    s = d(s, 'END_SHOP');
    expect(s.day).toBe(2);
    expect(s.phase).toBe('morning');
  });
  it('非法动作返回原 state', () => {
    let s = newGame(1);
    s = d(s, 'START_DAY');
    expect(d(s, 'QUOTE', { tier: 'kind' })).toBe(s);
    expect(d(s, 'BUY', { id: 'prawn', qty: 1 })).toBe(s); // 未解锁
    expect(d(s, 'BUY', { id: 'chicken', qty: 999 })).toBe(s); // 钱不够
  });
  it('COOK 超容量拒绝', () => {
    let s = d(newGame(1), 'START_DAY');
    s = d(s, 'BUY', { id: 'egg', qty: 20 });
    s = d(s, 'FINISH_MORNING');
    // braisedEgg 需要 braise——直接用只需单食材的菜测容量: 先补买不了了(阶段已过) → 用 veg 单配方菜
    // 详细容量场景按 04-test-plan §3/day #3 编写
  });
  it('第 7 天结算后直接进结局，不再逛商店', () => {
    let s = { ...newGame(1), day: 7, phase: 'settle', money: 300, rep: 40, upgrades: ['wok'] };
    s = d(s, 'ACK_SETTLE');
    expect(s.phase).toBe('ending');
    expect(s.money).toBe(300);
    expect(s.rep).toBe(40); // ending 页面只是展示，不改数值
  });
  it('day < 7 时正常进商店，不提前结束', () => {
    let s = { ...newGame(1), day: 3, phase: 'settle', rep: 122 }; // 即便 rep 已超 120
    s = d(s, 'ACK_SETTLE');
    expect(s.phase).toBe('shop'); // 只有 day===GAME_DAYS 才会进 ending，rep 高低不影响这个判断
  });
});
```

（`state.service.canServe` 为 reducer 在进入 meet 步时预计算的布尔字段，UI 与测试共用。）

- [x] **Step 2: 确认失败**
- [x] **Step 3: GREEN — 分三个子提交实现**
  1. `morning/prep`（START_DAY 含 carryOver 并入与 priceMul 复位、BUY/FINISH_MORNING/COOK）→ commit `feat: day machine - morning and prep`；
  2. `service`（OPEN_STALL 生成队列含 helper 自动单、SERVE/OFFER_SUB/APOLOGIZE/QUOTE/HAGGLE/NEXT_CUSTOMER，出餐即扣 cooked/stats 累计）→ commit `feat: day machine - service loop`；
  3. `settle/shop/ending`（调 economy.settleDay、`ACK_SETTLE` 的 day===GAME_DAYS 判断、BUY_UPGRADE、END_SHOP 的 day+1）→ commit `feat: day machine - settle shop ending`。
- [x] **Step 4: 补齐 04-test-plan §3/day 全部 8 组用例并通过** `npx vitest run tests/day.test.js`
- [x] **Step 5: 全量回归** `npm test` → PASS → 最终 commit `test: complete day machine coverage`

---

### Task 8: highscore.js — 历史最高分（不做中局存档）

**Files:**
- Create: `src/core/highscore.js`
- Test: `tests/highscore.test.js`

- [x] **Step 1: RED**（04-test-plan §3/highscore 全部 3 组）

```js
import { describe, it, expect } from 'vitest';
import { recordResult } from '../src/core/highscore.js';

describe('highscore', () => {
  it('首次记录必定生效', () => {
    const result = { score: 300, grade: 'A', uncleTitleId: 'worldly' };
    expect(recordResult(null, result, 1000)).toEqual({ ...result, achievedAt: 1000 });
  });
  it('刷新纪录：新分数更高才覆盖', () => {
    const existing = { score: 300, grade: 'A', uncleTitleId: 'worldly', achievedAt: 1000 };
    const better = { score: 400, grade: 'S', uncleTitleId: 'kind' };
    expect(recordResult(existing, better, 2000)).toEqual({ ...better, achievedAt: 2000 });
  });
  it('新分数不如旧纪录，原样返回，不改 achievedAt', () => {
    const existing = { score: 300, grade: 'A', uncleTitleId: 'worldly', achievedAt: 1000 };
    const worse = { score: 250, grade: 'B', uncleTitleId: 'broke' };
    expect(recordResult(existing, worse, 2000)).toBe(existing); // 原样返回同一引用
  });
});
```

- [x] **Step 2: 确认失败** → **Step 3: 按 03-architecture §6 实现**（`recordResult` 是唯一导出，无需
  version/migrate/RNG 这些概念）→ **Step 4: 通过** → **Step 5: 提交** `feat: highscore recording (no mid-game save)`

---

### Task 9: sim.js — 千局平衡模拟与调参

**Files:**
- Create: `src/core/sim.js`（bot 策略 + runSeason(bot, seed) → 终局摘要）
- Test: `tests/sim.test.js`

- [x] **Step 1: 实现三个 bot**（reasonableBot / lazyBot / slasherBot，行为定义见 04-test-plan §3/sim），bot = 纯函数 `(state) → action`，与 reducer 对跑一局 7 天（GAME_DAYS，与游戏内实际长度一致）。
- [x] **Step 2: 写基线断言**（02-game-design §11，**目标是 30%~40% 存活率，不是高存活率**），各 500 seed。
- [x] **Step 3: 跑模拟。若 `reasonableBot` 存活率明显偏离 [0.3, 0.4]** → 按 02-game-design §11
  的"调参方向提示"调 `data.js` 数值（优先调 `RENT_PER_DAY`、事件惩罚力度，而非 `START_MONEY`），
  禁止改公式结构；每轮调整记录到 `docs/02-game-design.md` §11 并同步表格数值。
  **这是本项目质量的核心闸门，不许跳过——"失败是常态"这个设计目标就靠这一步校准出来。**
- [x] **Step 4: `npm test` 全绿** → **Step 5: 提交** `feat: balance simulation bots and tuning (30~40% survival target)`

---

### Task 9b: 美术资产生成与接入（像素风，见 02-game-design §12）—— **已废弃**

> **状态：已废弃。** 根据 `docs/08-change-requests.md` CR-02 定案，视觉方案改为全 emoji、不生成/接入外部美术资产（像素画方案废弃）。以下步骤保留仅供历史参照，**不得执行**；`data.test.js` 已固化"emoji 视觉、不依赖外部美术资产"的断言，`src/ui/dom.js` 注释同步说明。

不是 TDD 任务（没有可断言的"正确画面"），按流程步骤执行，产出是 `assets/` 目录与 `data.js` 的
`img` 字段。这个任务在 Task 10（UI）之前完成，因为 UI 渲染需要读到这些路径。

**Files:**
- Create: `assets/scenes/cover.webp`, `assets/scenes/counter.webp`,
  `assets/dishes/<12 个 dishId>.webp`, `assets/customers/<7 个 typeId>.webp`
- Modify: `src/core/data.js`（每个 dish/customerType 对象新增 `img` 字段）

- [ ] **Step 1: 生成风格锚点图**：用 `fal-ai/nano-banana-pro`，prompt 按 02-game-design §12.1
  的风格基调 + 调色板色号，先出 `scenes/cover.webp`（食阁全景，构图最复杂，用来定调）。
  人工确认风格满意（复古像素颗粒感、配色贴近 kopitiam 主题）再继续，不满意就换 prompt 重出，
  不将就——这张图是后续 20 张的风格基准。
- [ ] **Step 2: 用锚点图做 image-to-image，批量生成剩余 20 张**（`counter.webp` + 12 张菜品 +
  7 张顾客），每张都上传锚点图作为 `image_url` 参考，prompt 只描述"画什么"（具体菜品/顾客特征，
  参照 02-game-design §3/§4.1 的名称与特性），风格部分交给参考图保持一致。
- [ ] **Step 3: 人工过一遍风格一致性**，抽查调色板是否跑偏、构图是否符合 §12.2 的要求
  （菜品无背景干扰、顾客证件照式构图）；不合格的单张重新生成，不需要推倒重来全部。
- [ ] **Step 4: 用 `cwebp`（Google libwebp 官方 CLI，不需要现造压缩脚本）转 WebP 并逐张确认 ≤15KB**：

```bash
cwebp -q 80 dishes/curryChicken.png -o assets/dishes/curryChicken.webp
# 超标则调低 -q（如 -q 60），或在生成阶段就降低分辨率重新导出；≤15KB 是硬指标不能放宽
```

见 03-architecture §10 的预算推导。
- [ ] **Step 5: `data.js` 补 `img` 字段**，每个 dish/customerType 对象加一行 `img: 'assets/.../<id>.webp'`。
- [ ] **Step 6: 提交** `feat: pixel-art assets for dishes, customers, and stall scenes`

---

### Task 10: UI 层（dom.js → screens.js → app.js）

**Files:**
- Create: `src/ui/dom.js`, `src/ui/screens.js`, `src/ui/app.js`
- Modify: `index.html`（仅一处：`<script src="game.js">` → `<script type="module" src="src/ui/app.js">`）

UI 不写单测（04-test-plan §1 的刻意取舍），验收靠 Task 11 E2E。类名契约见 03-architecture §8。

- [x] **Step 1: dom.js** — `h(tag, attrs, ...children)` 建元素、`toast(msg)`、`renderHud(state)`（天数「第N/7天」/💰/⭐/声望条与称号）、`setScreen(nodes)`、`setActions(buttons)`。
- [x] **Step 2: screens.js** — 每 phase 一个函数：
  - `renderTitle`（封面：只有「开始经营」一个按钮，**没有"继续游戏"**，文案提示"本局约 15~20 分钟，不支持中途保存，大概率会破产，这是设计如此"，叠加 `scenes/cover.webp` 背景）；
  - `renderMorning`（食材 stepper 列表，未解锁项隐藏，emoji 图标；顶部展示 `dailyCustomerCount(state)` 算出的"预计客流：约 N±2 位"预热文案，见 02-game-design §9.3）；
  - `renderPrep`（菜品 stepper，`.item-emoji` 位置用 `<img src="dish.img" onerror="回退成 emoji 文本">`，容量进度显示，同样展示预计客流）；
  - `renderService`（叠加 `scenes/counter.webp` 背景；`.customer-face` 用顾客 `img` 字段 + onerror 回退；按 service.step 渲染顾客卡/报价三按钮[含金额与 `.btn-sub` 提示]/砍价/结果）；
  - `renderSettle`（`.ledger` 报表 + 事件文案 + `dailyVerdict(state.today)` 对应的一行手感评价，见 02-game-design §9.3）；
  - `renderShop`（升级卡 + 「开始新的一天」）；
  - `renderEnding`（撑过 7 天：评分 + Uncle 人设标签 + 历史最佳对比 + 「再来一局」按钮，见 02-game-design §9/§9.1）；
  - `renderGameover`（破产：`epitaph(state.day, state.stats)` 的称号 + 墓志铭 + 撑到第几天 + 「再来一局」，**不显示评分/人设标签/历史最佳**，见 02-game-design §9.2）。

  全部只读 state + dispatch，价格金额一律调 `economy.quotePrices`。
- [x] **Step 3: app.js** — 唯一 state、`dispatch(action) = state = reduce(state, action); render(state)`（**不做每次 dispatch 持久化**）；**只在 `phase==='ending'`**（不含 gameover）渲染前读一次 `caipng.highscore`、渲染后用 `highscore.recordResult` 写回一次；`?seed=` URL 参数支持；`window.onerror` toast 兜底；`window.addEventListener('beforeunload', ...)`，当 `state.phase` 不属于 `'title'/'ending'/'gameover'` 时 `preventDefault()` 弹确认框（见 03-architecture §7）。
- [x] **Step 4: 手动冒烟** `npm run serve` → 手机模拟器跑完整 7 天流程直到 ending，六阶段截图自查
  （含结局页），确认 21 张像素画正常显示；顺手把某张图路径改错测一下 onerror 回退 emoji 是否生效；
  再手动构造一局中途破产，确认走到 gameover 显示墓志铭而不是评分页；中途尝试刷新页面确认弹出
  beforeunload 确认框。
- [x] **Step 5: 提交** `feat: mobile ui layer`

---

### Task 11: E2E（Playwright）

**Files:**
- Create: `e2e/playthrough.spec.js`

- [ ] **Step 1: 按 04-test-plan §4 写全部 8 个场景**（固定 seed 走 `?seed=42`；场景 4 缺菜路径、
  场景 6 存活结局、场景 7 破产结局的 seed 都需要实际跑出后固化并注释原因；场景 6/7 需要快进
  跑完 7 天/跑到 gameover，可直接在测试里连续 dispatch/点击而非手工模拟每一步）。
- [ ] **Step 2: `npm run e2e` 全绿**，screenshots 产出 7 张（含 ending 与 gameover 两个结局页）。
- [ ] **Step 3: 提交** `test: e2e mobile playthrough incl. death path`

---

### Task 12: CI/CD 与上线

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: workflow**（push/PR → `npm ci && npm test`；main 绿 → 上传 Pages artifact 并部署，用官方 `actions/deploy-pages`，部署内容 = 仓库根目录静态文件）。
- [ ] **Step 2: 建远程仓库并推送**

```bash
gh repo create caipng-uncle --public --source . --push
```

- [ ] **Step 3: 启用 Pages（workflow 方式）**：repo Settings→Pages source 设为 GitHub Actions（`gh api repos/{owner}/caipng-uncle/pages -X POST -f build_type=workflow` 或首次 workflow 自动创建）。
- [ ] **Step 4: 验证线上**：`curl -sI https://<owner>.github.io/caipng-uncle/ | head -1` → `HTTP/2 200`；真机打开可玩。
- [ ] **Step 5: 打 tag** `git tag v1.0.0 && git push --tags`

---

### Task 13: 上线验收与收尾

- [ ] 执行 04-test-plan §6 手工验收清单（真机）；
- [ ] 文案通读打磨一轮（只改 data.js 的 LINES，改后 `npm test` 回归）；
- [ ] README.md：游戏简介 + 线上链接 + 截图 + 开发命令 + **克隆后执行
  `git config core.hooksPath .githooks` 才能启用本地 pre-commit 门禁**（Task 0 Step 6）；commit `docs: readme`；
- [ ] 向用户汇报线上 URL 与验收证据（测试输出、截图、curl 结果）。

---

## Self-Review 记录

- 覆盖检查：PRD F1~F13、F16~F18 均有对应任务（F1/F13→Task10，F2→Task7，F3/F4→Task2，F5/F6→Task5，F7→Task3，F8→Task7/2，F9→Task6，F10→Task4，F11/F12→Task8+Task10，F16→Task9b+Task10，F17→Task3+Task10（epitaph），F18→Task10（beforeunload））；F14/F15 明确 v1.1 不在本计划。
- 签名一致性：测试代码中的 `createRng/newGame/reduce/settleDay/quotePrices/generateQueue/resolveQuote/findSubstitute/recordResult/epitaph/dailyVerdict` 与 03-architecture §4/§5/§6 及各任务实现步骤逐一核对一致（不再有 serialize/deserialize/migrate 这套——已随 grilling 会话废弃中局存档设计）；`state.service.canServe` 与 `state.carryOver` 两个补充字段已在 Task 7/Task 4 说明并需同步进 03-architecture §3 schema（执行 Task 4 时顺手更新文档）。
- 占位符扫描：Task 6/9/10 的实现步骤为契约引用式（完整行为定义在 02/03/04 文档对应小节，非 TBD）；测试代码均为可运行断言。
