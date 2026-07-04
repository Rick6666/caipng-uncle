# 杂菜饭 Uncle（Cai Png Tycoon）

手机浏览器经营模拟游戏。运行时零依赖（原生 ES Modules），开发依赖仅 Vitest + Playwright。

## 执行 Agent 必读（按顺序）

1. `docs/05-implementation-plan.md` — **你的任务清单**（TDD，带 checkbox，从上到下执行）
2. `docs/03-architecture.md` — 接口契约：函数签名、state schema、目录结构（**逐字遵守**）
3. `docs/02-game-design.md` — 数值单一真源（所有数字以此为准，改数值先改文档）
4. `docs/04-test-plan.md` — 每个模块的完整测试用例清单
5. `docs/01-PRD.md` / `docs/06-release-ops.md` — 需求背景与发布规范
6. `docs/07-workflow-rules.md` — 与 Claude Code 协作的操作规范（think 模式使用时机、指令精度、回滚优先级、context7 校验、pre-commit 门禁、自定义命令）

## 铁律

- 严格 TDD：先写失败测试再实现，禁止跳步；
- `src/core/` 禁止：DOM / localStorage / Math.random / import ui 文件；所有随机走 state.rng；
- 数值与文案只能存在于 `src/core/data.js`，逻辑代码里出现魔法数字 = 缺陷；
- 非法 action 时 reducer 返回**原 state 引用**（测试用 `toBe` 断言）；
- 每个任务完成即 commit：`<type>: <description>`（feat/fix/test/chore/docs），**不加任何 attribution 尾注**；
- 卡壳超过 3 次尝试：停下报告，不得擅自修改接口契约。
- 复杂任务（Task 7 状态机、Task 9 调参）先想清楚实现路径/策略再动手，不许一次性写完整个文件；
- 下达/接收任务指令需含「文件路径 + 具体现象或失败测试 + 依据的文档章节」，禁止靠猜测补全文档未定义的行为；
- AI 改崩代码优先"回滚"当前会话改动，其次才是 `git reset --hard`；
- Vitest/Playwright/GitHub Actions 的 API 用法不确定时用 context7 MCP 核实，不凭记忆；
- 新增内容（食材/菜品/顾客/事件/升级）用 `/add-content` 命令，只改 `data.js`，不动逻辑代码。

## 常用命令

```bash
npm test          # 全部单测 + 平衡模拟
npm run e2e       # Playwright 手机视口 E2E
npm run serve     # 本地 http://localhost:8000
```

## 现状

- Task 0~10（工具链、rng/data/state/economy/customers/events/day/highscore/sim、UI 层）均已完成；`index.html` 入口已是 `<script type="module" src="src/ui/app.js">`，`game.js` 从未存在过。
- 视觉方案：**全 emoji，不使用外部美术资产**（`docs/08-change-requests.md` CR-02 定案，像素画方案已废弃）。`docs/05-implementation-plan.md` Task 9b（原像素风美术资产生成计划）已标记废弃，不得执行；不存在 `assets/` 目录，`FAL_KEY`/fal.ai MCP 与本项目视觉方案无关。
- 尚未完成：Task 11（E2E，`e2e/` 目录不存在）、Task 12（CI/CD 与上线）、Task 13（验收与 README）——详见 `docs/09-project-audit.md`。
- 已知问题清单与修复优先级见 `docs/09-project-audit.md`（三路审查报告，含高/中/低危分级与验收标准），修复任务应从该文档领取。
