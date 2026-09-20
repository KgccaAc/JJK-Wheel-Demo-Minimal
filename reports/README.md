# 验收报告目录

本目录存放验收与审计产物。为控制仓库体积，采用**「摘要入库、明细归档」**策略。

## 保留在版本控制中

| 路径 | 内容 |
|---|---|
| `acceptance-latest.{json,md}` | 全量验收摘要 |
| `web-app-shell-latest.json` | Web Shell 浏览器验收最新结果 |
| `story-ai-smoke-latest.json` | 故事 AI 烟测最新结果 |
| `story-package-validation-latest.json` | 故事包校验最新结果 |
| `balance-audit-2026-09-19.md` | 手牌平衡性人工审计 |
| `online-preview-acceptance-2026-09-18.md` | 联机预览人工验收记录 |
| `*-latest.md` | 各专项人工报告 |
| `full-flow/` | 主线端到端旅程（含 9 张关键截图，规模小且常用） |
| `ui-audit/` | 页面按钮接线与导航目标审计 |
| `self-improve/` | 持续验收汇总 |
| `structure/` | 场景结构审计 |
| `production-entry/` | 生产入口审计（遗留路径看门狗） |

> 入选标准：单个文件小、人工可读性高、需要频繁对照、或作为"当前基线"被引用。

## 已归档（不纳入版本控制）

以下为**逐次运行的明细产物**，会随每次验收无限增长，已通过 `.gitignore` 排除：

| 路径 | 体积（归档前） | 说明 |
|---|---|---|
| `web-acceptance/` | 364.1 MB | 浏览器验收截图/录屏 |
| `balance/` | 52.9 MB | 平衡性分析中间产物（含 xlsx、ndjson） |
| `all-pages/` | 22.5 MB | 全页面截图 |
| `story_screens/` | 9.5 MB | 故事线截图 |
| `errors/` | 0.2 MB | 逐次失败日志 jsonl / stderr |
| `bundles/` | 0.1 MB | 每次验收打包 zip |

**归档位置**：

```
D:\JJK-Archive\reports-2026-09-20\
```

## 新增产物前请确认

- 逐次运行产生的截图、日志、打包文件 → 默认应被 `.gitignore` 覆盖，不要提交
- 仅当它是"需要长期对照的基线摘要"时，才新增对应的 `*-latest.*` 文件并纳入版本控制
- 若确实需要提交较大的二进制产物，请先说明理由并确认不可再生

## 相关

- 体积治理方案：见工作区 `详细工程整理方案清单.md` 阶段 B
- 验收入口：`tools/run_all_acceptance.ps1`、`backend/package.json` 的 `test:*` 脚本
