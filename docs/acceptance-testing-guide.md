# 验收测试运行指南

本文记录 `tests/` 下各类检测脚本的**正确运行方式**，以及若干容易被误判为
"测试坏了"的已知情况。基于 2026-09-20 的全量体检（89 个 Godot 验收测试、
11 个后端 Node 测试、18 个顶层 Node 测试、4 个 PowerShell 挂载脚本）。

## 结论速览

| 分组 | 数量 | 命令 | 结果 |
|------|------|------|------|
| Godot 验收（直接） | 79 | `godot --headless --path . --script res://tests/godot/<Name>.gd` | 全通过 |
| Godot 验收（需真实窗口） | 10 | 去掉 `--headless`，加 `--resolution 540x960` | 全通过 |
| Godot 验收（需外部服务） | 1 | 由 `tests/powershell/online_matchmaking_client_acceptance.ps1` 驱动 | 通过 |
| 后端 Node | 11 | `node tests/backend/<name>.mjs` | 全通过 |
| 顶层 Node | 18 | `node tests/<name>.mjs` | 全通过 |
| PowerShell 挂载 | 4 | `& tests/powershell/<name>.ps1` | 全通过 |

总入口：`tools/run_all_acceptance.ps1`（`-Fast` 跳过较慢的联机流程）。

## 一、Godot 可执行文件：必须用 `JJK_GODOT` 指定

本仓库的脚本里 Godot 路径是**硬编码**的，且部分指向 **mono 版**
（`Godot_v4.6.2-stable_mono_win64.exe`）。本机若无该文件，脚本会直接失败。

本项目 **0 个 `.cs` 文件**（全部逻辑为 GDScript），因此**非 mono 版完全够用**：

```powershell
$env:JJK_GODOT = 'C:\Users\KgccaAc\Desktop\GodotToolchain\4.6.2\Godot_v4.6.2-stable_win64_console.exe'
```

## 二、10 个必须用真实窗口运行的测试

以下测试会**无条件**调用
`get_root().get_viewport().get_texture().get_image()` 并 `save_png()` 截图。
在 `--headless` 下视口使用 dummy 后端、没有真实可绘制表面，因此：

- 有的报 `SCRIPT ERROR: Parameter "t" is null`（`texture_2d_get`）；
- 有的直接挂起，表现为 180s / 420s 超时。

**它们不是坏了，只是需要真实窗口**——去掉 `--headless` 即可，实测 10/10 通过：

```
AllPagesVisualCapture
BattleRoundSummaryRealWindowAcceptance
BattleSummonRealWindowAcceptance
CharacterSelectionRealWindowAcceptance
CharacterStatValueVisualAcceptance
OnlinePopupRealWindowAcceptance
OnlineStaticControlsRealWindowAcceptance
StoryRealWindowFlowAcceptance
StoryVisualCapture
WheelDirectionLabelVisualAcceptance
```

正确命令：

```
Godot_v4.6.2-stable_win64_console.exe --resolution 540x960 \
  --path . --script res://tests/godot/<Name>.gd
```

> `OpponentResponseCardNameAcceptance` 也截图，但它用
> `if DisplayServer.get_name() != "headless"` 做了守卫，所以 headless 下能正常通过。

## 三、需要外部服务的测试

`OnlineMatchmakingClientAcceptance.gd` 在 `_initialize` 里要求环境变量
`ONLINE_MATCHMAKING_ENDPOINT`，缺失时直接 `quit(2)`。**单独运行必然失败，这是预期行为。**

它会起一个本地 authority 服务（`backend/preview-room-server.mjs`）并注入端点：

```powershell
& tests/powershell/online_matchmaking_client_acceptance.ps1
```

## 四、两个"看起来超时"的测试（已知，非缺陷）

### `TechniqueAuditMeasurement.gd` —— 批处理测量器，不是验收测试

它读取 `reports/balance/technique-audit-inventory-2026-09-19.json`（351 张卡），
对每张有 `familyKeys` 的卡跑 **3 个种子 × 3 个强度档 = 9 局**，共约 **2,601 局**模拟。

实测**每张卡约 63 秒**，全量需数小时——**用 180s 或 420s 超时去跑它必然 TIMEOUT**。

它由专用包装脚本 `tools/run_technique_family_strength.ps1` 驱动，**不在** `run_all_acceptance.ps1` 内。
支持 `--limit=N` 限制卡片数以便快速自检：

```
--path . --script res://tests/godot/TechniqueAuditMeasurement.gd --limit=4
# -> TECHNIQUE_AUDIT_MEASUREMENT PASS rows=36 cards=4 missing=0   (约 253s)
```

其他慢测试（**均通过**，只是耗时）：`HandBalanceMeasurement` ~203s、
`CardCategoryBenchmark` ~111s、`CardValueScenarioBenchmark` ~27s。

### `CoreMultiChoiceAcceptance.gd` —— 断言了未实现的接口

该测试读取 `campus.get("extra_choice_buttons")`，但：

- `RpgFlow.gd` 中**没有** `extra_choice_buttons`；
- `RPG.tscn` 中**只有** `Text/Choose1` 与 `Text/Choose2`，不存在 `ChoiceExtra*` 节点。

于是 `as Array` 转换失败：

```
SCRIPT ERROR: Invalid cast: could not convert value to 'Array'.
```

`_initialize` 在报错后无法继续到 `quit()`，进程就此挂起（已用 400s 验证）。

它自 `7ae7c6b` 初始导入起就是如此，**也未被任何入口脚本引用**，
属于"第 3/4 个选项的多按钮 UI"这一**规划中但未实现**的功能。

> 注意：选项**数据**本身是多选的（`chapter1_clue` 3 个、核心涩谷节点最多 6 个），
> 且 `RpgFlow._choose_index` 已能正确处理任意索引——缺的只是**渲染第 3 个及以后按钮的 UI**。

## 五、Windows 上的 `.gitignore` 陷阱

`.gitignore` 中忽略顶层目录时**务必加前导斜杠**。原先写作 `Godot/`，
而 Windows 下 git 的忽略匹配**大小写不敏感**，导致 `tests/godot/` 被一并忽略——
`tests/godot/` 下 179 个条目只有 121 个被跟踪，**29 个验收测试从未进入版本库**。

已修正为 `/Godot/`。若后续新增忽略规则，请沿用此写法并自查：

```
git check-ignore -v tests/godot/<AnyTest>.gd   # 期望：无输出（rc=1）
git check-ignore -v Godot/                      # 期望：命中 .gitignore:/Godot/
```
