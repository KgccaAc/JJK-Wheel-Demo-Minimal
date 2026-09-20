# 核心流程美术与操控复核

日期：2026-09-18  
项目：JJK-Wheel-Demo-Minimal

## 复核边界

本记录把独立子场景截图和真实窗口流程分开：战斗倾向、先手、召唤预览、回合总结是战斗宿主里的覆盖层，不能仅凭孤立启动图判定布局。故事真实窗口使用渲染鼠标事件，联机验收只访问 `https://119.91.224.223/preview-room-api` 的一次性房间，不部署、重启或写正式服务。

## 结果

| 核心流程 | 证据 | 结果 |
|---|---|---|
| 转盘生成角色 | `WheelTextureControlAcceptance.gd`；`WheelAutoRankAcceptance.gd` | PASS：更多、返回、前盘、后盘均为带 `art/` 纹理的 `TextureButton`；自动评级 `grade=三级`、`steps=29` |
| 故事模式 | `StoryFlowAcceptance.gd`；`FullStoryRunAcceptance.gd`；`StoryRealWindowFlowAcceptance.gd` | PASS：节点契约、32 个访问节点、2 场战斗、真实窗口 11 张截图；RPG 对话面板整区可点击，地图完成态存在 |
| 转盘角色基础战斗 | `StoryBattleCharacterAcceptance.gd`；`BattlePostStrategyInputAcceptance.gd`；`BattleBoundaryCastAcceptance.gd` | PASS：转盘快照到角色 profile/牌池，`hand=10 tagged=3`；策略后进入弃牌、手牌可命中；边界转换通过 |
| 联机战斗 | `official_online_battle_full_acceptance.mjs`；`official_online_battle_websocket_acceptance.mjs`；`OnlineBattleFullSyncAcceptance.gd`；`OnlineMatchmakingClientAcceptance.gd` | PASS：预览房间完成 strategy/discard/initiative/play 到 `FINISHED`，双方 revision/winner 同步；匹配队列、锁定和策略阶段通过 |

## 本轮实际修改

- `scenes/wheel/wheel.tscn`：`Header/MoreButton` 改为复用 `art/community/更多操作按钮.png` 的 `TextureButton`。
- `scenes/wheel/wheel.gd`：返回菜单、前后转盘导航改为复用 `art/menu/菜单大按钮.png`、`art/wheel/选择跳转按钮.png` 的 `TextureButton`，原回调不变。
- `scenes/community/community_vote.tscn`：修复议题卡进度条遮挡，并将投票页标题改为“议题投票”。社区是未完工模块，本轮不继续扩展。
- `tests/godot/WheelTextureControlAcceptance.gd`、`tests/godot/CommunityLayoutAcceptance.gd`：保存红灯/绿灯验收。
- `tests/godot/AllPagesVisualCapture.gd`：捕获器在窗口纹理不可用时记录失败，不再以 `pages=0` 报 PASS。
- `battle/core/BattleFlowSession.gd`、`battle/presentation/RoundHistoryFormatter.gd`：读取真实 V3 `actions[*].result`，展示敌方意图、命中状态、伤害来源、实际伤害和护盾吸收；优先使用回合包保存的牌名，旧封包才回退提交卡牌实例。
- `scenes/battle/round_summary_panel.tscn`：复用 `art/fight/回合纪要.png` 纹理承载扩展纪要，不新增普通 Button。
- `tests/godot/BattleIntentDamageReadabilityAcceptance.gd`、`tests/godot/BattleRoundSummaryRealWindowAcceptance.gd`：记录红灯/绿灯与真实窗口截图证据。
- `tests/godot/BattleSummonRealWindowAcceptance.gd`：在真实战斗宿主调用 `set_battle_status()` 注入合法 summon 状态，确认状态栏显示真实名称 `验收玉犬` 与 `72 / 80`；独立 `preview_summoned.tscn` 的占位文字不作为产品结论。

## 保留的改进项

- P1：基础战斗首回合信息已在真实回合纪要中可读；仍可继续优化浮层位置，减少对顶部对手横幅的遮挡。
- P1：召唤预览真实宿主绑定已通过；后续仅需在真实卡牌触发召唤时补一条端到端截图，当前不修改占位场景文案。
- P1：联机页的服务器健康、断线重连和旧服务回退状态需继续做预览服只读验收。
- P2：清理遗留 invalid UID；增加 720p/1080p/超长屏截图；补 Web 导出 CORS/场景旅程；继续扩展规则 DSL 和源 fixture hash 对比。

## 2026-09-18 联机弹窗与预览后端复核

### 玩家视角结论

- 新手玩家：弹窗标题“选择联机服务器”明确说明当前任务；“本地 Mock”和“官方联机服务器”文字直接说明用途，点击后页面服务器标签会更新，弹窗关闭反馈明确。
- 熟练玩家：两项按钮垂直排列、鼠标悬停/按下复用 `art/onlineroom/房间页面/按钮2.png`，不需要再理解默认灰色系统控件。
- 视觉：原 Godot 默认灰框已移除，弹窗改用 `服务器选择.png` 九宫格纹理；仍保留 P2：弹窗与页面中央内容有轻微遮挡，后续可在不降低可见性的前提下微调位置。

### 证据

| 检查 | 结果 |
|---|---|
| `OnlinePopupTextureControlAcceptance.gd` | PASS：87 个动态弹窗按钮均为纹理按钮，invalid 为空 |
| `OnlinePopupRealWindowAcceptance.gd` | PASS：真实窗口标题、两项按钮、纹理、点击 `_server_index=1`、关闭和两张截图均通过 |
| 预览根页面 `https://119.91.224.223/preview/` | GET 200 |
| 预览房间健康 `https://119.91.224.223/preview-room-api/health` | 200；`battleAuthority=true`、`protocolVersion=online-battle-v3` |
| 预览 HTTP 双端战斗 | PASS：建房→加入→锁定→strategy/discard/initiative/play→FINISHED |
| 预览 Node WebSocket 双端战斗 | PASS：双方 revision/winner 一致 |
| 预览 Godot 远端同步 | PASS：`OnlineBattleRemoteAcceptance`、`OnlineBattleFullSyncAcceptance` |
| 本地匹配客户端回归 | PASS：`OnlineMatchmakingClientAcceptance` |

截图：`reports/ui-audit/screenshots/online-popup-real-open.png`（打开状态）、`online-popup-real.png`（点击后状态）。诊断 JSON：`reports/ui-audit/online-popup-real-latest.json`。

### 本轮修改

- `scenes/online/OnlineRoom.gd`：为服务器、房间角色、在线角色和角色预览弹窗统一加 `StyleBoxTexture` 纸张面板；服务器弹窗增加标题；按钮继续使用 `TextureButton` 与 `art/` 纹理。
- `tests/godot/OnlinePopupRealWindowAcceptance.gd`：增加真实窗口打开/关闭截图、节点/纹理/点击诊断，避免把 headless dummy 视口误判为 UI 失败。
- `docs/superpowers/specs/2026-09-18-online-server-picker-design.md`：保存样式、交互和预览后端边界设计。

### 仍保留的 P2

- 在线页面静态 `OptionButton` 的灰色主题需要单独建立红灯后再替换，不能与本轮动态弹窗混为一谈。
- 继续补 720p、1080p、超长屏和 Web 导出双标签页验收；不改正式服务。

## 2026-09-18 严格美术复核：战斗角色选择页

### 审核标准

- 只接受真实窗口渲染证据；headless 场景树不能代替视觉结论。
- 所有可点击入口必须是 `TextureButton` 并引用 `res://art/` 纹理；禁止普通灰色 `Button`。
- 逐项检查纹理边缘、按钮点击矩形、文本视觉中心、文本越界、重复标题和乱码。
- 以新手“能否理解下一步”和熟练玩家“是否能快速选取”为双视角审核。

### 红灯到绿灯

- 红灯脚本：`tests/godot/CharacterSelectionStrictVisualAcceptance.gd` 首次捕获原生 Button、动态 `Button.new()`、乱码和动态角色名偏移。
- 修复：`scenes/battle/CharacterSelection.gd` 的动态角色行改为 `TextureButton` + `art/fight/角色选择/角色选择未选中.png`；静态两个角色入口与更多操作改为带纹理按钮。
- 修复：隐藏角色卡上方遗留的重复乱码姓名；选择按钮文案缩短为“选择我方/选择对方”，并把文本放到纹理左侧加号右侧的可读区域，避免视觉偏心和泄漏。
- 绿灯：`CHARACTER_SELECTION_STRICT_VISUAL_ACCEPTANCE PASS failures=[]`。

### 真实窗口证据

- 默认页：`reports/ui-audit/screenshots/character-selection-real-default.png`
- 打开我方选择器：`reports/ui-audit/screenshots/character-selection-real-picker.png`
- 诊断：`reports/ui-audit/character-selection-real-latest.json`
- `CHARACTER_SELECTION_REAL_WINDOW_ACCEPTANCE PASS`：默认/选择器截图均成功，选择器动态行 84 个，全部使用 art 纹理。

### 玩家视角结论

- 新手：页头“战斗角色选择”和副标题明确说明选择双方后进入基础战斗；红色加号按钮承担唯一选择入口，列表行有明确角色名。
- 熟练玩家：我方/对方按钮位置固定，选择列表可滚动，点击后立即回填卡面；底部战斗入口仍保持原有逻辑。
- 视觉：本轮确认没有白色系统按钮边框、动态列表灰色背景或文本越出按钮。仍保留 P2：角色卡详情表格信息密度较高，需在 720p/1080p/超长屏和多语言最长字符串矩阵中继续验证。

### 捕获器边界

- `AllPagesVisualCapture.gd` 在 dummy 渲染器下曾得到 `pages=0` 且 `get_texture()` 为空；该结果已视为捕获器环境失败，不再作为全页面 PASS 证据。真实窗口测试使用 OpenGL Compatibility 渲染器重新生成上述角色选择截图。

## 2026-09-18 新增视觉缺陷：转盘方向与属性实值

### 转盘方向文字

- 红灯复现：恢复上次抽取结果后 `WheelSegments` 保持非零旋转，但 `calculate_label_rotation()` 只看扇区局部角度；左右扇区的最终屏幕角度超过 ±90°，文字上下颠倒。
- 修复：先用“扇区中线 + 节点旋转”得到屏幕可读角，再减去节点旋转返回局部补偿角；不改变抽取、落点或旋转时长逻辑。
- 真实窗口绿灯：`tests/godot/WheelDirectionLabelVisualAcceptance.gd` → `WHEEL_DIRECTION_LABEL_VISUAL_ACCEPTANCE PASS`；截图 `reports/ui-audit/screenshots/wheel-direction-real.png`。

### 战斗角色选择属性卡

- 红灯复现：六项属性的 RichTextLabel 同时绘制“属性名/实值”，子 Label 又绘制大号评级和值；实际窗口中“实值”行与评级层重合，部分值标签矩形也相交。
- 修复：RichTextLabel 只保留属性名；`Label` 评级和值行在卡片内使用明确位置、字号、对齐和省略策略，值文案为“实值：数值”。玩家与对手两张卡均统一处理。
- 真实窗口绿灯：`tests/godot/CharacterStatValueVisualAcceptance.gd` → `CHARACTER_STAT_VALUE_VISUAL_ACCEPTANCE PASS`；截图 `reports/ui-audit/screenshots/character-selection-stat-value-real.png`。

### 本轮严格视觉回归

- `CharacterSelectionStrictVisualAcceptance` PASS
- `CharacterSelectionRealWindowAcceptance` PASS
- `WheelTextureControlAcceptance` PASS
- `WheelAutoRankAcceptance` PASS
- Godot editor headless parse exit 0；输出中仅有既有 invalid UID 回退警告。
