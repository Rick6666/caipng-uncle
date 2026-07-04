# 《杂菜饭 Uncle》技术架构与接口契约（Architecture & Tech Spec）

> 本文档定义模块边界、状态 schema、函数签名与持久化格式（本项目只持久化历史最高分，不做中局存档）。
> 执行 Agent 实现时**签名与字段名必须与本文档逐字一致**（05-implementation-plan 中的测试代码依赖这些名字）。

## 1. 顶层设计决策（ADR 摘要）

| # | 决策 | 理由 |
|---|---|---|
| ADR-1 | 运行时零依赖：原生 ES Modules，无框架无打包器 | 加载快；静态托管永不过期；无构建链腐烂风险；游戏体量（~2k 行）撑不起框架成本。**v1.4 修订**：允许一批体积受控的像素风美术资产（见 02-game-design §12、本文档 §10），"零依赖"指的是零 JS 运行时依赖/零构建链，不等于零图片——两者是不同维度的取舍 |
| ADR-2 | core / ui 强分层：`src/core/` 纯函数、零 DOM | TDD 前提；Node 环境直接可测；UI 可整体重写不动逻辑 |
| ADR-3 | Reducer 模式：`(state, action) → state`，state 不可变更新 | 确定性、可回放、易断言；纯函数是 TDD 与千局模拟的前提，与是否持久化无关 |
| ADR-4 | 可注入种子 RNG，RNG 状态存进 state | 测试确定性；千局模拟可复现；支持 `?seed=` 分享挑战局（不再服务于"存档恢复"——本项目不支持中局存档，见 §6） |
| ADR-5 | 开发依赖仅 Vitest + Playwright；CI = GitHub Actions；托管 = GitHub Pages | 免费、零运维、与 gh 账号现状匹配 |
| ADR-6 | 全部文案与数值集中 `data.js` | 文案/数值迭代不触碰逻辑；平衡调整单点修改 |

## 2. 目录结构

```
caifan/
├── index.html              # 入口（已有骨架，需把 script 改为 type="module" src="src/ui/app.js"）
├── style.css               # 全局样式（已有 kopitiam 风格骨架，类名契约见 §8）
├── assets/                 # 像素风美术资产（见 02-game-design §12，WebP，单图 ≤15KB）
│   ├── dishes/              # <dishId>.webp，12 张
│   ├── customers/           # <typeId>.webp，7 张
│   └── scenes/              # cover.webp、counter.webp
├── src/
│   ├── core/               # 纯逻辑层：禁止 import 任何 ui/ 文件、禁止触碰 document/window/localStorage
│   │   ├── rng.js          # 可序列化随机数生成器
│   │   ├── data.js         # 静态数据表（食材/菜品/顾客/事件/升级/等级/文案），与 02-game-design 一致；
│   │   │                   #   菜品/顾客对象含 `img` 字段（assets/ 相对路径，见 02-game-design §12）
│   │   ├── state.js        # newGame() 初始状态、声望等级/客流/容量等派生查询
│   │   ├── economy.js      # 报价三档、成本核算、结算
│   │   ├── customers.js    # 顾客生成、点单、报价反应、缺菜替代
│   │   ├── events.js       # 开档/收档事件判定
│   │   ├── day.js          # 日循环状态机 reducer（唯一的 state 变更入口）
│   │   └── highscore.js    # 历史最高分记录判定（纯函数，不直接碰 localStorage，见 §6）
│   └── ui/                 # 表现层：禁止包含任何数值规则
│       ├── app.js          # 入口：初始化新局、dispatch 循环、历史最高分 localStorage 读写
│       ├── screens.js      # 每个 phase 一个 render 函数
│       └── dom.js          # h() 建元素、toast、HUD 更新等工具
├── tests/                  # Vitest 单测（镜像 core 模块名）
│   ├── rng.test.js
│   ├── economy.test.js
│   ├── customers.test.js
│   ├── day.test.js
│   ├── highscore.test.js
│   └── sim.test.js         # 千局平衡模拟（含 bot 策略）
├── e2e/
│   └── playthrough.spec.js # Playwright 手机视口全流程
├── docs/                   # 本套文档
├── .githooks/pre-commit    # 受版本控制的 pre-commit hook（需 `git config core.hooksPath .githooks` 启用，见 07-workflow-rules §6）
├── package.json            # "type": "module"; devDeps: vitest, @playwright/test
├── vitest.config.js
├── playwright.config.js
└── .github/workflows/ci.yml
```

## 3. 状态 Schema（单一 state 对象）

```js
// 由 newGame(seed) 构造；单局内使用，不做跨局持久化（见 §6）
{
  seed: 12345,             // 初始种子（展示用，也是 ?seed= 分享挑战局的值）
  rng: { s: 305419896 },   // RNG 当前内部状态
  day: 1,                  // 当前天数（1~GAME_DAYS=7）
  phase: 'title',          // 'title'|'morning'|'prep'|'service'|'settle'|'shop'|'ending'|'gameover'
  money: 120,
  rep: 0,
  inventory: {},           // { [ingredientId]: 数量 } 生食材库存
  cooked: {},              // { [dishId]: 份数 } 当日熟菜
  upgrades: [],            // 已购升级 id 数组
  loan: null,              // null | { repaid: 0 }  repaid 累计还款，>= LOAN_REPAY 后置回 null
  usedLoan: false,         // 是否用过贷款（用过再破产 = 本局结束）
  priceMul: 1,             // 当日食材价格倍率（marketUp 事件写 1.2，次日结算后复位 1）
  todayEvent: null,        // 当日开档事件 id 或 null
  service: null,           // 营业阶段运行时（见下），非营业阶段为 null
  today: {                 // 当日流水（结算展示用，每天 morning 重置）
    revenue: 0, spend: 0, served: 0, lost: 0, repDelta: 0, log: []
  },
  stats: {                 // 本局唯一统计（结局评分 + uncleTitle 用，从 newGame 起累计到第 7 天）
    totalServed: 0, totalRevenue: 0, bestDayRevenue: 0, slashCount: 0, walkoutCount: 0
  }
}

// state.service（营业中）
{
  queue: [Customer, ...],   // 今日顾客队列（开档时一次性生成）
  index: 0,                 // 当前第几位
  current: Customer|null,   // 正在服务的顾客
  step: 'meet'|'substitute'|'pricing'|'haggle'|'result',  // 子状态
  offer: null,              // 缺菜时推荐的替代菜 id
  lastOutcome: null         // 上一次报价结果（result 步展示）
}

// Customer 对象（customers.js 生成）
{
  type: 'student',          // customerTypes id
  name: '阿伟',             // 从 data.lines 姓名池抽取
  dishes: ['stirVeg', 'friedWing'],  // 点单（生成时快照）
  greeting: '...',          // 进场台词
}
```

## 4. Action 协议（day.js reducer 全量动作表）

`reduce(state, action) → newState`（纯函数，内部使用 state.rng 且把新 rng 状态写回）。
非法动作（如钱不够、阶段不符）**返回原 state 并在 `state.today.log` 不留痕**——UI 层负责禁用非法按钮，reducer 只做兜底防御。

| action.type | payload | 阶段约束 | 语义 |
|---|---|---|---|
| START_DAY | — | title/shop→morning | 进入清晨；重置 today、cooked（含冰箱保留）、判定开档事件与今日客数 |
| BUY | { id, qty } | morning | 购买食材（qty 可为负 = 退回当日刚买的，退款；不可退到低于当日购买量） |
| FINISH_MORNING | — | morning→prep | 进入备菜 |
| COOK | { id, qty } | prep | 烹饪 qty 份（负数=退回食材）；受 prepCap 限制 |
| OPEN_STALL | — | prep→service | 开档：生成顾客队列（含 helper 自动单），进入第一位顾客 meet |
| SERVE | — | service.meet | 有菜出餐 → step='pricing' |
| OFFER_SUB | — | service.meet | 缺菜推荐替代 → 判定接受与否 |
| APOLOGIZE | — | service.meet/substitute | 道歉送客 → 下一位 |
| QUOTE | { tier } | service.pricing | tier ∈ 'kind'/'normal'/'slash'；阿嬷+slash → step='haggle'，否则出结果 |
| HAGGLE | { accept } | service.haggle | 阿嬷砍价：accept=true 收正常价 / false 赌一把 |
| NEXT_CUSTOMER | — | service.result | 下一位；队列空 → 执行 §8 结算（含 today/stats 累计），二次破产直接 `phase='gameover'`（展示 02-game-design §9.2 墓志铭），否则 `phase='settle'` |
| ACK_SETTLE | — | settle | `day === GAME_DAYS ? phase='ending' : phase='shop'`——第 7 天结算完直接进结局，不再逛商店 |
| BUY_UPGRADE | { id } | shop | 购买升级 |
| END_SHOP | — | shop | → START_DAY 前置（day+1）。只会在 day < GAME_DAYS 时被调用，无需再判断天数 |
| NEW_GAME | { seed? } | 任意 | 全新开局（唯一能"回到游戏"的方式，不存在"继续游戏"） |

派生查询（`state.js` 导出，供 UI 与测试使用，均为纯函数）：

```js
repLevel(rep)        // → { threshold, title, index }
prepCap(state)       // → 16 | 24
dailyCustomerCount(state)  // 开档时已算好存入 service 队列长度，此函数供预览
ingredientPrice(state, id) // 含 priceMul
dishCost(dishId)     // 配方成本和
orderBase(dishes)    // RICE_PRICE + Σ 基准价
quotePrices(dishes)  // → { kind, normal, slash } 三档金额（economy.js 亦可，定一处：economy.js）
unlockedIngredients(rep) / unlockedDishes(rep) / unlockedCustomerTypes(rep)
uncleTitle(stats, rep, money)  // → { id, title, flavor }，存活结局页用；纯展示，见 02-game-design §9.1
finalScore(state)     // → state.money + state.rep×5，存活结局评分，见 02-game-design §9
epitaph(day, stats)   // → { id, title, line }，破产结局（gameover）用；纯展示，见 02-game-design §9.2
dailyVerdict(today)   // → 'good'|'bad'|'ok' 三档，结算报表当日手感评价，见 02-game-design §9.3
```

## 5. RNG 契约（rng.js）

```js
// mulberry32；状态单一 uint32，可序列化
createRng(seedOrState)   // number 种子 或 {s} 状态对象 → rng 实例
rng.next()               // → [0,1) float
rng.int(min, max)        // → 整数，含两端
rng.pick(array)          // → 随机元素
rng.weighted(items)      // items: [{...,weight}] → 按权重抽一个
rng.chance(p)            // → boolean
rng.getState()           // → { s }  （存入 state.rng）
```

core 内**所有**随机必须经由 state.rng（模式：`const rng = createRng(state.rng); ...; newState.rng = rng.getState()`）。
禁止 `Math.random`（ESLint 不引入，靠 code review + 测试确定性兜底）。

## 6. 持久化契约：只有「历史最高分」，没有中局存档（highscore.js + app.js）

> **不支持暂停/恢复**：关闭或刷新页面 = 本局作废，只能 `NEW_GAME` 重新开始。
> 唯一的持久化是一条极简的"历史最高分"记录，纯粹用于玩家和自己上次的成绩比较，
> 不涉及版本迁移、不涉及 RNG/state 的完整序列化。

- key：`caipng.highscore`；内容：`JSON.stringify(record)`，`record` 形状：
  `{ score: number, grade: 'S'|'A'|'B'|'C', uncleTitleId: string, achievedAt: number }`
  （`achievedAt` 是 `Date.now()`——由 app.js 在结局页那一刻传入，`core/highscore.js` 本身不产生时间戳，
  保持纯函数、可测试）。
- `highscore.js` 导出 `recordResult(existing, result, achievedAt)`：

  ```js
  recordResult(existing, result, achievedAt)
  // existing: record | null （上次读到的历史最高分，读取失败或从未有记录则传 null）
  // result:   { score, grade, uncleTitleId }（本局结局评分，见 02-game-design §9）
  // achievedAt: number（app.js 传入的 Date.now()）
  // → existing === null 或 result.score > existing.score
  //     ? { ...result, achievedAt }   // 刷新纪录
  //     : existing                    // 原样返回，没打破纪录
  ```

- 读写时机（app.js）：**只在 `phase==='ending'`（撑过 7 天）时**触发——渲染前读一次
  `caipng.highscore`（`JSON.parse` 失败或字段缺失 → 当作 `null`，绝不让坏数据卡死游戏），
  结局页展示"历史最佳"与本局对比，渲染完调用 `recordResult` 得到的结果重新写回 localStorage
  （无论是否刷新纪录，写回逻辑一致，简单可靠）。**`phase==='gameover'`（破产）不读写
  historyscore**——墓志铭结局不参与历史最佳分数比较，语义上"死了"不是一个可比较的分数。
- core 不碰 localStorage —— app.js 注入/读取，保证 core 可测。
- 游戏进行中（day 1~7 期间）**完全不写 localStorage**——历史最高分只在存活结局这一个时间点读写一次。

## 7. UI 层协议

- app.js 持有唯一 `let state`；`dispatch(action)` = `state = reduce(state, action); render(state)`
  （不再有每次 dispatch 都写 localStorage 这一步——见 §6，持久化只发生在结局页那一刻）。
- `render(state)` 按 `state.phase`（及 `state.service.step`）分发到 screens.js 的对应函数；每次全量重绘 `#screen` 与 `#actions`（体量小，无需 diff）。
- screens.js 只读 state + 调用 dispatch，**不得内联任何数值规则**（如价格计算必须调 economy.js 查询函数）。
- HUD（天数/钱/声望/声望条）每次 render 同步更新；金钱变动用 toast 飘字反馈。
- **`beforeunload` 退出确认**（v1.5 新增）：`state.phase` 不属于 `'title'/'ending'/'gameover'` 时，
  监听 `window.beforeunload` 并 `e.preventDefault(); e.returnValue = ''`，触发浏览器原生确认框——
  防止手滑刷新/关闭页面团灭当前进度（不做真正的存档，只是一道"确定要走吗"的提醒，
  见 02-game-design 中关于误触退出的讨论）。

## 8. 既有 UI 骨架契约（index.html / style.css 已存在）

已有文件是可用的视觉骨架，UI 任务在其上开发，**不推倒重来**。可用类名（详见 style.css）：

- 布局：`#hud` `#rep-bar-fill` `#rep-title` `#screen` `#actions` `#toast-layer` `.hidden`
- 组件：`.card` `.item-row`（`.item-emoji/.item-info/.item-name/.item-desc/.item-count` + `.stepper`）
- 顾客：`.customer-card` `.customer-face` `.customer-name` `.customer-type` `.speech` `.order-list` `.order-chip(.missing)`
- 按钮：`.btn` + `.btn-primary/.btn-green/.btn-plain/.btn-gold`，副文案 `.btn-sub`
- 其他：`.phase-tag` `.narrative` `.ledger`（结算表）`.upg-row` `.toast` `.cover`（封面）

index.html 需要的唯一改动：`<script src="game.js">` → `<script type="module" src="src/ui/app.js">`。

**像素画接入点**（v1.4 新增，不改变现有类名契约，只是在这些位置从纯 emoji 文本升级为
"图片 + onerror 回退 emoji"）：`.item-emoji`（备菜列表的菜品图）、`.customer-face`（顾客卡）、
`.cover`（封面叠加 `scenes/cover.webp` 作为 background-image）、`renderService` 的柜台背景
（叠加 `scenes/counter.webp`）。这几处的具体 CSS（img 尺寸/object-fit）留给 Task 10 实现时定，
不在本文档锁定像素级样式。

## 9. 错误处理与兜底

- reducer 对非法 action 返回原 state（防御性），UI 负责按钮禁用（正向保证）；
- 历史最高分读取失败（`JSON.parse` 异常/字段缺失）→ 当作 `null`，不影响正常游玩（不弹错误）；
- app.js 顶层 `window.onerror` → toast「Uncle 打了个盹，请刷新」，不做上报（无服务端）。

## 10. 性能与兼容预算

- 首屏资源：html+css+js 合计 < 120KB（未压缩）+ `assets/` 像素画合计 ≤ 315KB（21 张 WebP，
  单图 ≤15KB，见 02-game-design §12），总计 < 450KB；无外部字体、无 CDN；
- **预算推导**：3G 网速估算约 750kbps ≈ 94KB/s，5 秒加载预算 ≈ 470KB，扣掉 html/css/js 的
  120KB，留给图片的空间约 350KB——21 张图均摊单图 ≤15KB 是刚好卡在预算内的硬指标，
  不是随意定的，生成/压缩环节超标必须重新压缩，不能挪用其他预算科目；
- **加载策略**：全部 21 张图在 `app.js` 初始化时一次性预加载（体积够小，不值得做懒加载的
  复杂度），加载完成前封面页显示简单的 loading 态；单图加载失败（`<img onerror>`）→
  回退显示该菜品/顾客对应的 emoji（`data.js` 里 emoji 字段本来就在，天然是兜底数据源）；
- 食材（`INGREDIENTS`）不生成美术资产，只用 emoji（见 02-game-design §12.2 的范围边界）；
- `100dvh` 已在 CSS 中使用，`min-height` 回退由 `#app` flex 布局天然兜底；
- 触控：所有按钮 `touch-action: manipulation`（已在骨架 CSS 中）。
