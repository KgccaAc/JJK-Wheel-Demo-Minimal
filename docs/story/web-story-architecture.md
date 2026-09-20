# Web 故事模式架构（首期落地）

## 目标与边界

最终客户端以 Web 为主，Godot 当前版本继续作为玩法、战斗和旧内容来源。首期不把 Godot 页面直接搬进浏览器，而是先固定一个平台无关的故事内容包和解释器：编辑器、浏览器运行时、后端 AI 都读取同一份 `story-package.v1`。

## 当前数据流

```text
data/story/chapter1.json + npcs.json + npc_dialogue.json
        │ tools/build_story_package.mjs
        ▼
data/story/story-package.json  ───────────────┐
web-editor/story-package.json                  │
        │                                     │
        ├── web-runtime/StoryRuntime           │
        │       └── serialisable StoryEvent    │
        └── web-editor/                        │
                └── 编辑 / 预览 / 导出         │
                                              │
Web 客户端 ── /api/ai/dialogue/* ── local-preview ── DeepSeek
                                              │
                              后端规则 + saveRevision + event ledger
```

## 内容包契约

`story-package.json` 保存稳定节点 ID、章节入口、节点类型、选项、背景、战斗 encounter、NPC 角色卡、资源引用和本地回退对白。旧类型会保留在 `legacyType`，方便迁移期间与 Godot 运行时比对；正式编辑使用 `type` 和公共字段。

`data/story/ai-effect-policies.json` 维护 `dialogue_only` 的允许效果和每回合/每会话上限；构建器把它嵌入内容包，后端仍以服务器规则为最终权威。

当前第一章转换结果：57 个节点、10 个战斗 encounter、4 个 NPC、12 个资源引用；其中 `chapter1_ai_contact` 从河岸选择进入，最多 3 轮，完成后回到战斗入口。校验器把不可达节点作为警告而不是错误，因为核心时间线中存在按旗标进入的预留节点；断链、入口不存在、战斗配置缺失和 AI 配置缺失才阻止通过。

Web 根页 `web-preview/index.html` 与 `web-preview/app-shell.mjs` 是首期 App Shell：导航、错误边界、响应式页面和存档状态由 Shell 管理；故事页只消费 `StoryClient`，转盘/战斗/联机页通过模块路由保留服务接入点，不复制 Godot 权威逻辑。`?save=<id>` 选择独立存档槽，页面刷新后仍从 `/api/saves/:id` 恢复快照。

## Web 运行时

`web-runtime/story-runtime.mjs` 是无 DOM、无 Godot 依赖的确定性状态机。它接收内容包和存档快照，输出 `node_entered`、`show_dialogue`、`show_choices`、`change_background`、`start_battle`、`start_ai_dialogue`、`apply_effect`、`ai_dialogue_resolved`、`end` 等 JSON 事件。

表现层负责渲染和收集输入；运行时负责条件、旗标、资源、成长、关系、记忆、战斗结果和最大跳转保护。刷新恢复时传回 `snapshot()`，不依赖页面私有状态。

## 内容工作台

访问本地预览服务的 `/story-editor`。左侧节点树支持全文过滤；中间可改标题、对白、背景、选项 JSON 和备注；右侧显示玩家视角预览与断链/缺失字段校验。保存是草稿内存变更，`导出 JSON` 才生成下载包，后续发布流程可以在此基础上增加版本、差异和审核状态。

服务启动时默认静态根目录仍是 `web-preview`，不会影响现有 Godot Web 包；`/story-editor`、`/web-runtime` 是显式白名单目录映射。

本地预览服务同时提供内容与存档边界：`GET /api/story/packages/latest`、`GET /api/story/packages/:version`、`GET /api/story/chapters/:id`、`POST /api/story/validate`、`POST /api/story/preview`，以及带 `expectedRevision` 的 `GET/POST /api/saves/:id` 事件接口。它们是本地/预览适配层，不会替换正式联机房间权威服务。

浏览器验收 `tests/web_app_shell.mjs` 使用临时 `STORY_RUNTIME_DATA_DIR`，覆盖根页 200、故事首节点选择、模块路由和控制台错误；`backend/story-content-server.mjs` 支持该目录注入以避免验收数据污染项目运行目录。

## AI 边界

浏览器不持有密钥，只请求本地/部署后的后端代理。后端从环境变量读取密钥；本地 Windows 开发在未设置环境变量时只读用户 Desktop 的 `KEY.txt`，不会复制或写入它。后端调用 `https://api.deepseek.com/chat/completions`，模型配置保持 `deepseek-flash`；模型不可用、超时、限流或 JSON 违规时立即使用本地文本。服务器只接受：当前 NPC 的 affection/trust/alertness/respect、小幅临时情绪、最多 5 个记忆标签/软旗标和 0–2 XP。资源、核心属性、物品、战斗结果和节点跳转永远拒绝。

每个会话持有 `saveRevision`、效果状态和追加事件账本。旧修订请求返回 409，刷新或双端操作不会覆盖较新的成长；Key 只从进程环境读取，烟测也不会把它写入内容包或日志。

## 可执行检查

```powershell
node tools/build_story_package.mjs
node tools/validate_story_package.mjs
node tests/story_package_validator.mjs
node tests/web_story_runtime.mjs
npm --prefix backend run test:story-api
npm --prefix backend run test:story-web
npm --prefix backend run test:local-worker
npm --prefix backend run test:ai-dialogue
npm --prefix backend run test:ai-context
npm --prefix backend run test:web-shell
```

真实 DeepSeek 烟测通过 `KEY.txt` 注入临时进程环境执行；报告只保留 `source/fallback/saveRevision` 等摘要。没有 Key 时，测试仍必须验证本地回退、非法效果拦截和修订冲突。
