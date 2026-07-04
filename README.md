# 杂菜饭 Uncle（Cai Png Tycoon）

手机浏览器经营模拟游戏：邻居 Uncle 把摊子托你看 7 天，每天买菜、备菜、看人喊价，撑到最后交出成绩单——大概率会破产，这是设计如此。

运行时零依赖（原生 ES Modules），开发依赖仅 Vitest + Playwright。视觉方案为全 emoji，不加载外部美术资产。

## 开发命令

```bash
npm test          # 全部单测 + 千局平衡模拟
npm run test:watch
npm run coverage   # 覆盖率报告（目标 src/core/ ≥85%）
npm run e2e        # Playwright 手机视口 E2E
npm run serve      # 本地 http://localhost:8000
```

## 首次克隆后

```bash
npm install
git config core.hooksPath .githooks   # 启用本地 pre-commit 测试门禁（提交前自动跑 npm test）
```

`core.hooksPath` 是仓库本地 git 配置，不会随 `git clone` 自动生效，需要手动执行这一步。

## 项目结构

- `src/core/`：纯函数逻辑层（reducer 模式 + 可序列化 RNG），禁止 DOM/localStorage/Math.random；
- `src/ui/`：表现层，只读 state + dispatch；
- `docs/`：设计文档与架构契约，`docs/02-game-design.md` 是数值单一真源，`docs/09-project-audit.md` 是当前已知问题清单。

详见 `CLAUDE.md`（面向执行 agent 的协作规范）与 `docs/` 目录下各文档。
