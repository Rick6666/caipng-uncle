# 项目全量体检报告（2026-07-05）

> 三路并行审查（核心逻辑 / UI 前端 / 测试·文档·工程化）的汇总结果。
> 审查基线：main @ 648eba2，`npm test` 73/73 全绿（822ms）。
> 本文档面向**修复 agent**：每条问题带编号、位置、失败场景、修复建议、验收标准。
> 修复时逐条处理，每完成一条按仓库规范单独 commit（`fix:` / `test:` / `docs:` / `chore:`），并在本文档对应条目打勾。

## 使用规则（修复 agent 必读）

1. 按「建议处理顺序」（文末 §5）分批执行，同批内可并行，跨批有依赖；
2. 涉及 `src/core/` 数值/公式的改动（A 组、C 组），改完**必须**重跑 `npm test` 确认 sim 平衡断言不漂移；纯搬迁类改动（C-1~C-4）要求行为逐字节等价；
3. 修复前先读 `docs/03-architecture.md`（接口契约）与 `docs/02-game-design.md`（数值真源），遵守 CLAUDE.md 铁律：严格 TDD，先写失败测试再修；
4. 文档类修复（D 组）以**代码现状为准**回写文档，除非条目中明确说明实现是错的。

---

## §0 验证为干净的项（不需要动）

- `src/core/` 全部 9 个文件无 DOM / localStorage / Math.random / import ui 违规；所有随机走 `state.rng`（含 CR-19 的派生子流 reqRng），rng 写回无遗漏；
- UI 层零 `innerHTML` / `insertAdjacentHTML` / `document.write`，全部文本经 `createTextNode`，`?seed=` 强转 uint32 后从不渲染回页面 —— **无 XSS 风险**；
- `index.html:36` 已是 `<script type="module" src="src/ui/app.js">`（Task 10 已完成，仅 CLAUDE.md 描述过期，见 D-3）;
- localStorage 读写均有 try/catch，隐私模式不崩（`app.js:11-21`）；
- 移动端骨架合格：safe-area、`viewport-fit=cover`、`100dvh`、`overscroll-behavior:none`、sticky HUD/footer、小屏 media query；
- 事件监听无泄漏无重复绑定（全量重绘 `replaceChildren`）；
- `package.json` scripts 与 CLAUDE.md 一致；`.githooks/pre-commit` 在当前 clone 生效；
- `data.js` 与 02-doc 抽查十余处数值（START_MONEY / RENT / LOAN 三常量 / EVENT_CHANCE / REACTION 矩阵 / REQUESTS / UPGRADES / REP_LEVELS / 解锁声望）除 D-7 外全部一致。

---

## §1 高危（A 组）

### A-1. BUY 退货套利漏洞 + 无当日购买量台账
- [x] 状态 — 已完成（commit 14604d7）
- **位置**：`src/core/day.js:66-81`（doBuy）
- **问题**：`docs/03-architecture.md` §4 规定「qty 可为负 = 退回当日刚买的，不可退到低于当日购买量」。实现只检查 `nextQty < 0`，没有当日购买量记录。
- **失败场景**：① 库存跨天保留，玩家可退掉前几天买的生食材；② 退款按当日 `ingredientPrice`（含 priceMul）计算——普通日 $1 买入包菜，marketUp 日（priceMul 1.2 经 `Math.ceil` 后 $2）负 qty 退回，每单位净赚 $1，肉类同理。7 天内 marketUp 期望出现 ≥1 次，等于印钞机，冲击 §11 千局校准的存活率基线。附带：负 cost 会把 `today.spend` 减成负数，污染 dailyVerdict。
- **修复建议**：在 `today` 中加当日购买台账（如 `today.boughtToday: {id: qty}`，enterMorning 清零），doBuy 负 qty 时校验不得超过台账值；schema 变更同步 03 §3（配合 D-6）。
- **验收**：新增失败测试先行（退昨日库存被拒、退超当日购买量被拒、marketUp 日买卖往返不盈利）；`npm test` 全绿且 sim 存活率断言不漂。

### A-2. E2E 层完全缺失，`npm run e2e` 不可用，UI 零测试覆盖
- [ ] 状态
- **位置**：`playwright.config.js`（`testDir: 'e2e'`）；仓库无 `e2e/` 目录、无任何 `*.spec.js`
- **问题**：`docs/04-test-plan.md` §4 规划的 8 个 E2E 场景（开局流程、beforeunload、报价交互、缺菜路径、移动端体检、7 天通关、破产墓志铭、截图存证）0 个实现。测试策略是「UI 不写单测、由 E2E 兜底」——兜底不存在，`src/ui/` 三文件（465 行）零自动化测试。
- **修复建议**：创建 `e2e/playthrough.spec.js`，按 04-test-plan §4 逐场景实现（注意先按 D-2 修正 04 文档中过期的数值预期）；用固定 `?seed=` 保证确定性。
- **验收**：`npm run e2e` 在手机视口全绿。

### A-3. 无 CI
- [ ] 状态
- **位置**：`.github/` 不存在；`docs/04-test-plan.md` §5、`docs/05-implementation-plan.md` Task 12 均有要求
- **问题**：唯一门禁是本地 pre-commit（`core.hooksPath` 是 clone 级配置，新 clone 失效，可 `--no-verify` 绕过）。无强制绿灯、无覆盖率核查（目标 core ≥85%）、无自动部署。
- **修复建议**：按 05-plan Task 12 建 `.github/workflows/ci.yml`（npm test + coverage 阈值 + Playwright E2E + Pages 部署）。Vitest/Playwright/Actions API 用法不确定时用 context7 核实（CLAUDE.md 铁律）。
- **验收**：push 后 CI 全绿；README（见 E-6）说明徽章与部署地址。

### A-4. 关键文档真源失效（会带偏后续执行 agent）
拆分为 D-1 / D-2 / D-3 三条执行，见 §4。此条仅标记整体风险：**在 D 组修完之前，任何 agent 不得把 `docs/04-test-plan.md` 数值和 `docs/05-implementation-plan.md` checkbox 状态当作事实**。

---

## §2 中危 — 核心逻辑缺陷（B 组）

### B-1. payday 事件「斩客付款概率 +0.1」未实现
- [x] 状态 — 已完成（commit 2c2a7ad，PM 决定删除文档承诺而非补实现）
- **位置**：`src/core/customers.js:56-73`（resolveQuote，签名拿不到 todayEvent）；`customers.js:10-15` 只实现了权重部分
- **问题**：`docs/02-game-design.md` §7.1 承诺 payday「上班族/工人权重 ×2，斩客付款概率 +0.1」，后半静默缺失，且 sim 校准是在无此效果下跑的。
- **修复建议**：**先与 PM 确认真源方向**——是补实现（需重跑 sim 校准、可能调基线）还是改 02 文档删掉该承诺（sim 数据即现状）。倾向后者成本更低；若补实现，resolveQuote 需增加 todayEvent 入参并同步 03 契约。
- **验收**：文档与代码口径一致；`npm test` 全绿。

### B-2. OFFER_SUB 未校验「确实缺菜」，货全在时 40% 白白气走顾客
- [x] 状态 — 已完成（commit 14604d7）
- **位置**：`src/core/day.js:156-183`（doOfferSub）
- **问题**：`canServe === true` 时 `missing=[]` → 不拦截 → 直接掷 `rng.chance(SUB_ACCEPT)`：60% 分支等价 SERVE 但多消耗一次 rng（确定性流偏移）；40% 分支顾客被拒、rep −1，尽管他点的菜全有货。对比 `doServe:149` 有 `!canServe` 自守，此处兜底缺失。
- **修复建议**：doOfferSub 开头加 `if (svc.canServe) return state;`（对齐铁律：非法 action 返回原 state 引用）。
- **验收**：新增测试 `toBe(state)` 断言；`npm test` 全绿。

### B-3. QUOTE 携带非法 tier 抛 TypeError 而非返回原 state
- [x] 状态 — 已完成（commit 14604d7）
- **位置**：`src/core/customers.js:57-59`（经 `day.js:192` doQuote 触达）
- **问题**:`REACTION[customer.type][tier]` 对未知 tier 得 undefined，下一行 `r.haggle` 直接 TypeError，违反「非法 action 返回原 state 引用」铁律（其他非法路径均正确兜底）。
- **修复建议**：doQuote 入口校验 `tier ∈ {kind, normal, slash}`，非法返回原 state。
- **验收**：新增 `toBe(state)` 测试；全绿。

### B-4. qty 为 NaN 时污染整个 state 且永不破产
- [x] 状态 — 已完成（commit 14604d7）
- **位置**：`src/core/day.js:66-81`（doBuy）、`83-97`（doCook）
- **问题**：`NaN < 0`、`NaN > cap`、`money < NaN` 全为 false，守卫全失效 → money/inventory 变 NaN → `economy.js:90` 破产判定 `NaN < 0` 为 false，游戏带 NaN 跑满 7 天。
- **修复建议**：doBuy/doCook 入口加 `Number.isInteger(qty)`（或 `Number.isFinite`）校验，非法返回原 state。可与 A-1 同一批改（同函数）。
- **验收**：NaN/undefined/字符串 qty 的 `toBe(state)` 测试；全绿。

### B-5. rice 是可购买的死食材（玩家纯亏钱）
- [x] 状态 — 已完成（commit 2c2a7ad，PM 决定方案 a：移出 INGREDIENTS）
- **位置**：`src/core/data.js:39`（INGREDIENTS 含 rice，unlockRep 0）
- **问题**：12 道菜无任何 recipe 引用 rice，出餐不扣 rice 库存；`RICE_COST` 只参与 quotePrices 的 kind 下限计算。02 §4.1「每单固定含 1 份米饭」没有消耗侧实现。玩家买米 = 纯损失。
- **修复建议**：**与 PM 确认方向**：(a) 把 rice 移出 INGREDIENTS（不可购买，米饭成本仅体现在定价公式），或 (b) 实现每单扣 1 份米、无米不能出餐。方案 (a) 改动小不动平衡；方案 (b) 动经济模型需重校准。
- **验收**：口径落进 02 文档 + data.js + 测试三者一致；sim 断言不漂（方案 a）或重新校准（方案 b）。

### B-6~B-8. 低危核心边角（可与 B 组顺手修）
- [x] **B-6**（已完成，commit 14604d7） `src/core/events.js:13-35`：`hasLeftover` 在 catSteal 判定前快照——剩 1 份菜 + 无冰箱 + 猫偷走 + 抽中卫生检查 → 对已不存在的剩菜罚 $30、rep −2。修复：检查时用猫偷之后的剩菜数。注意 rng 消耗顺序不能变。
- [x] **B-7**（已完成，commit 14604d7） `src/core/customers.js:61-72`：台词在付款掷骰之前抽取，student/ahma normal 档 10% 走人时展示的却是付款台词。修复：按掷骰结果选台词。注意 rng 顺序。
- [x] **B-8**（已完成，commit 14604d7） `src/core/day.js:43-63`：`closeLines` 不在 enterMorning 清除，昨日收档文案残留到次日 state。修复：enterMorning 重置。

---

## §3 中危 — 铁律违规与重复实现（C 组，机械搬迁，要求行为逐字节等价）

### C-1. 魔法数字成片散落逻辑代码（违反「数值只能在 data.js」）
- [ ] 状态
- **清单**（均已验证不在 CONST 中）：
  - `src/core/economy.js:22-24`：报价系数 `0.8`、`1.5`、`cost + 1`（02 §4.2 核心公式）
  - `src/core/day.js:10`：`SUB_ACCEPT = 0.6`（02 §4.3 替代接受率）
  - `src/core/day.js:60/61/106/108`：tv `+10`、speaker `+1`、rival `−2`、客数下限 `3`
  - `src/core/state.js:93/97-99`：`rep * 5`、评分阈值 `220/150/100`
  - `src/core/state.js:68-73、83-87、106`：人设/墓志铭/verdict 阈值（0.4、0.2、0.05、25、55、28、0.3、2、6、−3）
- **修复建议**：全部提为 `data.js` 具名常量（如 `QUOTE_KIND_MUL`、`SUB_ACCEPT_RATE`、`SCORE_REP_MUL`、`GRADE_THRESHOLDS`、`PERSONA_THRESHOLDS`…），逻辑代码只引用。
- **验收**：`npm test` 全绿且 sim 结果逐字节等价（纯搬迁不许改值）。

### C-2. `rep / 8` 客流公式重复实现两处
- [ ] 状态
- **位置**：`src/core/day.js:102` 与 `src/core/state.js:56`
- **修复建议**：收敛为单一函数（如 economy 或 state 导出），除数 8 进 data.js。
- **验收**：同 C-1。

### C-3. sim.js 手抄 finalScore 公式
- [ ] 状态
- **位置**：`src/core/sim.js:113`（`s.money + s.rep * 5`，未 import `state.js:92-94` 的 finalScore）
- **后果**：将来调评分公式，sim 回归静默用旧公式。
- **修复建议**：改为 import finalScore。
- **验收**：同 C-1。

### C-4. 硬编码文案（违反「文案只能在 data.js」）
- [ ] 状态
- **位置**：`src/core/day.js:182`（'客人摇摇头走了，声望 −1。'）、`day.js:189`（'你婉言道歉送客，这单没做成。'）
- **修复建议**：迁入 data.js 的 LINES。
- **验收**：同 C-1。注意 B-2 修复后 182 行路径仅在真缺菜时可达。

---

## §4 文档真源修复（D 组，代码为准回写）

### D-1. `docs/05-implementation-plan.md` checkbox 全部失真
- [x] 状态 — 已完成（commit e36b0f4）
- **问题**：57 个 checkbox 全为 `- [ ]`，而 Task 0–10 实际全部完成（src/core 9 模块 + src/ui 3 文件 + 73 用例 + 28 commit）；真正未做的 Task 11/12/13 与已做的无法区分。CLAUDE.md 把此文件定义为「任务清单，从上到下执行」——新 agent 会从 Task 0 重做。
- **修复建议**：勾选 Task 0–10 全部已完成项；Task 9b（美术资产）按 CR-02 定案标记为「已废弃（emoji 方案）」并注明出处；Task 11/12/13 保持未勾（对应 A-2 / A-3 / E-6）。

### D-2. `docs/04-test-plan.md` 大面积过期，不能作为用例真源
- [x] 状态 — 已完成（commit e36b0f4）
- **已核实漂移点**：
  - economy 用例 6：贷款「+100 / 还 150」→ 实际 `LOAN_AMOUNT: 30 / LOAN_REPAY: 40`
  - economy 用例 1-2：「咖喱鸡 = 4（chicken 3 + curry 1）」→ 实际 chicken 单价 2、成本 3；`orderBase(['stirVeg','friedWing'])` 的菜品 ID 在 data.js 中不存在
  - 事件触发率 0.35、断言区间 [0.30, 0.40] → 实际 `EVENT_CHANCE: 0.55`（05-plan 425 行同病）
  - sim：reasonableBot 存活率 [0.3, 0.4] → 实际断言 22%~38%；lazyBot ≤0.1 → 实际 ≤0.13
  - state：人设条件是 CR-18 之前旧版（「rep≥60」「broke」等），实现为 rep≥25、broke 已删、新增 hustler/zen；epitaph 优先级实现是 slashRate 第一（`state.js:62-88`）
- **修复建议**：以 data.js / 实际测试为准逐节回写；E2E 一节（§4）保留但更新数值预期，供 A-2 实施。

### D-3. CLAUDE.md「现状」节过期且与 CR-02 定案矛盾
- [x] 状态 — 已完成（commit e36b0f4）
- **问题**：① 「index.html 的 game.js 将在 Task 10 改为 module」——已完成，game.js 从未存在；② 「assets/ 由 Task 9b 产出 21 张像素风资产（fal.ai）」——CR-02 与 02-doc §12 已定案全 emoji、废弃美术资产，`data.test.js` 也已固化该断言。
- **修复建议**：重写「现状」节：入口已是 `src/ui/app.js`；视觉方案为全 emoji（引 CR-02）；删除 fal.ai 依赖说明。

### D-4. `docs/03-architecture.md` §3 state schema 双向漂移
- [x] 状态 — 已完成（commit e36b0f4）
- **问题**：schema 有而代码永不产生：step `'substitute'`、`today.log`、`service.offer`（恒 null，`day.js:117`）；代码有而 schema 无：step `'request'`（`day.js:115/263`）、`service.canServe/requestNotice`、`carryOver`（`state.js:16`）、`loanTaken`（`day.js:53`，且 newGame 中缺失导致首日 state shape 不一致）、`closeLines`（`day.js:290`）、`Customer.request`。潜在坑：若有人按文档实现 substitute 步，`screens.js:174-176` 兜底分支读 `svc.lastOutcome.line` 空指针崩溃。
- **修复建议**：按代码现状回写 schema；`loanTaken` 在 newGame 初始化补齐（shape 一致）；删除死字段 `service.offer` 或入 schema 注明用途。另两处文档互斥口径一并裁决：03 §4 的 START_DAY 约束（`title/shop→morning` vs 实现仅 title）与 OPEN_STALL「含 helper 自动单」（实现为 settle 时自动卖剩菜，与 02 §6 一致）——以实现回写 03。

### D-5. `docs/08-change-requests.md` 状态标注与口径
- [x] 状态 — 已完成（commit e36b0f4）
- **问题**：第一轮表格 CR-02~17 行无 ✅（闭环只写在底部 prose）；CR-10 won't-fix 无标记；「72 项全绿」vs「73 测试绿」vs 当前实际口径混乱。
- **修复建议**：表格逐行补状态列（✅ / won't-fix），统一测试数口径为当前 `npm test` 实际值。

### D-6. 02-game-design 内部矛盾：阿嬷砍价接受档 rep
- [x] 状态 — 已完成（commit e36b0f4）
- **位置**：`docs/02-game-design.md:128`（「收 normal 价，rep 0」）vs 同文件 121 行 CR-08 注（+1）vs `data.js:88`（`haggle.accept: {rep: 1}`）；`tests/customers.test.js:51` 测试名写 "rep0" 但断言 `repDelta: 1`。
- **修复建议**：以实现（+1）为准改 128 行，测试改名。

### D-7. 04/05 文档中其余引用同步
- [x] 状态 — 已完成（commit e36b0f4）
- 05-plan 425 行事件率 0.35（同 D-2）；05-plan 662 行 README 计划（对应 E-6）。修 D-1/D-2 时顺带。

---

## §5 UI 与工程卫生（E 组）

### E-1. UI 直接改写 core state 对象（`state._highscore`）
- [ ] 状态
- **位置**：`src/ui/app.js:37, 39, 52`
- **问题**：dispatch 后直接 `state._highscore = ...`。(a) `_highscore` 不在 03 §3 schema；(b) 非法 action 时 reducer 返回原 state 引用，UI 在「应不变」的对象上盖写——未来 core 引入 `Object.freeze` 或深度不变断言即崩；(c) 违背「UI 只读 + dispatch」协议。
- **修复建议**：highscore 作为 render 的第二参数传入，不写进 state。

### E-2. viewport 禁用缩放（WCAG 1.4.4）
- [ ] 状态
- **位置**：`index.html:5`（`maximum-scale=1.0, user-scalable=no`）
- **修复建议**：只保留 `width=device-width, initial-scale=1, viewport-fit=cover`；双击误触已有 `touch-action: manipulation` 兜底。

### E-3. 步进按钮 38×38px 低于触控标准
- [ ] 状态
- **位置**：`style.css:163-165`（38px）、`style.css:160`（间距 4px）
- **问题**：iOS HIG 44pt / Android 48dp；采购备菜是每局几十次的核心操作，误触 +/− 造成经济损失。
- **修复建议**：≥44px 并加大间距。改后跑 E2E 移动端视口确认无溢出。

### E-4. UI 小缺陷三则
- [ ] **E-4a** `screens.js:255` 平分误报「刷新历史最佳」（UI 用 `>=`，`highscore.js:4` 用 `>`）——统一为 `>`。
- [ ] **E-4b** `app.js:50` `?seed=abc` → `Number()>>>0` → 0，拼错的分享链接全玩 seed 0。NaN 时 fallback `freshSeed()`。顺带收敛 `freshSeed()` 双份实现（`app.js:44-46` 有 floor vs `screens.js:292-295` 无）为单一导出。
- [ ] **E-4c** `app.js:53/64` 全局 error 监听注册在首次 `draw()` 之后，首屏抛错见白屏。监听挪到 draw 之前。

### E-5. 仓库卫生
- [ ] **E-5a** 根目录 9 张调试截图（pm-*.png ×7、walk-1-cover.png、ending-screen.png，约 1.3MB）被 track——`git rm --cached` 移出并入 .gitignore（历史体积已产生，不强求重写历史）。
- [ ] **E-5b** `.playwright-mcp/` 50 个会话产物（292KB）被 track——同上处理并入 .gitignore。
- [ ] **E-5c** `.gitignore` 补齐：`.playwright-mcp/`、根目录调试截图规则；清理指向不存在目录的 `e2e/screenshots/` 行（待 A-2 建目录后按需恢复）。
- [ ] **E-5d** `docs/analysis/` 1.1MB 可再生数据集（daily.csv.gz 568KB、games.csv 532KB）——与 PM 确认：归档意图明确（有 commit 说明），若保留则不动；若瘦身则移出 git 只留报告 MD。**默认不动，仅确认。**

### E-6. 缺 README.md（Task 13）
- [ ] 状态
- **内容至少含**：游戏简介、`npm test` / `npm run e2e` / `npm run serve`、`git config core.hooksPath .githooks` 门禁配置步骤（05-plan 662 行原计划）、部署地址（A-3 完成后补）。

### E-7. 死代码/死样式清理
- [ ] **E-7a** `data.js:34` `WORKER_UNLOCK` 占位常量无引用——删除或启用。
- [ ] **E-7b** `data.js:91` influencer `slash.repWalk: -6` 不可达（pay 1.0 永不走人）——确认后删除或留注释说明。
- [ ] **E-7c** `day.js:9` `unlockedIngredients(9999)` 哨兵——改为直接 import INGREDIENTS。
- [ ] **E-7d** `style.css:114-118` `h1.title` 与 `style.css:352` `.cover .btn + .btn` 永不命中——删除。
- [x] **E-7e**（已完成，commit 2c2a7ad，PM 决定维持现状） 统计口径：sub-reject（`day.js:181`）与 apologize 走人不计 `walkoutCount`——已在 02-game-design.md §9.1 补充口径说明，两种走人是不同失败模式，故意不合并统计，不改代码。

---

## §6 建议处理顺序

| 批次 | 条目 | 说明 |
|------|------|------|
| 1 | D-1 ~ D-7 | 先修文档真源，成本最低；不修则后续 agent 全部跑偏 |
| 2 | A-1, B-2, B-3, B-4（+顺手 B-6~B-8） | 核心守卫与套利漏洞，TDD 先红后绿，改完跑 sim 断言 |
| 3 | B-1, B-5 | 需 PM 先拍板方向（补实现 vs 改文档 / rice 两方案） |
| 4 | A-2 → A-3 | E2E 先立起来，CI 才有东西可跑 |
| 5 | C-1 ~ C-4 | 机械搬迁，逐字节等价验证 |
| 6 | E-1 ~ E-7 | UI 与卫生，随批清理 |

**需要 PM 拍板的三个决策点**：B-1（payday 补实现还是删文档承诺）、B-5（rice 移出采购还是实现米饭消耗）、E-7e（walkout 统计口径）。其余条目方向明确，可直接执行。
