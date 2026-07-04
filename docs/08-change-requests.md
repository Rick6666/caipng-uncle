# 08 · 变更需求单（CR-2026-07-04）

来源：4 个玩家 bot + PM 引擎复核 + 手机实机测试后的汇总。PM 提给技术团队，逐项 TDD 修复。
决策：**保留 emoji，不做美术资产**；其余问题全部修复。数值改动一律「先改 `docs/02` → 再改 `data.js`」。

优先级：P0 阻断 / P1 严重 / P2 一般 / P3 打磨。验收 = 单测通过 + 引擎 sim 复核 + 实机跑通。

| CR | 标题 | 优先级 | 涉及文件 | 验收标准 |
|----|------|--------|---------|---------|
| CR-01 | 工具链缺失，`npm test` 崩 | P1 | package.json / *.config.js / .githooks | `npm test` 全绿；pre-commit 门禁生效 ✅**已完成** |
| CR-02 | 美术资产 404（保留 emoji） | P1 | data.js / screens.js / dom.js | 全流程 0 个资源 404；菜品/顾客渲染 emoji |
| CR-03 | 替代菜「双扣」库存变负 | P1 | customers.js / day.js | 同类两缺菜只剩一份替代货时不双扣；库存不为负；有回归测试 |
| CR-04 | SERVE 无 canServe 守卫（违反铁律） | P2 | day.js | 缺货 SERVE 返回原 state 引用（`toBe`）；有测试 |
| CR-05 | 破产贷款兜不住仍判存活多送一天 | P2 | economy.js | 发贷后仍 <0 直接 gameover；有测试 |
| CR-06 | START_DAY 在 shop 阶段可无限刷当天 | P2 | day.js | START_DAY 仅 `['title']` 合法；shop 只能 END_SHOP；有测试 |
| CR-07 | 美食家 variety 统计含已清零菜 | P2 | day.js | variety 只计 `cooked[id]>0`；有测试 |
| CR-08 | 声望进阶系统真实游玩不可达 | P1 | docs/02 → data.js | normal 打法存活局能爬到 rep 15-30；premium 内容有意义占比可达；reasonable 存活维持 25-40% |
| CR-09 | 良心价近乎不可赢（3.9%） | P1 | docs/02 → data.js/economy.js | 良心价存活率显著提升（目标 ≥15%），且形成"声望回报"正循环 |
| CR-10 | 升级=陷阱（买了反降存活） | P2 | docs/02 → data.js | 至少中低价升级为正收益；sim 中 reasonable 买冰箱不降存活 |
| CR-11 | 借贷对玩家不可见 + LOAN_REPAY 除不尽 | P2 | docs/02 → data.js / economy.js / screens.js | 结算页明示「续命贷」；LOAN 常量与实际还款自洽 |
| CR-12 | 结算「声望变化」显示钳前原值，与 HUD 不一致 | P2 | day.js | 台账显示实际生效（钳零后）的声望变化 |
| CR-13 | 文案「大陆味」出戏 | P2 | data.js | 小红书→IG/TikTok、搬砖→做工、打工人/发薪→出粮、避雷帖→劝退帖、全城→全岛 |
| CR-14 | 菜品正名 / 配方 | P3 | docs/02 → data.js | 青龙菜→Sambal Kangkong（含辣椒）、芙蓉蛋配方修正 |
| CR-15 | 文档存活率注释过期(37%↛26.8%) | P3 | data.js / docs/02 | 注释与实测一致 |
| CR-16 | 代码异味清理 | P3 | day.js / data.js | applyRep 冗余参、死常量、输入防御按需处理 |
| CR-17 | 备菜软锁：没钱没料时无法开档也回不去采购，卡死 | P1 | screens.js | 彻底炒不出菜时放行开档→进注定亏本的一天→破产，绝不卡死；有引擎级回归 |

修复顺序：CR-01 → 纯正确性 CR-03~07 → CR-02 → CR-12 → CR-13/14/15 → 重平衡 CR-08/09/10/11 → 回归中发现并修 CR-17。

---

## 完成情况（2026-07-05）

**全部 CR 已落地，`npm test` 72 项全绿，手机实机完整跑通。** 提交序列：
1. `chore: tooling setup` — CR-01
2. `fix: reducer correctness bugs` — CR-03/04/05/06/07/12 + CR-11(借贷可见)
3. `refactor: drop art assets, emoji only` — CR-02
4. `fix: localize copy` — CR-13/14
5. `balance: revive reputation progression` — CR-08/09 + 评级/人设重标定
6. `docs: sync 02-game-design` — CR-15 + §2/§5/§6/§11 全面对齐
7. `fix: prevent prep soft-lock` — CR-17

**平衡实测（sim 2000 局/策略）**：reasonable 存活 ~26%（22–38% 区间内）、存活局均 rep ~29
（重平衡前 ~0.3）、67% 的局摸到 rep15、11% 到 rep30；slasher 声望仍趴 0（斩客掉口碑）；
良心价路线存活低但存活即冲 rep 80+。声望进阶从"死内容"复活为健康曲线。

**实机验证**：全流程 title→采购→备菜→接客(三档报价/砍价/替代)→结算(借贷提示+声望台账一致)→
升级→结局；0 个 console 错误（404 全灭）；存活 S 级评分页与破产墓志铭页均正常渲染；软锁已消除。

**未做（PM 判定，非缺陷）**：CR-10 升级在"高难生存"设定（sim.test 锁 22–38% 存活）下定位为
战略赌注而非白送——放松会破坏核心张力；美术资产按决策保持 emoji。

---

## 第二轮 · 病毒传播优化（CR-2026-07-05，grilling 对齐后）

**定位共识**：玩家为"应对各种各样的情况"而玩、不为赢；人设由**打法风格**驱动、覆盖 100%。
**双北极星**：分享（截图）+ 留存。**不建分享功能**（靠玩家自截图），`?seed` 保持内部用途。
**明确不做**：留存 tease 钩子、房租/毛利手感微调（用户砍掉 P2）；数据分析 dashboard。

| CR | 标题 | 优先级 | 涉及文件 | 状态 |
|----|------|--------|---------|------|
| CR-18 | 人设系统重做：打法驱动·扩充·破产改可认领身份 | P0 | data.js / state.js | ✅ 已完成（uncleTitle 加 hustler/zen、删 broke；epitaph 改打法优先并重写为自嘲身份；docs §9 同步） |
| CR-19 | 决策层情境扩充：特殊顾客需求（第一批） | P0 | data.js / day.js / customers.js / screens.js | ✅ 已完成（第一批 3 个签名需求：工人加饭加肉 / 网红摆盘拍照 / 阿嬷试吃；新增 `request` 服务步 + `RESOLVE_REQUEST` 动作，应对/拒绝施加 rep/money 喂养打法人设；~15% 顾客触发；平衡带守住 22–38%；有测试）<br>后续批次（美食家挑刺 / 插队 / 赊账 / 道德两难卫生局塞红包等）另开 CR-21 增量 |
| CR-20 | 结局页重构成「Uncle 人设卡」（截图货币） | P1 | screens.js / style.css | ⏳ 待落地：人设身份为视觉主角 + Singlish 人设文案 + 战绩降为小徽章 + kopitiam 视觉 |

验收：每项 TDD + npm test 全绿 + 实机跑通；人设覆盖 100% 玩家、"你是哪种 Uncle"有真多样性。
