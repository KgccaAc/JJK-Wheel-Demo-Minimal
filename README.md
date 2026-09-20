# JJK Wheel Demo — 协作者上手指南

> 本文件是全项目的**唯一入口文档**。读完这一份，你应该能：跑起来、看懂分层、
> 知道改哪里、知道怎么验证、知道哪些坑不能踩。
>
> 最后更新：2026-09-20 · 对应提交 `1ee2a75`

---

## 0. 30 秒速览

| 项 | 内容 |
|---|---|
| 是什么 | 手游原型：**转盘抽角色 → 角色卡 → 单机/联机战斗 → 故事模式 → 账号/社区** |
| 引擎 | **Godot 4.6.2**，`gl_compatibility` 渲染后端 |
| 主语言 | **GDScript**（221 个 `.gd` / 约 23,164 行） |
| 副语言 | **Node.js ESM**（75 个 `.mjs` / 约 6,112 行）—— 后端服务与 web 运行时 |
| 有无 C# | **有 `.csproj` 但 0 个 `.cs`**。`config/features` 声明了 `"C#"` 是历史残留，实际纯 GDScript |
| 启动场景 | `scenes/auth/auth_login.tscn` |
| 设计基准分辨率 | **1672 × 941**，窗口默认 1100 × 619，`canvas_items` 拉伸 |
| 仓库 | private，`https://github.com/KgccaAc/JJK-Wheel-Demo-Minimal` |
| 规模 | 1560 个跟踪文件 / 约 240 MB |

**最重要的一条**：这是一个**原型（Demo）**，不是完成品。存在多处
「规划中但未实现」与「历史遗留但刻意保留」的代码，本文档会明确标出，
**不要看到可疑代码就删**。

---

## 1. 环境准备

### 1.1 Godot 可执行文件

```powershell
$env:JJK_GODOT = 'C:\Users\KgccaAc\Desktop\GodotToolchain\4.6.2\Godot_v4.6.2-stable_win64_console.exe'
```

- **用非 mono 版即可**（本项目 0 个 `.cs`）。
- ⚠️ 部分脚本**硬编码**了 mono 版路径，本机若无该文件会直接失败 ——
  所以**优先用 `JJK_GODOT` 传入**，不要依赖脚本里的默认值。

### 1.2 三条常用命令

```bash
# 跑一个 Godot 验收测试
<godot> --headless --path . --script res://tests/godot/<Name>.gd

# 全项目解析检查（改完代码先跑这个）
<godot> --headless --path . --quit-after 300

# 首次/资源变更后重建导入缓存
<godot> --headless --path . --import
```

### 1.3 Node 端

```bash
node tests/backend/<name>.mjs      # 后端测试
node tests/<name>.mjs              # 顶层 web 测试
```

---

## 2. 目录地图

```
JJK-Wheel-Demo-Minimal/
├── project.godot            # 引擎配置：主场景、autoload、显示、渲染
├── JjkWheelDemo.csproj      # C# 工程壳（无 .cs 源文件，历史残留）
│
├── app/                     # 应用骨架：启动/导航/会话/诊断
│   ├── bootstrap/           #   Bootstrap.gd —— 启动引导
│   ├── navigation/          #   PageRouter.gd / StoryTransition.gd
│   ├── session/             #   AppSession.gd / EventBus.gd
│   ├── audio/               #   AudioService.gd
│   └── diagnostics/         #   Logger / ErrorService / CrashReporter
│
├── battle/                  # ★ 战斗模块（本项目最核心、最复杂的部分）
│   ├── rules/               #   零依赖基座层（见 §4.1）
│   ├── core/                #   会话编排、命令校验、结算流水线
│   ├── v3/                  #   V3 规则引擎（当前生产唯一走这条）
│   ├── data/                #   只读数据仓库、卡牌可用性、候选构建
│   ├── online/              #   联机：房间网关、传输、状态哈希
│   ├── ui/                  #   BattleFlowCoordinator（流程编排）+ 验收面
│   ├── presentation/        #   回合历史格式化
│   └── runtime/             #   历史 fixture 支撑（不得新增规则）
│
├── scenes/                  # 91 个场景：auth / battle / roster / online / community …
├── ui/                      # 可复用 UI 组件、全局主题、字体回退
├── data/                    # 战斗数据源（cards/characters/domains/rules）与 fixture
├── account/                 # 账号、登录卡（Bilibili 身份、登录卡投影/抽取/PNG 编解码）
├── story/                   # 故事模式状态机、节点目录、AI 提供者
├── network/                 # 协议定义、在线客户端、重连控制器
├── gameplay/                # 领域模型（BattleIntent / RoundResult）+ README 占位
├── audio/                   # AudioManager
├── backend/                 # ★ Node 后端：房间服务、AI 对话、V3 结算镜像、部署配置
├── web-*/                   # 浏览器端运行时（web-editor / web-preview / web-runtime）
├── tools/                   # 审计/报表/构建脚本（.mjs + .ps1）
├── tests/                   # 验收测试（见 §6）
├── reports/                 # 生成的审计报告（大量时间戳文件，可忽略）
├── docs/                    # 设计文档与专项指南
└── _archive/                # ★ 刻意保留的历史代码，不要当垃圾删（见 §7）
```

---

## 3. 应用是怎么跑起来的

### 3.1 启动链

```
main_scene = scenes/auth/auth_login.tscn
        ↓
12 个 autoload 单例就绪（见 project.godot 的 [autoload] 段）
        ↓
页面通过 PageRouter.navigate("res://...") 切换
```

**12 个 autoload 单例**（全局可用，勿重复实例化）：

| 名称 | 源文件 | 职责 |
|---|---|---|
| `FontFallback` | `ui/FontFallback.gd` | 中文字体回退（避免 CJK 豆腐块） |
| `AccountState` | `account/AccountState.gd` | 账号状态 |
| `SelectionState` | `SelectionState.gd` | 角色/卡牌选择状态（**在仓库根目录，不在子目录**） |
| `AudioManager` | `audio/AudioManager.gd` | 音频 |
| `ErrorService` | `app/diagnostics/ErrorService.gd` | 统一错误上报 |
| `PageRouter` | `app/navigation/PageRouter.gd` | 页面路由 + 返回栈 |
| `AppSession` | `app/session/AppSession.gd` | 应用级会话 |
| `StoryState` | `story/StoryState.gd` | 故事进度 |
| `StoryTransition` | `app/navigation/StoryTransition.gd` | 故事转场 |
| `EventBus` | `app/session/EventBus.gd` | 全局事件总线 |
| `Logger` | `app/diagnostics/Logger.gd` | 日志 |
| `CrashReporter` | `app/diagnostics/CrashReporter.gd` | 崩溃上报 |

### 3.2 页面路由约定

`PageRouter` 提供 `navigate(scene_path, params, replace)` / `go_back()` / `current_route()`。

**页面可以自愿实现两个生命周期钩子**（由 Router 反射调用，非必需）：

```gdscript
func leave() -> void: ...              # 离开时
func enter(params: Dictionary) -> void: ...   # 进入时（deferred 调用）
```

路由失败会同时 `navigation_failed` 信号 + `ErrorService.report("SCENE_NOT_FOUND", ...)`。

---

## 4. 战斗模块（重点）

战斗是整个项目的心脏，也是分层最讲究的地方。**动手前请读完本节。**

### 4.1 分层与依赖方向（不可违反）

```
                     ┌──────────────────────────────┐
                     │  battle/rules/   零依赖基座   │
                     │  BattleState                 │
                     │  ActionCostResolver          │
                     │  AtomicEffectInterpreter     │
                     └──────────────────────────────┘
                              ▲    ▲    ▲
               ┌──────────────┘    │    └──────────────┐
               │                   │                   │
        ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
        │ battle/core │     │ battle/data │     │  battle/v3  │
        └─────────────┘     └─────────────┘     └─────────────┘
               │                   │                   │
               └──────────┬────────┘                   │
                          ▼                            │
                 ┌─────────────────┐                   │
                 │  battle/ui      │◄──────────────────┘
                 │ (Coordinator)   │
                 └─────────────────┘
```

**实测依赖边（2026-09-20 由 `preload("res://battle/…")` 全量扫描得出）**：

```
core -> data      core -> rules     core -> v3
data -> core ⚠️   data -> rules     data -> v3
v3   -> data      v3   -> rules
ui   -> core      ui   -> online
```

#### ✅ 已达成的不变量

**`battle/rules/` 是真正的零依赖** —— 实测三个文件的 `preload` 数量均为 **0**。
任何战斗子目录都可以引用它，它**绝不**反向引用任何战斗模块。

判定一个类是否属于 `rules/`：**只有数据字段与纯函数、且不 preload 任何战斗模块内文件。**

#### ⚠️ 仍未消除的循环（已知，勿盲目"修复"）

`core ↔ data` 之间**存在 1 条真实反向边**：

```
battle/data/CardAvailabilityService.gd  ->  battle/core/CoreActionResolver.gd
```

组成环路的正向边则有 10 条（`BattleFlowSession` / `CardCompiler` /
`CoreActionResolver` / `DomainRuntime` / `SourceFixtureAdapter` → `data/…`）。

**这是一个双层的真实依赖**：`data` 需要 `core` 来"预演一张牌打出去会怎样"，
而 `core` 需要 `data` 来读卡牌定义。

> **`battle/rules/` 的抽取把环路显著削减了**（原本 `BattleState` 与
> `ActionCostResolver` 也在 `core` 里，导致 `data` 不得不依赖整个编排层），
> 但**没有完全消除**。
>
> 若将来要彻底解环，方向是：把 `CardAvailabilityService` 需要的
> 「原子效果预演」能力下沉为 `rules/` 的纯函数接口，
> 让 `data` 只依赖 `rules/` 而不依赖 `core/`。**这是一项独立的重构，
> 不在当前范围内**，不要顺手改。

### 4.2 结算走 V3（重要）

**生产战斗全部走 `battle/v3/`。**

- `BattleFlowSession` 的 **4 个 `start_*` 入口**全部硬编码
  `state.ruleset_version = &"battle-rules-v3"`。
- 全仓**没有任何调用方**写入 `godot-battle-rules-v1` →
  **V1 路径在生产中不可达**。

**处置约定（已决策，请遵守）**：

- ❌ **不删除** V1 分支。因为常量 `RULESET_VERSION(&"godot-battle-rules-v1")`
  仍被 `battle/core/SourceFixtureAdapter.gd` 用于**源 fixture 校验**，
  删除会破坏 fixture 契约。
- ✅ **只加注**（源码中已有说明注释）。
- 🚫 **不得在 V1 分支新增逻辑**，所有规则演进走 `_resolve_v3_pending_round`。

### 4.3 命令流（唯一合法路径）

```
界面 / 编排器 / 本地网关
        │  只能提交版本化命令，不得直接写 BattleState
        ▼
BattleFlowSession            校验阶段 + revision
        ▼
BattleResolutionPipeline     唯一的生产费用/修正预演边界，输出带阶段标记的 trace
        ▼
CoreActionResolver           提交原子效果到工作状态
        ▼
BattleState                  生成 canonical snapshot + RoundPackage
```

**铁律**：

- `BattleFlowSession` 是**离线生产战斗的唯一会话**。
- `CoreActionResolver` **不得由 UI 直接调用**。
- 失败的行动在**工作副本**中回滚 —— 预演失败**不得**留下扣费或牌区变化。
- Presenter 只读已提交的快照与回合包，**不写状态**。
- 费用计算**必须**经由 `BattleResolutionPipeline`，不允许 UI 自行拼接修正。

### 4.4 `SUPPORTED_TOOLS` 是**嵌套**关系（不是互斥）

```
CoreActionResolver.SUPPORTED_TOOLS (28 项)
        ⊂
AtomicEffectInterpreter.SUPPORTED_TOOLS (51 项)
```

- Interpreter 独有的 tool：`damage`、`heal`、`block`、`shield` 等。
- **修改任一侧时必须同步核对另一侧**，否则解析器与解释器会语义漂移。

### 4.5 策略 ID 与场景节点名是**同一回事**（易踩）

`scenes/battle/StrategySelection.gd` 中：

```gdscript
button.pressed.connect(_on_strategy_pressed.bind(button.name))
```

**策略 ID 就是 Godot 按钮的节点名**，`_find_strategy_button()` 用
`button.name == strategy_name` 匹配，`BattleFlowCoordinator` 依赖该契约。

因此 `STRATEGY_PROFILES` 中 `*Button` 后缀（如 `SteadyButton`）**是硬约束**，
不是命名混乱。它们还是**跨端线上协议字段值**（后端 `backend/story-battle-server.mjs`
与多个验收测试都发送 `{id:'SteadyButton'}`）。

- **不要重命名**这些 ID —— 会同时破坏 UI 绑定、后端协议与验收测试。
- `default` 是「未选策略」的**哨兵值**（`ActionIntentV3` 的默认值），同样不可改名。
- `basic_only` 目前**无任何生产消费方**（全仓仅 2 行提及：它自己的定义行，
  外加 `_archive/` 里一个同名字符串 `shibuya_basic_only`，语义无关）。
  可从 `STRATEGY_PROFILES` 移除，但**属独立清理项，且需先确认无 UI 按钮引用**。

### 4.6 `battle/ui/` 两个文件

| 文件 | 职责 |
|---|---|
| `BattleFlowCoordinator.gd` | 战斗页面的**唯一流程编排层**：把策略/弃牌/先手/回合继续串成可测试链条，并承载联机输入模式（`configure_online_input` / `bootstrap_online_state`） |
| `FightAcceptanceSurface.gd` | **纯反射**的只读验收面，供测试访问 Presenter 内部状态，避免把测试钩子塞回生产类 |

依赖方向 `scenes/battle → battle/ui`，**无回环**。

---

## 5. 联机架构

```
Godot 客户端
  BattleFlowCoordinator (online 模式)
        ▼
  OnlineRoomGateway
        ▼
  ┌─────────────────┬──────────────────────┐
  │ LocalHttp...    │ RemoteOnlineRoom...  │
  │ (本地联调)       │ (走真实服务端 + WS)   │
  └─────────────────┴──────────────────────┘
        ▼
  backend/  Node 服务（房间、battle-v3-resolver 镜像、AI 对话）
```

**设计原则**：战斗初始投影由**服务端**提供。客户端不从房间快照本地发牌 ——
避免客户端与 Worker 在策略、随机数或私有手牌上各自产生一份初始状态。

`BattleState.canonical_snapshot()` 输出含 `sha256 state_hash` 的规范化快照，
供联机一致性比对（两侧 hash 不一致即发现状态分歧）。

详见 `docs/online-room-core-path.md` 与 `battle/online/README.md`。

---

## 6. 测试与验收

### 6.1 测试规模

| 分组 | 数量 | 命令 |
|---|---|---|
| Godot 验收（可直接 headless） | 79 | `<godot> --headless --path . --script res://tests/godot/<Name>.gd` |
| Godot 验收（**需真实窗口**） | 10 | 去掉 `--headless`，加 `--resolution 540x960` |
| Godot 验收（需外部服务） | 1 | 由 `tests/powershell/online_matchmaking_client_acceptance.ps1` 驱动 |
| 后端 Node | 11 | `node tests/backend/<name>.mjs` |
| 顶层 Node | 18 | `node tests/<name>.mjs` |
| PowerShell 挂载 | 4 | `& tests/powershell/<name>.ps1` |

总入口：**`tools/run_all_acceptance.ps1`**（`-Fast` 跳过较慢的联机流程）。

### 6.2 测试写法约定

Godot 测试统一：

```gdscript
extends SceneTree            # 不是 Node
func _initialize() -> void:  # 注意是 _initialize，不是 _ready
    ...
    print("MY_TEST PASS ...")   # 或 FAIL
    quit(0)                      # 失败 quit(1)
```

### 6.3 ⚠️ 五种"看起来坏了其实没问题"的情况

**（1）10 个测试必须真实窗口**

它们无条件调用 `get_viewport().get_texture().get_image()` 并 `save_png()`。
`--headless` 使用 dummy 渲染后端、没有可绘制表面，于是报
`Parameter "t" is null` 或直接超时。

```
AllPagesVisualCapture                          BattleRoundSummaryRealWindowAcceptance
BattleSummonRealWindowAcceptance               CharacterSelectionRealWindowAcceptance
CharacterStatValueVisualAcceptance             OnlinePopupRealWindowAcceptance
OnlineStaticControlsRealWindowAcceptance       StoryRealWindowFlowAcceptance
StoryVisualCapture                             WheelDirectionLabelVisualAcceptance
```

去掉 `--headless` 即可，实测 **10/10 通过**。

> `OpponentResponseCardNameAcceptance` 也截图，但它用
> `if DisplayServer.get_name() != "headless"` 做了守卫，headless 下正常通过。

**（2）`OnlineMatchmakingClientAcceptance` 单独跑必然失败（预期）**

它要求环境变量 `ONLINE_MATCHMAKING_ENDPOINT`，缺失时 `quit(2)`。
必须由 `tests/powershell/online_matchmaking_client_acceptance.ps1` 驱动（会起本地服务）。

**（3）`TechniqueAuditMeasurement.gd` 是批处理测量器，不是验收测试**

对 351 张卡跑 3 种子 × 3 强度档 = 约 **2,601 局**模拟，**每张卡约 63 秒**，
全量需数小时。用 180s / 420s 超时去跑它**必然 TIMEOUT**。
它由 `tools/run_technique_family_strength.ps1` 驱动，**不在** `run_all_acceptance.ps1` 内。
快速自检可加 `--limit=4`。

其它慢但会通过的：`HandBalanceMeasurement` ~203s、`CardCategoryBenchmark` ~111s、
`CardValueScenarioBenchmark` ~27s。

**（4）`CoreMultiChoiceAcceptance.gd` 断言了未实现的接口**

它读 `campus.get("extra_choice_buttons")`，但 `RpgFlow.gd` 中**没有**该属性，
`RPG.tscn` 中**只有** `Text/Choose1` 与 `Text/Choose2`，不存在 `ChoiceExtra*` 节点。
于是 `as Array` 转换失败 → `_initialize` 无法走到 `quit()` → **进程挂起**。

自初始导入 `7ae7c6b` 起就是如此，**也未被任何入口脚本引用**。
属于"第 3/4 个选项的多按钮 UI"这一**规划中但未实现**的功能。

> 注意：选项**数据**本身是多选的（`chapter1_clue` 3 个、核心涩谷节点最多 6 个），
> 且 `RpgFlow._choose_index` 已能处理任意索引 —— **缺的只是渲染第 3 个及以后按钮的 UI**。

**（5）慢 ≠ 失败**。判读测试结果请看退出码与 `PASS`/`FAIL` 字样，不要凭时长判断。

---

## 7. `_archive/` —— 刻意保留，不要删

| 归档目录 | 原名 | 归档原因 |
|---|---|---|
| `_archive/corrupted-scenes/fight.tscn` | `scenes/battle/fight.tscn` | 损坏的孪生场景；已被 `battle_scene.tscn` 取代 |
| `_archive/legacy-runtime/HandDealer.gd` | `battle/runtime/HandDealer.gd` | 发牌器已内联到 V3 |
| `_archive/legacy-online/LocalBattleCommandGateway.gd` | `battle/online/…` | 被 `OnlineRoomGateway` 取代 |
| `_archive/legacy-source-js/` | `data/battle/source-js/` | 原始 JS 版战斗逻辑（12 文件 / 2.2 MB），作为规则对照保留 |

**为什么保留**：它们是**规则演进的对照基准**，也是归档契约
（如 `SourceFixtureAdapter` 仍引用 V1 版本号）的一部分。删除会破坏历史可追溯性。

---

## 8. Godot 实操坑（必读）

### 8.1 UID 体系

- `.gd` 文件有 `.uid` 旁车文件；纹理 UID 存在 `.import` 文件里。
- **移动带 `class_name` 的文件时，必须手工更新
  `.godot/global_script_class_cache.cfg`**，否则场景引用会断。
- 项目仍有 **345 处 UID 不匹配**待专门轮次处理（已决定延后，**不要零散修**）。
- 新增 `.gd` 后记得把 `.gd.uid` 一并纳入版本控制（曾漏过
  `battle/ui/FightAcceptanceSurface.gd.uid`）。

### 8.2 headless 的硬限制

`--headless` 使用 **dummy 渲染后端** → `get_viewport().get_texture()` 返回 `null`。
**任何截图 / `save_png` 断言在 headless 下必然失败**，这不是回归。

### 8.3 GDScript 枚举无法通过反射读取

`Object.get()` **读不到 enum**。需要跨文件读枚举时，
**必须由持有方自己转成名字或整数**。
参考 `scenes/battle/FightPresenter.gd` 的 `acceptance_phase_name()`。

### 8.4 `.tscn` 解析陷阱

`.tscn` 中**子节点是独立的 `[node ...]` 块**，父节点的块内**没有**缩进内容。

```
[node name="ActionButtons" type="Control" parent="."]
z_index = 1000
layout_mode = 1

[node name="RoundHistory" type="TextureButton" parent="ActionButtons"]   ← 子节点在别处
```

**不能靠"父节点块内有无缩进内容"判断它是否有子节点** —— 会误判为空容器。
`battle_scene.tscn` 因此曾被误计为有"8 个空 Control 容器"。
正确做法是按 `parent="..."` 字段统计。

### 8.5 `.gitignore` 的 Windows 大小写陷阱

忽略顶层目录时**务必加前导斜杠**。原先写作 `Godot/`，
而 Windows 下 git 的忽略匹配**大小写不敏感**，导致 `tests/godot/` 被一并忽略 ——
179 个条目只有 121 个被跟踪，**29 个验收测试从未进入版本库**。

已修正为 `/Godot/`。新增忽略规则后请自查：

```bash
git check-ignore -v tests/godot/<AnyTest>.gd   # 期望：无输出（rc=1）
git check-ignore -v Godot/                      # 期望：命中 .gitignore:/Godot/
```

### 8.6 踩过的字段陷阱

`scenes/battle/FightPresenter.gd` 中 `_domain_panels_activated` /
`_hit_effect_triggered` / `_initial_deal_started_offscreen` 三个字段
**看似"仅供诊断"，实为生产代码写入**。删除它们会立即导致 Parse Error —— **必须保留**。

> 教训：删除任何字段前，先全仓 grep 确认没有生产代码写入。

---

## 9. 协作工作流

### 9.1 改动前

1. 确认改动属于哪一层（§4.1），**新依赖必须顺着现有方向，不得反向**。
2. `battle/rules/` 内**不得**新增任何 `preload` 战斗模块文件的代码。
3. 若要动 `SUPPORTED_TOOLS`、策略 ID、V1 分支 —— 先读 §4.2 / §4.4 / §4.5。

### 9.2 改动后

```bash
# 1) 全项目解析检查（最快发现语法错误）
<godot> --headless --path . --quit-after 300

# 2) 跑相关验收测试
<godot> --headless --path . --script res://tests/godot/<Name>.gd

# 3) 提交前建议跑全量
& tools/run_all_acceptance.ps1
```

**验收标准**：解析 0 错误 + 相关测试全 PASS。
`--headless` 下唯一的预期 ERROR 是无害的
`1 resources still in use at exit`。

### 9.3 提交信息

沿用约定式前缀，正文用中文说明**为什么**改，而非仅"改了什么"：

```
fix(battle): 修正 CardAvailability 预演时的 CE 泄漏
refactor(rules): 把 HandDealer 迁入 legacy-runtime
chore(battle): 补入 FightAcceptanceSurface 的 Godot UID 旁车文件
```

---

## 10. 网络与环境限制（本机特有）

| 项 | 情况 |
|---|---|
| `git push` | ❌ 被沙箱代理封锁，四条路径全失败 |
| `api.github.com` | ✅ 可达 |
| 代理 | 环境变量 `HTTP_PROXY` / `HTTPS_PROXY` = `http://127.0.0.1:<动态端口>`（每次会话不同） |
| `github.com:443` | ❌ 超时 / 连接重置 |
| `codeload.` / `raw.githubusercontent.com` | ❌ DNS 解析失败 |

**推送仓库请走 Git Data API**，已固化为可复用 Skill：`git-data-api-push`
（含 4 个致命陷阱修复 + 强制独立验收流程）。

---

## 11. 当前状态与已知待办

### 已完成

- **P1-1** 退役损坏孪生场景 `fight.tscn`，修复 `character_selection.tscn` 13 处
  mojibake 路径与多个脚本 UID。
- **P1-2/3/4** 抽取 `battle/rules/` 零依赖基座层，`battle/runtime/` 已清空。
- **P1-4b** 新增 `tests/godot/CoreActionResolverUnitTest.gd`（79 项断言）。
- **P1-5** 标注 V1 结算器"生产不可达"并冻结其维护。
- **P2-11** 清理零调用方法；`BattleFlowCoordinator` 归位 `battle/ui/`。
- **P2-12** `FightPresenter` 1454 → 1340 行，验收钩子外提为
  `battle/ui/FightAcceptanceSurface.gd`。
- **P2-13 复核**：策略 ID 命名与"空 Control 容器"**两项均为误报**，无需改动。

### 待办

| 项 | 说明 |
|---|---|
| 345 处 UID 不匹配 | 需专门轮次统一处理，**勿零散改** |
| `CardAvailabilityService` 解环 | 把原子效果预演下沉为 `rules/` 纯函数，彻底消除 `core ↔ data`（见 §4.1） |
| `basic_only` 死项清理 | 无生产消费方（见 §4.5），需先确认无 UI 按钮引用 |
| 3 个 master-entry SKIP 脚本 | 待排查 |
| `CoreMultiChoiceAcceptance` | 缺"第 3+ 选项"的 UI 渲染（数据层已支持） |
| `zshzfightwheel.art` SSL 证书 | 需轮换 |
| `reports/balance/` 2 个 Excel | 被锁定 |

---

## 12. 延伸阅读

| 文档 | 内容 |
|---|---|
| `battle/rules/README.md` | 零依赖基座层的完整设计理由与成员说明 |
| `battle/core/README.md` | 会话编排与命令流 |
| `battle/online/README.md` | 联机架构 |
| `docs/acceptance-testing-guide.md` | 验收测试运行细则（§6.3 的完整版） |
| `docs/online-room-core-path.md` | 联机房间核心路径 |
| `docs/ui-page-logic-audit.md` | UI 页面逻辑审计 |
| `docs/story/` | 故事模式设计文档 |
| `backend/README.md` | 后端服务与部署 |
| `CODEX_HANDOFF.md` | 历史交接记录（42 KB，信息量大但部分已过时） |

---

## 附：一句话总结每层的改动规则

| 层 | 允许 | 禁止 |
|---|---|---|
| `battle/rules/` | 加纯数据与纯函数 | **preload 任何战斗模块文件** |
| `battle/data/` | 只读查询、视图模型 | 持有会话状态 |
| `battle/core/` | 会话编排、命令校验 | 被 UI 直接调用 |
| `battle/v3/` | 新规则演进 | —— |
| `battle/ui/` | 流程编排、反射验收面 | 写 `BattleState` |
| `scenes/` | 展示、输入转发 | 写规则、直接改状态 |
| `_archive/` | 只读参考 | **删除** |
