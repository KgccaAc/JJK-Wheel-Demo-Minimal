# 联机房间组件契约

`onlineroom.tscn` 组合 `room_page.tscn` 与 `matchmaking_page.tscn`。运行时唯一接线脚本是 `OnlineRoom.gd`；房间状态只能由传输层响应更新。

## RoomPage 可见控件

| 场景路径 | 名称/职责 | 事件 | 状态或动效 |
| --- | --- | --- | --- |
| `ServeChoose/ServeChoose` | 服务器选择 | 打开本地 Mock / 正式服务器选单 | 自身 pulse |
| `RoomSeeting/RoomControl/Select` | 创建者角色选择 | 打开角色列表 | 自定义角色优先，随后内置角色 |
| `RoomControl/CreatNewRoom` | 创建房间 | `createRoom` | 房间码与成员快照回填 |
| `RoomControl/RoomId/RoomId/CreatNewRoom` | 复制房间码 | 写入剪贴板 | 不修改房间状态 |
| `RoomControl/JoinRoom` | 用当前输入码加入 | `joinRoom` | `JoinRoom/Enemy` 显示对手状态 |
| `RoomControl/DeleteRoom` | 删除主持房间 | `deleteRoom` | 成功后清空当前房间 |
| `CharacterSelect/RoomId/ID` | 唯一可编辑房间码 | Enter 加入，支持 Ctrl+V | 黑字透明输入框 |
| `CharacterSelect/Character1` | 加入者角色选择 | 打开角色列表 | 与创建者角色显示同步 |
| `CharacterSelect/Character2/Character` | 对方角色显示 | 无 | 由房间成员快照更新 |
| `CharacterSelect/CreatNewRoom` | 加入房间 | `joinRoom` | 与 `JoinRoom` 相同操作 |
| `Join/LockCharacter` | 锁定/解锁角色 | `lockCharacter` | 仅自身 pulse |
| `Join/LockCharacter/Visit` | 观战 | `watchRoom` | 仅自身 pulse |
| `Join/Preview` | 队伍预览 | 打开只读角色面板 | 读取房间中另一玩家 |
| `Header/UserButton` | 用户面板 | 打开 User overlay | 复用全局用户页逻辑 |
| `Header/MoreButton` | 设置 | 打开设置 | 复用全局设置逻辑 |

## 房间状态机

```text
未创建
  └─ createRoom ─> 等待对方加入
       └─ joinRoom ─> 对方已加入，未锁定
            └─ 两位玩家 lockCharacter ─> battle_ready / READY
                 ├─ 本地 Mock：交接至本地战斗场景
                 └─ 正式服务器：等待战斗权威服务创建会话
```

`_apply_room_response()` 是唯一的状态入口：它通过 `RoomStateModel` 归一化 V1 的 `room_id/players` 与 V2 的 `roomId/members`，更新当前房间码、对手文案、角色预览缓存和 `SelectionState`。

## 动效规则

- `_connect_button()` 是可见按钮的唯一业务点击入口：先对按钮自身 `UI.pulse()`，再调用业务回调。
- `_bind_room_click_feedback()` 只覆盖没有业务回调的可见按钮；不会给已有 `online_click_animated` 标记的按钮重复绑定。
- `InteractiveLayer` 是隐藏设计稿参考层，禁止接线、禁止作为房间码回退入口。

## 后端边界

| 前端操作 | 本地 Mock V1 | 正式 V2 |
| --- | --- | --- |
| 创建 | `createRoom` | `create_room` |
| 加入 | `joinRoom` | `join_room` |
| 刷新状态 | `getRoom` | `get_room` |
| 锁定角色 | `lockCharacter` + 本地快照 | `lock_character` 冻结已上传的角色快照 |
| 战斗就绪 | `battle_ready` | `READY` |

房间成员在创建或加入时上传已解析的完整角色快照。该快照会立即回传给同房间玩家用于角色预览；锁定只冻结该选择，战斗权威服务从冻结快照创建 V3 对局。服务端不查询官方角色库，也不二次解析登录卡，避免自定义角色被静默丢失。

