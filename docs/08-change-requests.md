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

修复顺序：CR-01(done) → 纯正确性 CR-03~07 → CR-02 → CR-12 → CR-13/14/15 → 重平衡 CR-08/09/10/11 → 回归。
