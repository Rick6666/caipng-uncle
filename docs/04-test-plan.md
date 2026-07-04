# 《杂菜饭 Uncle》测试策略（TDD Test Plan）

> 本项目严格 TDD：每个任务先写失败测试（RED），再最小实现（GREEN），再重构。
> 执行 Agent 必须遵守 05-implementation-plan 中每个任务的 RED→GREEN 步骤顺序，禁止先写实现。

## 1. 测试金字塔

| 层 | 工具 | 覆盖对象 | 数量级 |
|---|---|---|---|
| 单元测试 | Vitest（Node 环境，无 jsdom） | `src/core/*` 全部纯函数 | ~60 用例 |
| 平衡模拟 | Vitest 长测（`sim.test.js`） | 整体经济数值 | 3 个 bot 策略 × 500 局 |
| E2E | Playwright（iPhone 13 视口） | 真实浏览器完整 7 天流程 + 历史最高分 + 破产墓志铭 + 截图 | ~8 场景 |

UI 渲染函数**不写单测**（核心逻辑已全覆盖，UI 由 E2E 兜底）——这是刻意取舍，避免脆测试。

## 2. 工具链配置基线

- `package.json`：`"type": "module"`；scripts：`test`（vitest run）、`test:watch`、`e2e`（playwright test）、`serve`（`python3 -m http.server 8000`）。
- `vitest.config.js`：默认 node 环境即可；`sim.test.js` 单独 `testTimeout: 60000`。
- `playwright.config.js`：`webServer` 起 `python3 -m http.server 8000`；project 使用 `devices['iPhone 13']`；失败自动截图。
- 覆盖率目标：`src/core/` 行覆盖 ≥ 85%（`vitest run --coverage`，CI 不强卡，人工看报告）。

## 3. 单元测试用例清单（按模块）

### rng.test.js
1. 同种子两个实例产生完全相同序列（determinism）；
2. `getState()` 后用状态重建实例，序列无缝续接；
3. `int(1,3)` 一万次采样只出现 1/2/3 且各占比 > 20%；
4. `weighted()` 权重 0 的项永不被抽中；权重 9:1 万次采样比例在 [0.85, 0.95]。

### state.test.js（人设标签见 02-game-design §9.1，墓志铭见 §9.2）
1. `uncleTitle`：slashRate ≥0.4 → 奸商 Uncle；walkoutRate ≥0.2 且 slashRate <0.4 → 社死 Uncle；
   slashRate ≤0.05 且 rep≥60 → 良心 Uncle；money<200 且 rep<30 → 苦命 Uncle；均不命中 → 江湖 Uncle；
2. 优先级抽查：同时满足奸商与社死条件时，奸商优先（表格里排在前面的先命中）；
3. `epitaph(day, stats)`：day≤2 → 早夭 Uncle；slashRate≥0.3 → 现世报 Uncle；day≥6 → 一步之遥 Uncle；
   day 3~5 且非高 slash → 苦撑 Uncle；
4. 优先级抽查：day=1 且 slashRate=0.5 时，早夭优先于现世报（day 条件排在表格第一行）；
5. `dailyVerdict(today)`：`{revenue:50,spend:20,repDelta:1}` → 'good'；`{revenue:20,spend:50,repDelta:0}`
   → 'bad'；`{revenue:30,spend:30,repDelta:-4}` → 'bad'（repDelta<-3 优先于收支平衡判定）；
   `{revenue:30,spend:28,repDelta:0}` → 'ok'。

### economy.test.js
1. `dishCost`：咖喱鸡 = 4（chicken 3 + curry 1）；
2. `orderBase(['stirVeg','friedWing'])` = 1 + 2 + 4 = 7；
3. `quotePrices`：base 7 → kind 6、normal 7、slash 11（round 规则）；kind 不低于 cost+1；
4. 结算顺序（02-game-design §8）：构造「有剩菜、无冰箱、有贷款、money 恰好跨破产线」的 state，断言各扣款顺序与破产判定正确；
5. 冰箱保留 `floor(qty×0.6)`：5 份 → 3 份；1 份 → 0 份；
6. 贷款：首次破产 money += 100 且 usedLoan=true；还款累计到 150 自动结清；二次破产 phase='gameover'。

### customers.test.js
1. 点单只会点当日已备菜品；备菜种类为 0 时不生成订单（该场景由 UI 禁止开档，reducer 兜底跳过）；
2. 点单至少 1 道 meat/premium（当日有备时）；
3. rep=0 时永不出现 labourer/influencer/foodie；rep=55 且当日菜品 ≥6 种才可能出现 foodie；
4. 反应矩阵抽查：influencer + kind → rep +6 且必付款；student + slash 在 chance 打桩为付款/走人两分支下 rep 分别 −3/−2；
5. 阿嬷 + slash 必进 haggle 分支；
6. 缺菜替代：同类别有菜时给出 offer；无同类时 offer 为 null。

### day.test.js（状态机）
1. 完整快乐路径：NEW_GAME→START_DAY→BUY→FINISH_MORNING→COOK→OPEN_STALL→(SERVE→QUOTE→NEXT)*n→settle
   →ACK_SETTLE（非第 7 天、rep<120 → 直接进 shop）→shop→END_SHOP，断言 day+1、money 流水一致；
2. 非法动作防御：morning 阶段发 QUOTE → state 原样返回；钱不够 BUY → 原样；
3. COOK 超 prepCap → 原样；买 wok 后 cap=24；
4. 客流公式：固定 seed + rep=16 + 招牌 → 队列长度符合公式区间；雨天无棚 ×0.7；
5. helper：队列尾部自动结 2 单、金额按正常价入账；
6. **第 7 天进结局，不再逛商店**：构造 day=7、phase='settle' 的 state，`ACK_SETTLE` → `phase==='ending'`
   （不是 'shop'）；断言 `finalScore(state)` 计算正确（money + rep×5）；
7. **day < 7 时正常进商店**：day=3 的同类构造，`ACK_SETTLE` → `phase==='shop'`；
8. 事件效果抽查：marketUp 次日 `ingredientPrice` ×1.2 向上取整、再次日复位；inspection 有剩菜无冰箱 → money −30。

### highscore.test.js
1. `recordResult(null, result, ts)` → 返回 `{ ...result, achievedAt: ts }`（首次记录必定生效）；
2. `recordResult(existing, result, ts)`：`result.score > existing.score` → 返回新记录；
   `result.score <= existing.score` → 原样返回 `existing`（不覆盖，`achievedAt` 也不变）；
3. 纯函数验证：两次调用相同输入，输出深度相等（无隐藏状态/无副作用）。

### sim.test.js（平衡回归，数值改动必跑）
三个 bot 策略（纯 core 调用，不经 UI）各跑 500 局 × 7 天（GAME_DAYS，与游戏内实际长度一致），
断言 02-game-design §11 基线——**v1.5 修订：目标存活率大幅下调，"失败是常态"是刻意设计**：
- `reasonableBot`：按预估客流备菜（种类≥4、荤素搭配）、默认正常价、优先买冰箱+招牌 →
  7 天存活率落在 [0.3, 0.4]（不是 ≥0.85）；存活的局里终局评分（`finalScore`）落入 A 档以上
  比例 ≥ 0.6；破产的局里 `epitaph` 命中率抽查（用于人工核对墓志铭文案分布是否合理）；
- `lazyBot`：每天只备 4 份菜 → 7 天存活率 ≤ 0.1；
- `slasherBot`：全部斩客价 → 存活率明显低于 `reasonableBot`（具体差值待实测填入本节），
  且存活局的平均 rep ≤ reasonableBot 平均 rep − 20；
- 若首次实测的存活率不在目标区间，按 02-game-design §11 的"调参方向提示"调整
  `RENT_PER_DAY`/事件惩罚力度，不要靠砍 `START_MONEY`。

## 4. E2E 场景（e2e/playthrough.spec.js）

1. **开局流程**：封面（只有「开始经营」一个按钮，没有「继续游戏」）→ 点击开局 → 断言清晨/备菜
   阶段显示"预计客流：约 N±2 位"预热文案 → 完成第 1 天全部五阶段 → 断言 HUD 天数变为「第 2 天」；
2. **刷新前弹确认**：玩到第 2 天中途触发 `beforeunload`（Playwright `page.on('dialog')`
   或检查 `event.returnValue` 被设置），确认游戏进行中会拦截意外关闭；未做真存档，
   确认后刷新仍回到封面（**不出现任何"继续"选项**）；
3. **报价交互**：出餐后出现三个报价按钮，点击后出现结果文案与金钱 toast；
4. **缺菜路径**：只备 1 份菜开档，第 2 位顾客命中缺菜 → 出现替代/道歉选项（用固定 seed 保证可复现：seed 从 URL `?seed=42` 注入，app.js 支持）；
5. **移动端体检**：iPhone 13 视口无横向滚动条（`document.documentElement.scrollWidth <= innerWidth`）、所有 `.btn` 高度 ≥ 44px；
6. **7 天完整通关到存活结局（P0，唯一的完整体验）**：固定 seed 快进跑完 7 天（`?seed=` + 直接 dispatch
   而非逐一点击 UI 也可），断言每天结算报表出现 `dailyVerdict` 对应的手感评价文案；day 7 结算后
   断言 `phase==='ending'`（不是 'shop'）、结局页显示评分与 Uncle 人设标签；首次结局写入
   `caipng.highscore`；点击「再来一局」→ `NEW_GAME` → 回到 day 1、money/rep/upgrades 全部重置；
7. **破产走向墓志铭结局**：用一个已知会导致早期破产的固定 seed + bot 式连续 dispatch 跑到 gameover，
   断言 `phase==='gameover'`、结局页显示 `epitaph` 的称号+墓志铭文案（不是评分/人设标签），
   且 `caipng.highscore` 未被写入（对比场景 6 写入过的历史最高分不变）；
8. **截图存证**：七个阶段（含 ending 存活结局页、gameover 墓志铭页）各截一张到
   `e2e/screenshots/`（CI artifact）。

> `?seed=` URL 参数是**为测试而设计**的正式功能（也方便玩家分享种子局），app.js 必须实现。

## 5. CI 门禁（.github/workflows/ci.yml）

- PR / push main：`npm test`（单测+模拟）必须绿；
- main 绿后自动部署 GitHub Pages（见 06-release-ops）；
- E2E 在 CI 跑 chromium 一个 project（装浏览器耗时可控），本地开发跑全量。

## 6. 手工验收清单（上线前最后一遍，真机）

- [ ] iPhone Safari 与 Android Chrome 各完整通关一局（7 天，撑到底）；
- [ ] 至少真机走一次破产结局，确认墓志铭页正常显示、`caipng.highscore` 未被破产局污染；
- [ ] 锁屏再回来、切后台再回来，当前这局状态不丢（内存态，非持久化，应用未被系统杀掉即可）；
- [ ] 中途刷新/后退触发 `beforeunload` 确认框（iOS Safari 新版本可能只显示系统默认文案，
  不显示自定义文案，属正常现象，确认框本身出现即算通过）；
- [ ] 中途确认离开后回到封面重新开始，且不报错（这是设计如此，不是 bug）；
- [ ] 无痕模式（localStorage 可能受限）能正常玩完一局，只是历史最高分读写失败也不报错；
- [ ] 加载时间 3G 模拟 < 5s；
- [ ] 文案通读一遍无错别字、无占位符，**墓志铭文案单独通读一遍**——这是失败率最高路径下
  玩家最常看到的文案，质量直接决定"死了还想再来一局"还是"弃坑"。
