# 《杂菜饭 Uncle》发布与生命周期运营（Release & Ops）

## 1. 环境与发布拓扑

| 环境 | 载体 | 用途 |
|---|---|---|
| 本地开发 | `npm run serve` (http://localhost:8000) | 开发与 E2E |
| 生产 | GitHub Pages：`https://<owner>.github.io/caipng-uncle/` | 玩家访问的唯一入口 |

不设 staging——静态站 + CI 全绿门禁即可，出问题 revert 重部署（分钟级回滚）。

## 2. 分支与发布流程（项目生命周期）

- **Trunk-based**：日常小步直接提交 main（CI 必须绿）；大特性走短生命周期分支 + PR。
- **CI 门禁**：push/PR → `npm ci && npm test`（单测 + 平衡模拟）；main 绿 → 自动部署 Pages。
- **版本策略**：语义化 tag（v1.0.0 起）。**不存在存档格式兼容性负担**——本项目不做中局持久化
  （见 `03-architecture.md` §6），state schema 想怎么改就怎么改，唯一需要留意的持久化字段是
  `caipng.highscore`（历史最高分），其形状极简且几乎不会变。
- **回滚**：`git revert` + push main，Pages 自动重部署——没有存档兼容性顾虑，回滚到任意历史版本都安全。

## 3. 发布检查单（每次上线）

- [ ] `npm test` 与 `npm run e2e` 本地全绿；
- [ ] 若 `caipng.highscore` 的记录形状有变 → 确认旧记录读取失败时会静默当作 `null`（不报错），
  不需要迁移逻辑；
- [ ] 真机（iOS Safari + Android Chrome）完整通关一局（7 天）冒烟；
- [ ] `curl -sI <线上URL>` 200，且强刷后新版本生效（Pages 缓存约 10 分钟，重大修复可改 query 提示用户强刷）；
- [ ] tag + GitHub Release 记录变更。

## 4. 游戏生命周期路线图（Live-ops）

| 版本 | 内容 | 触发条件 |
|---|---|---|
| v1.0 | 本计划全部（MVP：单局 7 天、独立结局、无中局存档） | — |
| v1.1 | 音效/震动（Web Audio + vibrate）、PWA 离线安装（manifest + service worker） | v1.0 稳定一周后 |
| v1.2 | 内容包：新顾客（马来同胞、日本游客）、节日事件（农历新年/开斋节）、每日挑战种子（当日固定 seed，玩家可比分截图） | 有传播反馈后 |
| v1.3+ | 成就系统、多结局（健康路线/黑心路线） | 视热度 |

内容更新的工程约束：**只增 `data.js` 表项与文案，不动逻辑**（架构已为此解耦）；每次内容更新必跑平衡模拟回归。

## 5. 观测与反馈

坚持零后端、零第三方脚本（隐私干净、加载快）：
- 不接分析 SDK；传播效果看 GitHub 仓库 star / 用户口头反馈；
- 游戏内结算页提供「截图分享」引导文案（成绩单天然适合截图传播）；
- Bug 反馈：README 放 GitHub Issues 链接。

## 6. 归档与退役（生命周期终点）

静态托管无运行成本，原则上**永不下线**。若停止维护：README 标注 archive 状态、仓库 archive——游戏本体继续可玩。
唯一的玩家本地数据是历史最高分（`caipng.highscore`），与我们无关，无数据清理义务。

## 7. 成本核算

域名（可选，用 github.io 免费）+ GitHub 免费额度（公共仓库 Pages/Actions 免费）= **$0/月**。
