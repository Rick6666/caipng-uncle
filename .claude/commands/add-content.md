---
description: "为《杂菜饭 Uncle》新增一种内容（食材/菜品/顾客/事件/升级），只改 data.js 与文案，不动逻辑代码"
---

按 `docs/06-release-ops.md` §4 的约束：内容更新只允许改动 `src/core/data.js` 的表项与 `LINES` 文案，
不得改动 `economy.js`/`customers.js`/`events.js`/`day.js` 的逻辑代码。

参数：`$ARGUMENTS`（形如 `dish 咖喱鱼头 curryFishHead` / `customer 日本游客 tourist` / `event 电视台采访 tv`，
第一个词是类型：ingredient/dish/customer/event/upgrade，第二个是中文名，第三个是 id）。

请执行：

1. 打开 `docs/02-game-design.md`，在对应表格（§2~§7）追加一行，字段与同类已有行保持同样结构（价格/权重/解锁声望/配方等），
   数值需与相邻同档位条目合理对齐（不要凭空定价，参照同类已解锁项）。
2. 同步修改 `src/core/data.js` 对应导出常量，追加同结构条目。
3. 若是 `customer` 类型：在 `LINES.greetings`/`LINES.reactions` 中补齐该类型 ≥5 条进场台词、
   三档位各 ≥3 条反应台词（`docs/04-test-plan.md` §3/data.test.js 的规模断言会校验，不齐会测试失败）。
4. 若是 `dish` 类型：配方食材必须是 `INGREDIENTS` 中已存在的 id，成本与基准价关系需满足
   `docs/02-game-design.md` §3 备注的"基准价 > 成本"惯例。
5. 跑 `npm test`，确认 `tests/data.test.js` 与相关平衡模拟（`tests/sim.test.js`）仍然通过；
   若平衡基线被打破（新内容改变了整体强度），按 `docs/02-game-design.md` §11 的流程重新调参并更新该节数字。
6. 提交：`git commit -m "feat: add <类型> <中文名>"`。
