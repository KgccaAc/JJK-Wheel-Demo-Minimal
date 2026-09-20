# DEBUG_HANDOFF

## 2026-09-19 故事首牌崩溃 / 转盘术式未匹配

### 根因

- `data/battle/source/cards.json` 的 `card_rot_technique_decay_blood`（以及部分同类牌）使用 `effect.special: null`。
- `battle/v3/ActionResolverV3.gd::_action_priority()` 直接把 `effect.special` 强制转换为 `Dictionary`，故事敌方 AI 在首牌预演时崩溃。
- `scenes/wheel/WheelTechniqueRegistry.gd` 只登记了少量内置术式，未复用轮盘源表的 `specialHandTags`，导致源表已有术式被错误标记为未匹配。

### 修复

- `BattleFlowSession._instance_card()` 在发牌边界建立统一的 `effect.special.atomicEffects` 空数组。
- `ActionResolverV3._action_priority()` 对 `effect`、`special`、`params` 做 Variant 类型防护。
- `WheelTechniqueRegistry.resolve()` 先查内置别名，再从权威轮盘源表解析术式族；对源表中无特殊标签的条目使用现有战斗族兜底，并修正 `ganesh_obstacle_removal`、`curse_manipulation`、`recontract_icon` 到实际牌池标签。

### 验证

- `STORY_BATTLE_FIRST_CARD_ACCEPTANCE PASS failures=`：故事双方发牌、弃牌、先手、敌方首牌预演、出牌和回合结算通过。
- `WHEEL_TECHNIQUE_REGISTRY_COVERAGE PASS profiles=72 unresolved=`。
- `WHEEL_TECHNIQUE_BATTLE_COMPATIBILITY PASS profiles=72`：角色投影和已有牌族门控通过。
- `FULL_STORY_RUN_ACCEPTANCE PASS visited=32 history=32 battles=2 scenes=true`。

### 后续风险

- 兼容验收输出的 `unbacked` 是当前 Godot 牌源尚无同族 `matchTags` 的源术式；`gated` 是已有牌但受角色专属、领域或咒具前置限制。不要通过删除 `exclusive` 或强行放行来掩盖这些规则；若要补齐，需要新增权威牌面/内容设计后再接入。

## 错误现象
Godot 客户端与官方房间服务建立 WebSocket 后状态显示 OPEN，但收不到订阅确认、阶段结果和结算广播；HTTP 提交仍能成功。

## 最小重现步骤
1. 运行 `tests/godot/OnlineBattleFullSyncAcceptance.gd`。
2. 创建/加入官方房间并调用 `connect_room_socket`。
3. 双方提交 strategy，观察 `pump_socket` 没有事件。

## 目前错误消息 / Log
修复前：`SYNC_INITIAL_DEBUG events={ } host_socket_state=OPEN guest_socket_state=OPEN`，strategy HTTP 成功但 WebSocket 阶段事件为空。

## 已尝试修法与证据
- 修复官方 Nginx Upgrade/Connection 头：Node WebSocket 握手从 404 变为 101，但 Godot 仍无事件。
- 用 Node 原生 WebSocket 驱动官方完整战斗：服务端广播链路 PASS，排除服务端 resolver/broadcast 根因。
- 追踪 Godot socket 生命周期：首次 OPEN 时待发送订阅包被清空，服务端未收到 subscribe，因此连接只是 OPEN 状态。

## 失败原因
`RemoteOnlineRoomSocket.pump_socket` 在调用 `send_packet` 前无条件清除 `_pending_subscribe`。浏览器/Godot WebSocketPeer 首个 OPEN poll 存在发送竞态，发送未被接受时订阅包丢失且没有重试。

## 根因假设
首次 OPEN 发送订阅的失败需要可重试；连接状态 OPEN 不等于应用层 subscribe 已确认。

## 下一步可否证验证步骤
- 运行 `tests/godot/OnlineBattleFullSyncAcceptance.gd`，应看到两端初始 bootstrap、每个阶段事件和 FINISHED，且 revision/winner 一致。
- 运行 `tests/backend/official_online_battle_websocket_acceptance.mjs`，验证官方服务和 Nginx 广播仍通过。

## 不准再重复的修法
- 不要用 HTTP 轮询替代 WebSocket，也不要把官方服务器错误降级成伪本地战斗。
- 不要把 CORS 改为带凭据场景下的 `*`。

## 2026-09-17 战斗角色选择场景加载失败

- 现象：`res://scenes/battle/character_selection.tscn` 在文件末尾报告 `Parse Error`，按钮审计无法实例化该页。
- 根因：场景中多处乱码占位文本丢失结束引号；两个 RichTextLabel 还含有损坏的 `[/cell]` 标签。文件尾空行和 UTF-8 BOM 都不是根因。
- 已验证修法：补齐 11 处字符串结束引号，替换两处初始 BBCode，属性标题由 `CharacterSelection.gd` 在角色投影时写入。
- 证据：`PAGE_BUTTON_WIRING_AUDIT PASS pages=17 buttons=371 load_errors=0 unbound=0`。
- 不准重复：不要再通过删尾部空行或切换 BOM 尝试修复此类末尾 Parse Error；先检查全文件未配对引号。
