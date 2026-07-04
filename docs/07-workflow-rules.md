# 执行 Agent 工作流规范（Claude Code 协作规则）

> 来源：知乎《30 个进阶技巧彻底榨干Claude Code价值》（饼干哥哥AGI），已按本项目实际情况（原生 JS/HTML/CSS 零运行时依赖、Vitest+Playwright、GitHub Actions/Pages）筛选、剪裁、改写。
> 原文中与 React/Next.js 技术栈选型、v0.dev UI 生成、Roo Code 架构工具、微服务拆分、puppeteer 内容分析相关的技巧与本项目不匹配，未采纳。

## 1. 复杂任务先想清楚再动手（think 模式）

对 `docs/05-implementation-plan.md` 中标注为「核心/最大任务」的部分（Task 7 day.js 状态机、Task 9 平衡数值调参），
在写代码前先让 AI 输出实现路径或调参策略，确认路径正确再动手，避免走偏浪费 token。
Task 7/9 本身已经在计划里给出了分步骤 + 分支说明，**执行时不得跳过这一层直接一次性写完整个文件**。

## 2. 任务间清空上下文

- 若采用 `subagent-driven-development`（每任务一个新子 Agent）执行本计划，此规则天然满足，无需额外操作。
- 若在单一会话中顺序执行多个 Task，**在切换到不相关的下一个 Task 前执行 `/clear`**
  （例如做完 Task 2 data.js 文案后，开始 Task 3 state.js 前清一次），防止旧上下文干扰新任务的实现路径判断。

## 3. 下达任务指令用精确范式，不用模糊描述

❌ "把报价逻辑修一下"
✅ "`src/core/economy.js` 的 `quotePrices` 函数：阿嬷砍价场景（`docs/02-game-design.md` §4.2）反应矩阵没有按文档实现，
`tests/economy.test.js` 中 xxx 用例失败，请修复 `quotePrices`/`resolveQuote` 使其符合文档定义，不要改测试文件。"

指令必须包含：**文件路径 + 具体现象/失败测试 + 期望依据（指向 docs/ 中的具体章节）**，
禁止让执行 Agent 自行猜测数值或补充文档未定义的行为——本项目数值单一真源是 `docs/02-game-design.md`，
遇到文档未覆盖的场景应停下询问而非自由发挥。

## 4. AI 改崩代码时优先"回滚"而非 `git reset --hard`

单次会话内 AI 误删/改坏文件时，先要求"撤销/回滚这次修改"（回退当前会话的文件改动），
这比 `git reset --hard` 更轻量、不会连累已经跑通的其他改动。只有当回滚不可用或已经跨会话时，
才使用 `git reset --hard <上一个绿色 commit>`（连本项目 `docs/06-release-ops.md` 的回滚约束一并遵守：
不得回滚到存档 schema 更低版本的 commit）。

## 5. 涉及工具库 API 用法，用 context7 MCP 核实，不凭记忆猜测

本项目开发依赖仅 Vitest 与 `@playwright/test`（`docs/05-implementation-plan.md` Task 0）。
配置 `vitest.config.js` 的 coverage 选项、`playwright.config.js` 的 `devices['iPhone 13']`/`webServer` 写法、
以及 GitHub Actions 中 `actions/deploy-pages` 的用法，如遇版本行为不确定，
**使用 context7 MCP 查询当前版本的真实文档**，不要凭训练数据里可能过时的记忆写配置。

## 6. Pre-commit 测试门禁

不引入 Husky（保持 ADR-1 的"运行时与工具链零额外依赖"精神），改用原生 git hook，
但**不能直接写 `.git/hooks/`**——那个目录不受版本控制，克隆后 hook 就消失，等于没配置。
用 `git config core.hooksPath .githooks` 指向仓库内受版本控制的 `.githooks/pre-commit`，
跑 `npm test`，测试不过阻止提交。已并入 `docs/05-implementation-plan.md` Task 0 Step 6
（这处是 search-first 复查时发现的坑，最初草案写的是 `.git/hooks/`，已修正）。

## 7. 双重视角 Code Review

每个 Task 的实现完成、测试转绿之后，过一遍 `code-reviewer`／`pr-review-toolkit:code-reviewer` 类 agent 审查
（与用户全局 `agents.md` 规则一致，本项目不例外）。核心模块（day.js、economy.js）额外关注：
是否有魔法数字逃出 `data.js`、reducer 是否对非法 action 严格返回原 state 引用。

## 8. 周期性重构检查点，防止核心文件"代码熵增"

每完成 2~3 个 Task 后，针对当前体量最大的 core 文件问一次："这个文件职责是否已经不单一、要不要拆分？"
——不是每次都要拆，而是主动做一次检查，避免 day.js/economy.js 在任务推进中不知不觉膨胀成难维护的大文件。

## 9. 项目专属自定义 slash 命令：内容包扩充

`docs/06-release-ops.md` §4 规定 v1.2+ 的内容更新（新顾客/新菜品/新事件）应"只增 data.js 表项与文案，不动逻辑"。
这是高频重复操作，已封装为项目命令 `.claude/commands/add-content.md`（见该文件），用法：

```
/add-content dish 咖喱鱼头 curryFishHead
/add-content customer 日本游客 tourist
/add-content event 电视台采访 tv
```

## 10. 保持工具链最新

`npm outdated` 定期检查 Vitest/Playwright 版本；升级后先跑 `npm test && npm run e2e` 确认无回归再提交。
